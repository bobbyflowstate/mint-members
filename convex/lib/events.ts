import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Event types for audit logging
 */
export const EVENT_TYPES = [
  "form_submitted",
  "invalid_departure",
  "payment_initiated",
  "payment_success",
  "payment_failed",
  "ops_override_granted",
  "ops_override_denied",
  "webhook_error",
  "mutation_failed",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Event log details for the logEvent helper
 */
export interface EventLogDetails {
  applicationId?: Id<"applications">;
  stripeSessionId?: string;
  eventType: EventType;
  payload: Record<string, unknown>;
  actor: string;
}

/**
 * Log an event to the event_logs table
 * This is a helper that can be called from mutations
 */
export async function logEvent(
  ctx: MutationCtx,
  details: EventLogDetails
): Promise<Id<"event_logs">> {
  const payloadString = JSON.stringify(details.payload);

  return await ctx.db.insert("event_logs", {
    applicationId: details.applicationId,
    stripeSessionId: details.stripeSessionId,
    eventType: details.eventType,
    payload: payloadString,
    actor: details.actor,
    createdAt: Date.now(),
  });
}

// ============================================
// Event Payload Builders
// ============================================

/**
 * Build payload for form_submitted event
 */
export function buildFormSubmittedPayload(data: {
  email: string;
  firstName: string;
  lastName: string;
  arrival: string;
  departure: string;
}) {
  return {
    type: "form_submitted" as const,
    email: data.email,
    name: `${data.firstName} ${data.lastName}`,
    arrival: data.arrival,
    departure: data.departure,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for invalid_departure event (early departure detected)
 */
export function buildInvalidDeparturePayload(data: {
  email: string;
  requestedDeparture: string;
  cutoffDate: string;
}) {
  return {
    type: "invalid_departure" as const,
    email: data.email,
    requestedDeparture: data.requestedDeparture,
    cutoffDate: data.cutoffDate,
    reason: "Departure date is before the required cutoff",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for payment_initiated event
 */
export function buildPaymentInitiatedPayload(data: {
  email: string;
  amountCents: number;
  stripeSessionId: string;
}) {
  return {
    type: "payment_initiated" as const,
    email: data.email,
    amountCents: data.amountCents,
    stripeSessionId: data.stripeSessionId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for payment_success event
 */
export function buildPaymentSuccessPayload(data: {
  email: string;
  amountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
}) {
  return {
    type: "payment_success" as const,
    email: data.email,
    amountCents: data.amountCents,
    stripeSessionId: data.stripeSessionId,
    stripePaymentIntentId: data.stripePaymentIntentId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for payment_failed event
 */
export function buildPaymentFailedPayload(data: {
  email: string;
  stripeSessionId: string;
  reason?: string;
}) {
  return {
    type: "payment_failed" as const,
    email: data.email,
    stripeSessionId: data.stripeSessionId,
    reason: data.reason ?? "Payment was not completed",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for ops_override_granted event
 */
export function buildOpsOverrideGrantedPayload(data: {
  email: string;
  approverEmail: string;
  requestedDeparture: string;
  notes?: string;
}) {
  return {
    type: "ops_override_granted" as const,
    email: data.email,
    approverEmail: data.approverEmail,
    requestedDeparture: data.requestedDeparture,
    notes: data.notes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for ops_override_denied event
 */
export function buildOpsOverrideDeniedPayload(data: {
  email: string;
  approverEmail: string;
  requestedDeparture: string;
  reason?: string;
}) {
  return {
    type: "ops_override_denied" as const,
    email: data.email,
    approverEmail: data.approverEmail,
    requestedDeparture: data.requestedDeparture,
    reason: data.reason ?? "Request denied",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for webhook_error event
 */
export function buildWebhookErrorPayload(data: {
  error: string;
  webhookType?: string;
  stripeSessionId?: string;
}) {
  return {
    type: "webhook_error" as const,
    error: data.error,
    webhookType: data.webhookType,
    stripeSessionId: data.stripeSessionId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build payload for mutation_failed event
 */
export function buildMutationFailedPayload(data: {
  mutationName: string;
  error: string;
  input?: Record<string, unknown>;
}) {
  return {
    type: "mutation_failed" as const,
    mutationName: data.mutationName,
    error: data.error,
    input: data.input,
    timestamp: new Date().toISOString(),
  };
}
