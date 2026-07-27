import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { CONFIG_DEFAULTS } from "./config";
import { isEarlyDeparture } from "../src/lib/attendeeProfile/earlyDeparture";
import { ArrivalDepartureTime, DIETARY_PREFERENCES } from "../src/lib/applications/types";
import { isValidE164Phone } from "../src/lib/applications/validation";
import {
  bikeStatusValidator,
  countsForLogistics,
  getActiveApplication,
  requireActiveApplication,
  sleepingTypeValidator,
  travelModeValidator,
  vehiclePassStatusValidator,
} from "./lib/profileValidators";
import { requireOpsPassword } from "./lib/auth";
import { computeProfileCompleteness } from "../src/lib/attendeeProfile/completeness";
import { sleepingDisplayName } from "../src/lib/attendeeProfile/options";
import {
  buildAttendeeProfileUpdatedPayload,
  buildInvalidDeparturePayload,
  logEvent,
} from "./lib/events";
import { upsertOpsSignupRow } from "./opsSignupRows";

const arrivalDepartureTime = v.union(
  v.literal("12:01 am to 11.00 am"),
  v.literal("11.01 am to 6.00 pm"),
  v.literal("6.01 pm to 12.00 am")
);

const VEHICLE_TRAVEL_MODES = ["driving_own_vehicle", "riding_with_attendee"];

async function getDepartureCutoff(ctx: MutationCtx): Promise<string> {
  const cutoffConfig = await ctx.db
    .query("config")
    .withIndex("by_key", (q) => q.eq("key", "departureCutoff"))
    .first();
  return cutoffConfig?.value ?? CONFIG_DEFAULTS.departureCutoff;
}

/**
 * Get or create the attendee profile for an application, seeding the
 * overlapping fields from the legacy confirmed_members record on first
 * create so previously saved answers don't disappear.
 */
async function getOrCreateProfile(
  ctx: MutationCtx,
  application: Doc<"applications">
): Promise<Doc<"attendee_profiles">> {
  const existing = await ctx.db
    .query("attendee_profiles")
    .withIndex("by_userId", (q) => q.eq("userId", application.userId))
    .first();
  if (existing) {
    return existing;
  }

  const legacy = await ctx.db
    .query("confirmed_members")
    .withIndex("by_userId", (q) => q.eq("userId", application.userId))
    .first();

  const now = Date.now();
  const profileId = await ctx.db.insert("attendee_profiles", {
    userId: application.userId,
    applicationId: application._id,
    // Legacy checkboxes: false is indistinguishable from unanswered, so
    // only carry over affirmative answers.
    hasTicket: legacy?.hasBurningManTicket === true ? true : undefined,
    vehiclePassStatus: legacy?.hasVehiclePass === true ? "have" : undefined,
    requests: legacy?.requests ?? legacy?.notes,
    createdAt: now,
    updatedAt: now,
  });

  const profile = await ctx.db.get(profileId);
  if (!profile) {
    throw new Error("Failed to create attendee profile");
  }
  return profile;
}

async function requireActiveApplicationById(
  ctx: MutationCtx,
  applicationId: Id<"applications">
): Promise<Doc<"applications">> {
  const application = await ctx.db.get(applicationId);
  if (!application || !countsForLogistics(application)) {
    throw new Error("Active application not found");
  }
  return application;
}

async function finalizeSectionSave(
  ctx: MutationCtx,
  application: Doc<"applications">,
  section: string,
  fields: Record<string, unknown>,
  actor: string
) {
  await logEvent(ctx, {
    applicationId: application._id,
    eventType: "attendee_profile_updated",
    payload: buildAttendeeProfileUpdatedPayload({
      email: application.email,
      section,
      fields,
    }),
    actor,
  });
  await upsertOpsSignupRow(ctx, application._id);
}

type SaveStatusArgs = {
  hasTicket: boolean;
  arrival: string;
  arrivalTime: ArrivalDepartureTime;
  departure: string;
  departureTime: ArrivalDepartureTime;
  earlyDepartureReason?: string;
};

