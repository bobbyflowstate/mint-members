import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getActiveApplication,
  listActiveProfiles,
  requireActiveApplication,
} from "./lib/profileValidators";
import { buildSleepingGroupCreatedPayload, logEvent } from "./lib/events";

/**
 * Shared shiftpod/tent list, same pattern as vehicles.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const application = await getActiveApplication(ctx);
    if (!application) {
      return [];
    }

    const groups = await ctx.db.query("sleeping_groups").collect();
    // Only profiles with a live application count toward occupancy.
    const profiles = await listActiveProfiles(ctx);

    return groups
      .map((group) => ({
        _id: group._id,
        name: group.name,
        sleeperCount: profiles.filter(
          (profile) => profile.sleepingGroupId === group._id
        ).length,
        createdByMe: group.createdByUserId === application.userId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);

    const name = args.name.trim();
    if (!name) {
      throw new Error("Shiftpod / tent name is required");
    }

    const existing = await ctx.db.query("sleeping_groups").collect();
    const duplicate = existing.find(
      (group) => group.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new Error(
        `A shiftpod/tent named "${duplicate.name}" already exists — select it from the list instead`
      );
    }

    const now = Date.now();
    const groupId = await ctx.db.insert("sleeping_groups", {
      name,
      createdByUserId: application.userId,
      createdAt: now,
      updatedAt: now,
    });

    await logEvent(ctx, {
      applicationId: application._id,
      eventType: "sleeping_group_created",
      payload: buildSleepingGroupCreatedPayload({
        email: application.email,
        groupName: name,
      }),
      actor: application.email,
    });

    return groupId;
  },
});

/**
 * Whoever added a shiftpod/tent can rename it later — names are shared
 * and visible to everyone.
 */
export const update = mutation({
  args: {
    groupId: v.id("sleeping_groups"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const application = await requireActiveApplication(ctx);

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Shiftpod/tent no longer exists");
    }
    if (group.createdByUserId !== application.userId) {
      throw new Error("Only whoever added this shiftpod/tent can rename it");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Shiftpod / tent name is required");
    }

    const existing = await ctx.db.query("sleeping_groups").collect();
    const duplicate = existing.find(
      (other) =>
        other._id !== args.groupId && other.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A shiftpod/tent named "${duplicate.name}" already exists`);
    }

    await ctx.db.patch(args.groupId, {
      name,
      updatedAt: Date.now(),
    });

    await logEvent(ctx, {
      applicationId: application._id,
      eventType: "sleeping_group_updated",
      payload: {
        type: "sleeping_group_updated" as const,
        email: application.email,
        groupName: name,
        previousName: group.name,
        timestamp: new Date().toISOString(),
      },
      actor: application.email,
    });
  },
});
