import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  logEvent,
  buildFormSubmittedPayload,
  buildInvalidDeparturePayload,
  buildOpsOverrideGrantedPayload,
  buildOpsOverrideDeniedPayload,
  buildMutationFailedPayload,
} from "./lib/events";
import { CONFIG_DEFAULTS, parseMaxMembers } from "./config";

/**
 * Create a draft application from form submission
 * Requires authentication. Links application to the authenticated user.
 */
/**
 * Time of arrival/departure options
 */
const arrivalDepartureTime = v.union(
  v.literal("12:01 am to 11.00 am"),
  v.literal("11.01 am to 6.00 pm"),
  v.literal("6.01 pm to 12.00 am")
);

export const createDraftApplication = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    arrival: v.string(),
    arrivalTime: arrivalDepartureTime,
    departure: v.string(),
    departureTime: arrivalDepartureTime,
    dietaryPreference: v.string(),
    allergyFlag: v.boolean(),
    allergyNotes: v.optional(v.string()),
    earlyDepartureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authentication
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to submit an application");
    }

    // Get user data to get their email
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      throw new Error("Unable to retrieve user email. Please ensure your account has an email associated.");
    }
    const userEmail = user.email.toLowerCase();

    // Check allowlist enforcement
    const allowlistConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "allowlistEnabled"))
      .first();
    const allowlistEnabled = allowlistConfig?.value === "true";

    if (allowlistEnabled) {
      const emailEntry = await ctx.db
        .query("email_allowlist")
        .withIndex("by_email", (q) => q.eq("email", userEmail))
        .first();

      if (!emailEntry) {
        throw new Error("Applications are currently only open to alumni members.");
      }
    }

    // Check if user already has an application
    const existingApplication = await ctx.db
      .query("applications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingApplication) {
      throw new Error("You already have an application. Please contact us if you need to make changes.");
    }

    const now = Date.now();

    // Get departure cutoff from config (database override or default)
    const cutoffConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "departureCutoff"))
      .first();
    const departureCutoff = cutoffConfig?.value ?? CONFIG_DEFAULTS.departureCutoff;

    // Check if departure is before cutoff (requires ops review)
    const departureDate = new Date(args.departure);
    const cutoffDate = new Date(departureCutoff);
    const requiresOpsReview = departureDate < cutoffDate;

    // Determine initial status and payment allowed
    const status = requiresOpsReview ? "needs_ops_review" : "pending_payment";
    const paymentAllowed = !requiresOpsReview;

    try {
      // Insert the application
      const applicationId = await ctx.db.insert("applications", {
        userId,
        firstName: args.firstName.trim(),
        lastName: args.lastName.trim(),
        email: userEmail,
        phone: args.phone.trim(),
        arrival: args.arrival,
        arrivalTime: args.arrivalTime,
        departure: args.departure,
        departureTime: args.departureTime,
        status,
        dietaryPreference: args.dietaryPreference,
        allergyFlag: args.allergyFlag,
        allergyNotes: args.allergyNotes?.trim(),
        earlyDepartureRequested: requiresOpsReview,
        earlyDepartureReason: requiresOpsReview ? args.earlyDepartureReason?.trim() : undefined,
        paymentAllowed,
        createdAt: now,
        updatedAt: now,
      });

      // Log form submitted event
      await logEvent(ctx, {
        applicationId,
        eventType: "form_submitted",
        payload: buildFormSubmittedPayload({
          email: userEmail,
          firstName: args.firstName,
          lastName: args.lastName,
          arrival: args.arrival,
          departure: args.departure,
        }),
        actor: "system",
      });

      // Log invalid departure event if early departure requested
      if (requiresOpsReview) {
        await logEvent(ctx, {
          applicationId,
          eventType: "invalid_departure",
          payload: buildInvalidDeparturePayload({
            email: userEmail,
            requestedDeparture: args.departure,
            cutoffDate: departureCutoff,
          }),
          actor: "system",
        });
      }

      return {
        applicationId,
        status,
        paymentAllowed,
        requiresOpsReview,
      };
    } catch (error) {
      // Log mutation failure
      await logEvent(ctx, {
        eventType: "mutation_failed",
        payload: buildMutationFailedPayload({
          mutationName: "createDraftApplication",
          error: error instanceof Error ? error.message : "Unknown error",
          input: { email: userEmail },
        }),
        actor: "system",
      });
      throw error;
    }
  },
});