type SaveStatusOptions = {
  allowReviewApprovalTransition?: boolean;
  rejectConfirmedEarlyDeparture?: boolean;
};

async function saveStatusForApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  args: SaveStatusArgs,
  actor: string,
  options: SaveStatusOptions = {}
) {
  if (!args.arrival || !args.departure) {
    throw new Error("Arrival and departure dates are required");
  }
  if (args.departure < args.arrival) {
    throw new Error("Departure cannot be before arrival");
  }

  const cutoff = await getDepartureCutoff(ctx);
  const early = isEarlyDeparture(
    args.departure,
    args.departureTime,
    cutoff
  );
  const reason = args.earlyDepartureReason?.trim();
  if (early && !reason) {
    throw new Error(
      "Please explain why you are leaving before build is complete"
    );
  }
  const preservesApprovedEarlyDeparture =
    early &&
    application.earlyDepartureRequested &&
    application.departure === args.departure &&
    application.departureTime === args.departureTime;
  if (
    early &&
    options.rejectConfirmedEarlyDeparture &&
    application.status === "confirmed" &&
    !preservesApprovedEarlyDeparture
  ) {
    throw new Error("You cannot change a confirmed member's departure date to before the cutoff date");
  }

  const previousStatus = application.status;
  let status = application.status;
  let paymentAllowed = application.paymentAllowed;
  const allowReviewApprovalTransition = options.allowReviewApprovalTransition ?? true;
  if (
    early &&
    application.status === "pending_payment" &&
    !preservesApprovedEarlyDeparture
  ) {
    status = "needs_ops_review";
    paymentAllowed = false;
  } else if (
    !early &&
    application.status === "needs_ops_review" &&
    allowReviewApprovalTransition
  ) {
    status = "pending_payment";
    paymentAllowed = true;
  }

  await ctx.db.patch(application._id, {
    arrival: args.arrival,
    arrivalTime: args.arrivalTime,
    departure: args.departure,
    departureTime: args.departureTime,
    earlyDepartureRequested: early,
    earlyDepartureReason: early ? reason : undefined,
    status,
    paymentAllowed,
    updatedAt: Date.now(),
  });

  const profile = await getOrCreateProfile(ctx, application);
  await ctx.db.patch(profile._id, {
    hasTicket: args.hasTicket,
    updatedAt: Date.now(),
  });

  if (early) {
    await logEvent(ctx, {
      applicationId: application._id,
      eventType: "invalid_departure",
      payload: buildInvalidDeparturePayload({
        email: application.email,
        requestedDeparture: args.departure,
        cutoffDate: cutoff,
      }),
      actor,
    });
  }

  await finalizeSectionSave(ctx, application, "status", {
    hasTicket: args.hasTicket,
    arrival: args.arrival,
    departure: args.departure,
    departureTime: args.departureTime,
    earlyDepartureRequested: early,
  }, actor);

  return {
    requiresOpsReview: early && status === "needs_ops_review",
    paymentRestored:
      previousStatus === "needs_ops_review" &&
      status === "pending_payment" &&
      paymentAllowed === true,
  };
}

type SaveBurnsEmergencyArgs = {
  numBurnsAttended: number;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
};

async function saveBurnsEmergencyForApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  args: SaveBurnsEmergencyArgs,
  actor: string
) {
  if (!Number.isInteger(args.numBurnsAttended) || args.numBurnsAttended < 0) {
    throw new Error("Number of burns must be a whole number of 0 or more");
  }
  const name = args.emergencyContactName.trim();
  if (!name) {
    throw new Error("Emergency contact name is required");
  }
  if (!isValidE164Phone(args.emergencyContactPhone)) {
    throw new Error(
      "Please enter a complete emergency contact phone number including country code"
    );
  }
  const email = args.emergencyContactEmail?.trim();
  if (email && !email.includes("@")) {
    throw new Error("Emergency contact email looks invalid");
  }

  const profile = await getOrCreateProfile(ctx, application);
  await ctx.db.patch(profile._id, {
    numBurnsAttended: args.numBurnsAttended,
    emergencyContactName: name,
    emergencyContactPhone: args.emergencyContactPhone,
    emergencyContactEmail: email || undefined,
    updatedAt: Date.now(),
  });

  await finalizeSectionSave(ctx, application, "burnsEmergency", {
    numBurnsAttended: args.numBurnsAttended,
    emergencyContactName: name,
  }, actor);
}

