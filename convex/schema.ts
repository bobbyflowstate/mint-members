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

const memberType = v.union(v.literal("alumni"), v.literal("newbie"));

const allowlistSource = v.union(v.literal("ops"), v.literal("sponsor_invite"));
const newbieInviteStatus = v.union(v.literal("pending"), v.literal("accepted"), v.literal("denied"));

/**
 * Ops authorization status for early departure requests
 */
const opsAuthorizationStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("denied")
);

/**
 * Time of arrival/departure options
 */
const arrivalDepartureTime = v.union(
  v.literal("12:01 am to 11.00 am"),
  v.literal("11.01 am to 6.00 pm"),
  v.literal("6.01 pm to 12.00 am")
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
  v.literal("mutation_failed"),
  v.literal("allowlist_emails_added"),
  v.literal("allowlist_email_removed"),
  v.literal("allowlist_emails_removed_bulk"),
  v.literal("capacity_exceeded"),
  v.literal("confirmed_member_updated"),
  v.literal("newbie_invited"),
  v.literal("newbie_invite_email_sent"),
  v.literal("newbie_invite_email_failed")
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
    arrivalTime: arrivalDepartureTime,
    departure: v.string(), // ISO date string
    departureTime: arrivalDepartureTime,
    status: applicationStatus,
    dietaryPreference: v.string(),
    allergyFlag: v.boolean(),
    allergyNotes: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    earlyDepartureRequested: v.boolean(),
    earlyDepartureReason: v.optional(v.string()),
    paymentAllowed: v.boolean(),
    memberType: v.optional(memberType),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_email", ["email"])
    .index("by_arrival", ["arrival"])
    .index("by_departure", ["departure"])
    .index("by_createdAt", ["createdAt"]),

  /**
   * Confirmed member details - post-confirmation logistics data
   */
  confirmed_members: defineTable({
    userId: v.id("users"),
    applicationId: v.id("applications"),
    hasBurningManTicket: v.boolean(),
    hasVehiclePass: v.boolean(),
    requests: v.optional(v.string()),
    // Backward compatibility for early records before rename.
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_applicationId", ["applicationId"]),

  /**
   * Ops signup projection rows - denormalized row per application for
   * cross-table ops querying and export.
   */
  ops_signup_rows: defineTable({
    applicationId: v.id("applications"),
    userId: v.id("users"),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    fullName: v.string(),
    phone: v.string(),
    arrival: v.string(),
    arrivalTime: arrivalDepartureTime,
    departure: v.string(),
    departureTime: arrivalDepartureTime,
    status: applicationStatus,
    paymentAllowed: v.boolean(),
    earlyDepartureRequested: v.boolean(),
    hasBurningManTicket: v.boolean(),
    hasVehiclePass: v.boolean(),
    requests: v.string(),
    memberType: v.optional(memberType),
    sponsorName: v.optional(v.string()),
    sponsorEmail: v.optional(v.string()),
    applicationCreatedAt: v.number(),
    updatedAt: v.number(),
    sourceVersion: v.number(),
  })
    .index("by_applicationId", ["applicationId"])
    .index("by_userId", ["userId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_arrival", ["arrival"])
    .index("by_departure", ["departure"])
    .index("by_createdAt", ["applicationCreatedAt"]),

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
   *       earliestArrival, latestDeparture, reservationFeeCents, campName
   */
  config: defineTable({
    key: v.string(),
    value: v.string(), // JSON stringified value
    description: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  /**
   * Email allowlist - controls who can submit applications
   */
  email_allowlist: defineTable({
    email: v.string(),        // Normalized to lowercase
    addedBy: v.string(),      // Email of ops user who added
    addedAt: v.number(),
    memberType: v.optional(memberType),
    source: v.optional(allowlistSource),
    sponsorUserId: v.optional(v.id("users")),
    sponsorApplicationId: v.optional(v.id("applications")),
    sponsorEmail: v.optional(v.string()),
    sponsorName: v.optional(v.string()),
    invitedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_addedAt", ["addedAt"]),

  newbie_invites: defineTable({
    sponsorUserId: v.id("users"),
    sponsorApplicationId: v.id("applications"),
    sponsorEmail: v.string(),
    sponsorName: v.string(),
    newbieFirstName: v.optional(v.string()),
    newbieLastName: v.optional(v.string()),
    newbieName: v.string(),
    newbieEmail: v.string(),
    newbiePhone: v.string(),
    estimatedArrival: v.optional(v.string()),
    estimatedDeparture: v.optional(v.string()),
    earlyDepartureReason: v.optional(v.string()),
    whyTheyBelong: v.string(),
    preparednessAcknowledged: v.boolean(),
    status: v.optional(newbieInviteStatus),
    allowlistEmailId: v.optional(v.id("email_allowlist")),
    applicationId: v.optional(v.id("applications")),
    approvalEmailSentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_newbieEmail", ["newbieEmail"])
    .index("by_sponsorUserId", ["sponsorUserId"])
    .index("by_createdAt", ["createdAt"]),
});
