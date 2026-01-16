import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Maximum payload size in characters (to prevent oversized logs)
 */
const MAX_PAYLOAD_SIZE = 10000;

/**
 * Store an event in the event_logs table
 */
export const storeEvent = mutation({
  args: {
    applicationId: v.optional(v.id("applications")),
    stripeSessionId: v.optional(v.string()),
    eventType: v.union(
      v.literal("form_submitted"),
      v.literal("invalid_departure"),
      v.literal("payment_initiated"),
      v.literal("payment_success"),
      v.literal("payment_failed"),
      v.literal("ops_override_granted"),
      v.literal("ops_override_denied"),
      v.literal("webhook_error"),
      v.literal("mutation_failed")
    ),
    payload: v.string(),
    actor: v.string(),
  },
  handler: async (ctx, args) => {
    // Truncate payload if too large
    let payload = args.payload;
    if (payload.length > MAX_PAYLOAD_SIZE) {
      payload = payload.substring(0, MAX_PAYLOAD_SIZE) + "...[truncated]";
    }

    const eventId = await ctx.db.insert("event_logs", {
      applicationId: args.applicationId,
      stripeSessionId: args.stripeSessionId,
      eventType: args.eventType,
      payload,
      actor: args.actor,
      createdAt: Date.now(),
    });

    return eventId;
  },
});

/**
 * Query events by application ID
 */
export const getByApplicationId = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("event_logs")
      .withIndex("by_applicationId", (q) =>
        q.eq("applicationId", args.applicationId)
      )
      .order("desc")
      .collect();
  },
});

/**
 * Query recent events with pagination
 */
export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("event_logs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

/**
 * Query events by type
 */
export const getByEventType = query({
  args: {
    eventType: v.union(
      v.literal("form_submitted"),
      v.literal("invalid_departure"),
      v.literal("payment_initiated"),
      v.literal("payment_success"),
      v.literal("payment_failed"),
      v.literal("ops_override_granted"),
      v.literal("ops_override_denied"),
      v.literal("webhook_error"),
      v.literal("mutation_failed")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("event_logs")
      .withIndex("by_eventType", (q) => q.eq("eventType", args.eventType))
      .order("desc")
      .take(limit);
  },
});
