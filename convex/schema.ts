import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Application status values:
 * - draft: Initial state when form is being filled
 * - pending_payment: Form submitted, awaiting payment
 * - needs_ops_review: Early departure requested, needs ops approval
 * - payment_processing: Stripe checkout initiated
 * - confirmed: Payment successful, reservation confirmed
 * - rejected: Application rejected by ops
 */
const applicationStatus = v.union(
  v.literal("draft"),
  v.literal("pending_payment"),
  v.literal("needs_ops_review"),
  v.literal("payment_processing"),
  v.literal("confirmed"),
  v.literal("rejected")
);

/**
 * Ops authorization status for early departure requests
 */
const opsAuthorizationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied")
);

/**
 * Event types for audit logging
 */
const eventType = v.union(
  v.literal("form_submitted"),
  v.literal("invalid_departure"),
  v.literal("payment_initiated"),
  v.literal("payment_success"),
  v.literal("payment_failed"),
  v.literal("ops_override_granted"),
  v.literal("ops_override_denied"),
  v.literal("webhook_error"),
  v.literal("mutation_failed")
);

export default defineSchema({
  ...authTables,

  /**
   * Applications table - stores member reservation applications
   */
  applications: defineTable({
    userId: v.id("users"), // Link to authenticated user
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.string(),
    arrival: v.string(), // ISO date string
    departure: v.string(), // ISO date string
    status: applicationStatus,
    dietaryPreference: v.string(),
    allergyFlag: v.boolean(),
    allergyNotes: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    earlyDepartureRequested: v.boolean(),
    paymentAllowed: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    .index("by_arrival", ["arrival"])
    .index("by_departure", ["departure"]),

  /**
   * Ops authorizations - tracks approval/denial of early departure requests
   */
  ops_authorizations: defineTable({
    applicationId: v.id("applications"),
    approverEmail: v.string(),
    status: opsAuthorizationStatus,
    notes: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_status", ["status"]),

  /**
   * Event logs - audit trail for all important events
   */
  event_logs: defineTable({
    applicationId: v.optional(v.id("applications")),
    stripeSessionId: v.optional(v.string()),
    eventType: eventType,
    payload: v.string(), // JSON stringified payload
    actor: v.string(), // "system", "client", email, etc.
    createdAt: v.number(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_eventType", ["eventType"]),

  /**
   * Config table - stores key/value configuration
   * Keys: departureCutoff, burningManStartDate, burningManEndDate, 
   *       dementhaStartDate, dementhaEndDate, reservationFeeCents
   */
  config: defineTable({
    key: v.string(),
    value: v.string(), // JSON stringified value
    description: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