type SaveTransportArgs = {
  arrivalMode: Doc<"attendee_profiles">["arrivalMode"];
  departureMode: Doc<"attendee_profiles">["departureMode"];
  vehicleId?: Id<"vehicles">;
  vehiclePassStatus: NonNullable<Doc<"attendee_profiles">["vehiclePassStatus"]>;
  bikeStatus: NonNullable<Doc<"attendee_profiles">["bikeStatus"]>;
};

async function saveTransportForApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  args: SaveTransportArgs,
  actor: string
) {
  const needsVehicle =
    VEHICLE_TRAVEL_MODES.includes(args.arrivalMode ?? "") ||
    VEHICLE_TRAVEL_MODES.includes(args.departureMode ?? "");

  if (needsVehicle && !args.vehicleId) {
    throw new Error("Please select or add the vehicle you are traveling in");
  }
  if (args.vehicleId) {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error("Selected vehicle no longer exists");
    }
  }

  const profile = await getOrCreateProfile(ctx, application);
  await ctx.db.patch(profile._id, {
    arrivalMode: args.arrivalMode,
    departureMode: args.departureMode,
    vehicleId: needsVehicle ? args.vehicleId : undefined,
    vehiclePassStatus: args.vehiclePassStatus,
    bikeStatus: args.bikeStatus,
    updatedAt: Date.now(),
  });

  await finalizeSectionSave(ctx, application, "transport", {
    arrivalMode: args.arrivalMode,
    departureMode: args.departureMode,
    vehiclePassStatus: args.vehiclePassStatus,
    bikeStatus: args.bikeStatus,
  }, actor);
}

type SaveSleepingArgs = {
  sleepingType: NonNullable<Doc<"attendee_profiles">["sleepingType"]>;
  sleepingVehicleId?: Id<"vehicles">;
  sleepingGroupId?: Id<"sleeping_groups">;
};

async function saveSleepingForApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  args: SaveSleepingArgs,
  actor: string
) {
  if (args.sleepingType === "rv_trailer_vehicle") {
    if (!args.sleepingVehicleId) {
      throw new Error("Please select which RV/trailer/vehicle you are sleeping in");
    }
    const vehicle = await ctx.db.get(args.sleepingVehicleId);
    if (!vehicle) {
      throw new Error("Selected vehicle no longer exists");
    }
  }
  if (args.sleepingType === "own_shiftpod_or_tent") {
    if (!args.sleepingGroupId) {
      throw new Error("Please select or add your shiftpod/tent");
    }
    const group = await ctx.db.get(args.sleepingGroupId);
    if (!group) {
      throw new Error("Selected shiftpod/tent no longer exists");
    }
  }

  const profile = await getOrCreateProfile(ctx, application);
  await ctx.db.patch(profile._id, {
    sleepingType: args.sleepingType,
    sleepingVehicleId:
      args.sleepingType === "rv_trailer_vehicle" ? args.sleepingVehicleId : undefined,
    sleepingGroupId:
      args.sleepingType === "own_shiftpod_or_tent" ? args.sleepingGroupId : undefined,
    updatedAt: Date.now(),
  });

  await finalizeSectionSave(ctx, application, "sleeping", {
    sleepingType: args.sleepingType,
  }, actor);
}

type SaveMealsArgs = {
  dietaryPreference: string;
  allergyFlag: boolean;
  allergyNotes?: string;
};

