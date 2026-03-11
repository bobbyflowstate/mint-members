import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { normalizeConfirmedMemberDetails } from "../src/lib/confirmedMembers/normalize";
import { buildConfirmedMemberUpdatedPayload, logEvent } from "./lib/events";
import { requireOpsPassword } from "./lib/auth";
import { upsertOpsSignupRow } from "./opsSignupRows";

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const confirmedApplication = await ctx.db
      .query("applications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!confirmedApplication || confirmedApplication.status !== "confirmed") {
      return null;
    }

    const existingRecord = await ctx.db
      .query("confirmed_members")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return {
      hasBurningManTicket: existingRecord?.hasBurningManTicket ?? false,
      hasVehiclePass: existingRecord?.hasVehiclePass ?? false,
      requests: existingRecord?.requests ?? existingRecord?.notes,
    };
  },
});

export const listForOps = query({
  args: {
    opsPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.opsPassword) {
      return [];
    }

    requireOpsPassword(args.opsPassword);

    const confirmedApplications = await ctx.db
      .query("applications")
      .withIndex("by_status", (q) => q.eq("status", "confirmed"))
      .order("desc")
      .collect();

    const confirmedMembers = await ctx.db.query("confirmed_members").collect();
    const membersByApplicationId = new Map(
      confirmedMembers.map((member) => [member.applicationId, member])
    );

    return confirmedApplications.map((application) => {
      const memberRecord = membersByApplicationId.get(application._id);
      const requests = memberRecord?.requests ?? memberRecord?.notes ?? "";

      return {
        _id: application._id,
        fullName: `${application.firstName} ${application.lastName}`.trim(),
        email: application.email,
        phone: application.phone,
        requests,
        arrival: application.arrival,
        arrivalTime: application.arrivalTime,
        departure: application.departure,
        departureTime: application.departureTime,
        hasBurningManTicket: memberRecord?.hasBurningManTicket ?? false,
        hasVehiclePass: memberRecord?.hasVehiclePass ?? false,
      };
    });
  },
});

export const upsertMine = mutation({
  args: {
    hasBurningManTicket: v.optional(v.boolean()),
    hasVehiclePass: v.optional(v.boolean()),
    requests: v.optional(v.string()),
    // Backward compatibility while client regenerates types.
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update confirmed-member details");
    }

    const confirmedApplication = await ctx.db
      .query("applications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!confirmedApplication || confirmedApplication.status !== "confirmed") {
      throw new Error("Only confirmed members can update this information");
    }

    const normalized = normalizeConfirmedMemberDetails(args);
    const now = Date.now();
    const existingRecord = await ctx.db
      .query("confirmed_members")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, {
        ...normalized,
        updatedAt: now,
      });

      await logEvent(ctx, {
        applicationId: confirmedApplication._id,
        eventType: "confirmed_member_updated",
        payload: buildConfirmedMemberUpdatedPayload({
          email: confirmedApplication.email,
          hasBurningManTicket: normalized.hasBurningManTicket,
          hasVehiclePass: normalized.hasVehiclePass,
          requests: normalized.requests,
        }),
        actor: confirmedApplication.email,
      });
      await upsertOpsSignupRow(ctx, confirmedApplication._id);
      return existingRecord._id;
    }

    const recordId = await ctx.db.insert("confirmed_members", {
      userId,
      applicationId: confirmedApplication._id,
      ...normalized,
      createdAt: now,
      updatedAt: now,
    });

    await logEvent(ctx, {
      applicationId: confirmedApplication._id,
      eventType: "confirmed_member_updated",
      payload: buildConfirmedMemberUpdatedPayload({
        email: confirmedApplication.email,
        hasBurningManTicket: normalized.hasBurningManTicket,
        hasVehiclePass: normalized.hasVehiclePass,
        requests: normalized.requests,
      }),
      actor: confirmedApplication.email,
    });
    await upsertOpsSignupRow(ctx, confirmedApplication._id);

    return recordId;
  },
});
