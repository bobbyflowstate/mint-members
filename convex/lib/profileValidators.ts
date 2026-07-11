import { v } from "convex/values";
import { QueryCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Convex validators for attendee profile enums. Values must stay in sync
 * with the unions in convex/schema.ts and the labels in
 * src/lib/attendeeProfile/options.ts.
 */
export const travelModeValidator = v.union(
  v.literal("driving_own_vehicle"),
  v.literal("riding_with_attendee"),
  v.literal("burner_express"),
  v.literal("flying"),
  v.literal("not_sure")
);

export const vehicleTypeValidator = v.union(
  v.literal("rv"),
  v.literal("vehicle_with_trailer"),
  v.literal("vehicle_no_trailer")
);

export const vehiclePassStatusValidator = v.union(
  v.literal("have"),
  v.literal("need"),
  v.literal("have_extra")
);

export const bikeStatusValidator = v.union(
  v.literal("bringing_own"),
  v.literal("renting_third_party"),
  v.literal("borrow_from_camp")
);

export const sleepingTypeValidator = v.union(
  v.literal("rv_trailer_vehicle"),
  v.literal("own_shiftpod_or_tent"),
  v.literal("need_camp_shiftpod")
);

/**
 * The single definition of which applications count for logistics: not
 * cancelled, not rejected. Any status in between (draft through confirmed)
 * counts. Used both for profile access and for occupancy counts.
 */
export function countsForLogistics(
  application: { cancelled?: boolean; status: string } | null | undefined
): boolean {
  return Boolean(
    application && !application.cancelled && application.status !== "rejected"
  );
}

/**
 * All attendee profiles whose linked application is still active — the set
 * that should count toward vehicle/sleeping occupancy. Profiles are never
 * deleted, so a cancelled or rejected member's row would otherwise keep
 * inflating rider/sleeper counts.
 */
export async function listActiveProfiles(ctx: QueryCtx) {
  const profiles = await ctx.db.query("attendee_profiles").collect();
  const results = [];
  for (const profile of profiles) {
    const application = await ctx.db.get(profile.applicationId);
    if (countsForLogistics(application)) {
      results.push(profile);
    }
  }
  return results;
}

/**
 * The signed-in user's active application: exists, not cancelled, not
 * rejected. Profile data is open to all members with a live application,
 * not just confirmed ones.
 */
export async function getActiveApplication(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  const application = await ctx.db
    .query("applications")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (!countsForLogistics(application)) {
    return null;
  }

  return application;
}

export async function requireActiveApplication(ctx: QueryCtx) {
  const application = await getActiveApplication(ctx);
  if (!application) {
    throw new Error(
      "You need an active application to update attendee profile details"
    );
  }
  return application;
}