async function saveMealsForApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  args: SaveMealsArgs,
  actor: string
) {
  if (!(DIETARY_PREFERENCES as string[]).includes(args.dietaryPreference)) {
    throw new Error("Please select a valid dietary preference");
  }
  const notes = args.allergyNotes?.trim();
  if (args.allergyFlag && !notes) {
    throw new Error("Please describe your food allergies");
  }

  await ctx.db.patch(application._id, {
    dietaryPreference: args.dietaryPreference,
    allergyFlag: args.allergyFlag,
    allergyNotes: args.allergyFlag ? notes : undefined,
    updatedAt: Date.now(),
  });

  await getOrCreateProfile(ctx, application);

  await finalizeSectionSave(ctx, application, "meals", {
    dietaryPreference: args.dietaryPreference,
    allergyFlag: args.allergyFlag,
  }, actor);
}

type SaveCampArgs = {
  playaName?: string;
  requests?: string;
};

async function saveCampForApplication(
  ctx: MutationCtx,
  application: Doc<"applications">,
  args: SaveCampArgs,
  actor: string
) {
  const profile = await getOrCreateProfile(ctx, application);
  await ctx.db.patch(profile._id, {
    playaName: args.playaName?.trim() || undefined,
    requests: args.requests?.trim() || undefined,
    updatedAt: Date.now(),
  });

  await finalizeSectionSave(ctx, application, "camp", {
    playaName: args.playaName?.trim(),
  }, actor);
}

/**
 * The signed-in member's profile plus the application fields the profile
 * page edits in place (travel dates, meals). Null when there is no active
 * application. Before the first save, overlapping answers fall back to the
 * legacy confirmed_members record.
 */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const application = await getActiveApplication(ctx);
    if (!application) {
      return null;
    }

    const profile = await ctx.db
      .query("attendee_profiles")
      .withIndex("by_userId", (q) => q.eq("userId", application.userId))
      .first();

    const legacy = profile
      ? null
      : await ctx.db
          .query("confirmed_members")
          .withIndex("by_userId", (q) => q.eq("userId", application.userId))
          .first();

    return {
      profile: {
        hasTicket: profile
          ? profile.hasTicket
          : legacy?.hasBurningManTicket === true
            ? true
            : undefined,
        numBurnsAttended: profile?.numBurnsAttended,
        emergencyContactName: profile?.emergencyContactName,
        emergencyContactPhone: profile?.emergencyContactPhone,
        emergencyContactEmail: profile?.emergencyContactEmail,
        arrivalMode: profile?.arrivalMode,
        departureMode: profile?.departureMode,
        vehicleId: profile?.vehicleId,
        vehiclePassStatus: profile
          ? profile.vehiclePassStatus
          : legacy?.hasVehiclePass === true
            ? ("have" as const)
            : undefined,
        bikeStatus: profile?.bikeStatus,
        sleepingType: profile?.sleepingType,
        sleepingVehicleId: profile?.sleepingVehicleId,
        sleepingGroupId: profile?.sleepingGroupId,
        playaName: profile?.playaName,
        profilePhotoStorageId: profile?.profilePhotoStorageId,
        profilePhotoUrl: profile?.profilePhotoStorageId
          ? await ctx.storage.getUrl(profile.profilePhotoStorageId)
          : null,
        requests: profile ? profile.requests : (legacy?.requests ?? legacy?.notes),
      },
      application: {
        status: application.status,
        memberType: application.memberType ?? "alumni",
        arrival: application.arrival,
        arrivalTime: application.arrivalTime,
        departure: application.departure,
        departureTime: application.departureTime,
        earlyDepartureRequested: application.earlyDepartureRequested,
        earlyDepartureReason: application.earlyDepartureReason,
        dietaryPreference: application.dietaryPreference,
        allergyFlag: application.allergyFlag,
        allergyNotes: application.allergyNotes,
      },
    };
  },
});