/**
 * Set ops override for an application (approve or deny early departure)
 */
export const setOpsOverride = mutation({
  args: {
    applicationId: v.id("applications"),
    approved: v.boolean(),
    approverEmail: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Get the application
    const application = await ctx.db.get(args.applicationId);
    if (!application) {
      throw new Error("Application not found");
    }

    if (application.status !== "needs_ops_review") {
      throw new Error("Application is not pending ops review");
    }

    // Create ops authorization record
    await ctx.db.insert("ops_authorizations", {
      applicationId: args.applicationId,
      approverEmail: args.approverEmail,
      status: args.approved ? "approved" : "denied",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    if (args.approved) {
      // Update application to allow payment
      await ctx.db.patch(args.applicationId, {
        status: "pending_payment",
        paymentAllowed: true,
        updatedAt: now,
      });

      // Log approval event
      await logEvent(ctx, {
        applicationId: args.applicationId,
        eventType: "ops_override_granted",
        payload: buildOpsOverrideGrantedPayload({
          email: application.email,
          approverEmail: args.approverEmail,
          requestedDeparture: application.departure,
          notes: args.notes,
        }),
        actor: args.approverEmail,
      });
    } else {
      // Update application to rejected
      await ctx.db.patch(args.applicationId, {
        status: "rejected",
        updatedAt: now,
      });

      // Log denial event
      await logEvent(ctx, {
        applicationId: args.applicationId,
        eventType: "ops_override_denied",
        payload: buildOpsOverrideDeniedPayload({
          email: application.email,
          approverEmail: args.approverEmail,
          requestedDeparture: application.departure,
          reason: args.notes,
        }),
        actor: args.approverEmail,
      });
    }

    return {
      success: true,
      newStatus: args.approved ? "pending_payment" : "rejected",
      paymentAllowed: args.approved,
    };
  },
});

/**
 * Get capacity status — how many confirmed reservations vs. the max
 * Used by frontend to show sold-out state and by backend to enforce the hard cap
 */
export const getCapacityStatus = query({
  args: {},
  handler: async (ctx) => {
    // Get max members from config (database override or default)
    const maxMembersConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "maxMembers"))
      .first();
    const maxMembers = parseMaxMembers(
      maxMembersConfig?.value ?? CONFIG_DEFAULTS.maxMembers
    );

    // Count confirmed applications (paid reservations)
    const confirmed = await ctx.db
      .query("applications")
      .withIndex("by_status", (q) => q.eq("status", "confirmed"))
      .collect();
    const confirmedCount = confirmed.length;

    // 0 means unlimited
    const isFull = maxMembers > 0 && confirmedCount >= maxMembers;
    const spotsRemaining = maxMembers > 0 ? Math.max(0, maxMembers - confirmedCount) : null;

    return { confirmedCount, maxMembers, isFull, spotsRemaining };
  },
});

/**
 * Get application by ID
 */
export const getById = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.applicationId);
  },
});

/**
 * Get the current user's application
 */
export const getMyApplication = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    
    return await ctx.db
      .query("applications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Get application by email
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

/**
 * List applications needing ops review
 */
export const listNeedingReview = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_status", (q) => q.eq("status", "needs_ops_review"))
      .order("desc")
      .collect();
  },
});

/**
 * List all applications with optional status filter
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending_payment"),
        v.literal("needs_ops_review"),
        v.literal("payment_processing"),
        v.literal("confirmed"),
        v.literal("rejected")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    if (args.status) {
      return await ctx.db
        .query("applications")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("applications").order("desc").take(limit);
  },
});