/**
 * Status & Confirmation: ticket, arrival/departure dates + windows, early
 * departure reason. Editing the departure re-runs the window-aware early
 * rule and moves the application through the same status transitions the
 * sign-up flow uses.
 */
export const saveStatus = mutation({
  args: {
    hasTicket: v.boolean(),
    arrival: v.string(),
    arrivalTime: arrivalDepartureTime,
    departure: v.string(),
    departureTime: arrivalDepartureTime,
    earlyDepartureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);
    return await saveStatusForApplication(ctx, application, args, application.email);
  },
});

export const saveBurnsEmergency = mutation({
  args: {
    numBurnsAttended: v.number(),
    emergencyContactName: v.string(),
    emergencyContactPhone: v.string(),
    emergencyContactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);
    await saveBurnsEmergencyForApplication(ctx, application, args, application.email);
  },
});

export const saveTransport = mutation({
  args: {
    arrivalMode: travelModeValidator,
    departureMode: travelModeValidator,
    vehicleId: v.optional(v.id("vehicles")),
    vehiclePassStatus: vehiclePassStatusValidator,
    bikeStatus: bikeStatusValidator,
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);
    await saveTransportForApplication(ctx, application, args, application.email);
  },
});

export const saveSleeping = mutation({
  args: {
    sleepingType: sleepingTypeValidator,
    sleepingVehicleId: v.optional(v.id("vehicles")),
    sleepingGroupId: v.optional(v.id("sleeping_groups")),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);
    await saveSleepingForApplication(ctx, application, args, application.email);
  },
});

/**
 * Meals live on the application (collected at sign-up) — edited in place
 * here rather than duplicated on the profile.
 */
export const saveMeals = mutation({
  args: {
    dietaryPreference: v.string(),
    allergyFlag: v.boolean(),
    allergyNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);
    await saveMealsForApplication(ctx, application, args, application.email);
  },
});

export const opsSaveStatus = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    hasTicket: v.boolean(),
    arrival: v.string(),
    arrivalTime: arrivalDepartureTime,
    departure: v.string(),
    departureTime: arrivalDepartureTime,
    earlyDepartureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplicationById(ctx, args.applicationId);
    return await saveStatusForApplication(ctx, application, {
      hasTicket: args.hasTicket,
      arrival: args.arrival,
      arrivalTime: args.arrivalTime,
      departure: args.departure,
      departureTime: args.departureTime,
      earlyDepartureReason: args.earlyDepartureReason,
    }, "ops", {
      allowReviewApprovalTransition: true,
      rejectConfirmedEarlyDeparture: true,
    });
  },
});

export const opsSaveBurnsEmergency = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    numBurnsAttended: v.number(),
    emergencyContactName: v.string(),
    emergencyContactPhone: v.string(),
    emergencyContactEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplicationById(ctx, args.applicationId);
    await saveBurnsEmergencyForApplication(ctx, application, {
      numBurnsAttended: args.numBurnsAttended,
      emergencyContactName: args.emergencyContactName,
      emergencyContactPhone: args.emergencyContactPhone,
      emergencyContactEmail: args.emergencyContactEmail,
    }, "ops");
  },
});

export const opsSaveTransport = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    arrivalMode: travelModeValidator,
    departureMode: travelModeValidator,
    vehicleId: v.optional(v.id("vehicles")),
    vehiclePassStatus: vehiclePassStatusValidator,
    bikeStatus: bikeStatusValidator,
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplicationById(ctx, args.applicationId);
    await saveTransportForApplication(ctx, application, {
      arrivalMode: args.arrivalMode,
      departureMode: args.departureMode,
      vehicleId: args.vehicleId,
      vehiclePassStatus: args.vehiclePassStatus,
      bikeStatus: args.bikeStatus,
    }, "ops");
  },
});

export const opsSaveSleeping = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    sleepingType: sleepingTypeValidator,
    sleepingVehicleId: v.optional(v.id("vehicles")),
    sleepingGroupId: v.optional(v.id("sleeping_groups")),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplicationById(ctx, args.applicationId);
    await saveSleepingForApplication(ctx, application, {
      sleepingType: args.sleepingType,
      sleepingVehicleId: args.sleepingVehicleId,
      sleepingGroupId: args.sleepingGroupId,
    }, "ops");
  },
});

export const opsSaveMeals = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    dietaryPreference: v.string(),
    allergyFlag: v.boolean(),
    allergyNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplicationById(ctx, args.applicationId);
    await saveMealsForApplication(ctx, application, {
      dietaryPreference: args.dietaryPreference,
      allergyFlag: args.allergyFlag,
      allergyNotes: args.allergyNotes,
    }, "ops");
  },
});

export const opsSaveCamp = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    playaName: v.optional(v.string()),
    requests: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplicationById(ctx, args.applicationId);
    await saveCampForApplication(ctx, application, {
      playaName: args.playaName,
      requests: args.requests,
    }, "ops");
  },
});

/**
 * One row per active member with the full profile spread, resolved
 * vehicle/sleeping names, and computed completeness — for the ops table
 * and CSV export.
 */
export const listForOps = query({
  args: {
    opsPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.opsPassword) {
      return [];
    }
    requireOpsPassword(args.opsPassword);

    const applications = (await ctx.db.query("applications").collect()).filter(
      countsForLogistics
    );
    const profiles = await ctx.db.query("attendee_profiles").collect();
    const profilesByUserId = new Map(profiles.map((p) => [p.userId, p]));
    const legacyRecords = await ctx.db.query("confirmed_members").collect();
    const legacyByUserId = new Map(legacyRecords.map((l) => [l.userId, l]));
    const vehicles = await ctx.db.query("vehicles").collect();
    const vehiclesById = new Map(vehicles.map((v) => [v._id, v]));
    const groups = await ctx.db.query("sleeping_groups").collect();
    const groupsById = new Map(groups.map((g) => [g._id, g]));

    const cutoffConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "departureCutoff"))
      .first();
    const departureCutoff = cutoffConfig?.value ?? CONFIG_DEFAULTS.departureCutoff;

    return applications
      .map((application) => {
        const profile = profilesByUserId.get(application.userId);
        const legacy = profile ? undefined : legacyByUserId.get(application.userId);

        // Same legacy fallback as getMine: only affirmative old answers count.
        const hasTicket = profile
          ? profile.hasTicket
          : legacy?.hasBurningManTicket === true
            ? true
            : undefined;
        const vehiclePassStatus = profile
          ? profile.vehiclePassStatus
          : legacy?.hasVehiclePass === true
            ? ("have" as const)
            : undefined;
        const requests = profile
          ? profile.requests
          : (legacy?.requests ?? legacy?.notes);

        const vehicle = profile?.vehicleId
          ? vehiclesById.get(profile.vehicleId)
          : undefined;
        const sleepingVehicle = profile?.sleepingVehicleId
          ? vehiclesById.get(profile.sleepingVehicleId)
          : undefined;
        const sleepingGroup = profile?.sleepingGroupId
          ? groupsById.get(profile.sleepingGroupId)
          : undefined;

        const completeness = computeProfileCompleteness(
          {
            ...profile,
            hasTicket,
            vehiclePassStatus,
          },
          {
            departure: application.departure,
            departureTime: application.departureTime,
            earlyDepartureReason: application.earlyDepartureReason,
            dietaryPreference: application.dietaryPreference,
            allergyFlag: application.allergyFlag,
            allergyNotes: application.allergyNotes,
          },
          departureCutoff
        );

        return {
          applicationId: application._id,
          profileId: profile?._id,
          fullName: `${application.firstName} ${application.lastName}`.trim(),
          email: application.email,
          phone: application.phone,
          memberType: application.memberType ?? "alumni",
          status: application.status,
          arrival: application.arrival,
          arrivalTime: application.arrivalTime,
          departure: application.departure,
          departureTime: application.departureTime,
          earlyDepartureRequested: application.earlyDepartureRequested,
          earlyDepartureReason: application.earlyDepartureReason,
          hasTicket,
          numBurnsAttended: profile?.numBurnsAttended,
          emergencyContactName: profile?.emergencyContactName,
          emergencyContactPhone: profile?.emergencyContactPhone,
          emergencyContactEmail: profile?.emergencyContactEmail,
          arrivalMode: profile?.arrivalMode,
          departureMode: profile?.departureMode,
          vehicleId: profile?.vehicleId,
          vehicleName: vehicle?.name,
          vehicleLengthFt: vehicle?.lengthFt,
          vehiclePassStatus,
          bikeStatus: profile?.bikeStatus,
          sleepingType: profile?.sleepingType,
          sleepingVehicleId: profile?.sleepingVehicleId,
          sleepingGroupId: profile?.sleepingGroupId,
          sleepingPlace: sleepingVehicle
            ? sleepingDisplayName(sleepingVehicle)
            : sleepingGroup?.name,
          dietaryPreference: application.dietaryPreference,
          allergyFlag: application.allergyFlag,
          allergyNotes: application.allergyNotes,
          playaName: profile?.playaName,
          requests,
          completeCount: completeness.completeCount,
          totalCount: completeness.totalCount,
          missingSections: completeness.sections
            .filter((section) => !section.complete)
            .map((section) => section.label),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

export const listEditOptionsForOps = query({
  args: {
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);

    const applications = (await ctx.db.query("applications").collect()).filter(
      countsForLogistics
    );
    const activeApplicationIds = new Set(applications.map((application) => application._id));
    const profiles = (await ctx.db.query("attendee_profiles").collect()).filter(
      (profile) => activeApplicationIds.has(profile.applicationId)
    );
    const vehicles = await ctx.db.query("vehicles").collect();
    const sleepingGroups = await ctx.db.query("sleeping_groups").collect();

    return {
      vehicles: vehicles
        .map((vehicle) => {
          const riderCount = profiles.filter(
            (profile) => profile.vehicleId === vehicle._id
          ).length;
          const sleeperCount = profiles.filter(
            (profile) => profile.sleepingVehicleId === vehicle._id
          ).length;
          return {
            _id: vehicle._id,
            name: vehicle.name,
            vehicleType: vehicle.vehicleType,
            lengthFt: vehicle.lengthFt,
            description: vehicle.description,
            trailerName: vehicle.trailerName,
            licensePlate: vehicle.licensePlate,
            riderCount,
            sleeperCount,
            createdByMe: false,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
      sleepingGroups: sleepingGroups
        .map((group) => ({
          _id: group._id,
          name: group.name,
          sleeperCount: profiles.filter(
            (profile) => profile.sleepingGroupId === group._id
          ).length,
          createdByMe: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

/**
 * Profile photos live in Convex file storage. The browser uploads directly
 * to a short-lived URL from generatePhotoUploadUrl, then hands the resulting
 * storageId to savePhoto. Both are gated to members with an active
 * application, same as every other profile mutation.
 */
export const generatePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireActiveApplication(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const savePhoto = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);

    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) {
      throw new Error("Uploaded photo not found — please try again");
    }
    if (!metadata.contentType?.startsWith("image/")) {
      throw new Error("Profile photo must be an image");
    }
    if (metadata.size > MAX_PHOTO_BYTES) {
      throw new Error("Profile photo must be under 5 MB");
    }

    const profile = await getOrCreateProfile(ctx, application);
    // Replacing a photo orphans the old file — delete it.
    if (
      profile.profilePhotoStorageId &&
      profile.profilePhotoStorageId !== args.storageId
    ) {
      await ctx.storage.delete(profile.profilePhotoStorageId);
    }
    await ctx.db.patch(profile._id, {
      profilePhotoStorageId: args.storageId,
      updatedAt: Date.now(),
    });

    await finalizeSectionSave(ctx, application, "photo", {
      profilePhotoUpdated: true,
    }, application.email);
  },
});

/**
 * Member-facing roster: who's coming, when they arrive/depart, and how
 * they're traveling. Includes every active application (cancelled and
 * rejected members never appear); non-confirmed members are flagged with
 * a coarse "pending" so the exact payment status stays ops-only. Gated to
 * members with an active application, same as the vehicle/sleeping
 * pickers. Deliberately excludes contact info, emergency contacts,
 * allergy notes, early-departure reasons, and requests — those stay
 * ops-only (see listForOps). Dietary preferences are only exposed as
 * camp-wide counts, never per person.
 */
export const listRoster = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getActiveApplication(ctx);
    if (!viewer) {
      return null;
    }

    const active = (await ctx.db.query("applications").collect()).filter(
      countsForLogistics
    );
    const profiles = await ctx.db.query("attendee_profiles").collect();
    const profilesByUserId = new Map(profiles.map((p) => [p.userId, p]));
    const vehicles = await ctx.db.query("vehicles").collect();
    const vehiclesById = new Map(vehicles.map((v) => [v._id, v]));
    const groups = await ctx.db.query("sleeping_groups").collect();
    const groupsById = new Map(groups.map((g) => [g._id, g]));

    const dietaryCounts: Record<string, number> = {};
    let allergyCount = 0;
    for (const application of active) {
      dietaryCounts[application.dietaryPreference] =
        (dietaryCounts[application.dietaryPreference] ?? 0) + 1;
      if (application.allergyFlag) {
        allergyCount += 1;
      }
    }

    const members = (
      await Promise.all(
        active.map(async (application) => {
          const profile = profilesByUserId.get(application.userId);
          const vehicle = profile?.vehicleId
            ? vehiclesById.get(profile.vehicleId)
            : undefined;
          const sleepingVehicle = profile?.sleepingVehicleId
            ? vehiclesById.get(profile.sleepingVehicleId)
            : undefined;
          const sleepingGroup = profile?.sleepingGroupId
            ? groupsById.get(profile.sleepingGroupId)
            : undefined;

          return {
            applicationId: application._id,
            fullName: `${application.firstName} ${application.lastName}`.trim(),
            playaName: profile?.playaName,
            photoUrl: profile?.profilePhotoStorageId
              ? await ctx.storage.getUrl(profile.profilePhotoStorageId)
              : null,
            memberType: application.memberType ?? ("alumni" as const),
            isConfirmed: application.status === "confirmed",
            isViewer: application.userId === viewer.userId,
            arrival: application.arrival,
            arrivalTime: application.arrivalTime,
            departure: application.departure,
            departureTime: application.departureTime,
            arrivalMode: profile?.arrivalMode,
            departureMode: profile?.departureMode,
            vehicleName: vehicle?.name,
            sleepingType: profile?.sleepingType,
            sleepingPlace: sleepingVehicle
              ? sleepingDisplayName(sleepingVehicle)
              : sleepingGroup?.name,
            numBurnsAttended: profile?.numBurnsAttended,
          };
        })
      )
    ).sort(
      (a, b) =>
        a.arrival.localeCompare(b.arrival) ||
        a.fullName.localeCompare(b.fullName)
    );

    return {
      members,
      stats: {
        totalCount: members.length,
        confirmedCount: members.filter((m) => m.isConfirmed).length,
        pendingCount: members.filter((m) => !m.isConfirmed).length,
        alumniCount: members.filter((m) => m.memberType === "alumni").length,
        newbieCount: members.filter((m) => m.memberType === "newbie").length,
        dietaryCounts,
        allergyCount,
      },
    };
  },
});

export const saveCamp = mutation({
  args: {
    playaName: v.optional(v.string()),
    requests: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);
    await saveCampForApplication(ctx, application, args, application.email);
  },
});
