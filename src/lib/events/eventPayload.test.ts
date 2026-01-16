import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  buildFormSubmittedPayload,
  buildInvalidDeparturePayload,
  buildPaymentInitiatedPayload,
  buildPaymentSuccessPayload,
  buildPaymentFailedPayload,
  buildOpsOverrideGrantedPayload,
  buildOpsOverrideDeniedPayload,
  buildWebhookErrorPayload,
  buildMutationFailedPayload,
  EVENT_TYPES,
} from "../../../convex/lib/events";

describe("Event Payload Builders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("EVENT_TYPES", () => {
    it("should contain all expected event types", () => {
      expect(EVENT_TYPES).toContain("form_submitted");
      expect(EVENT_TYPES).toContain("invalid_departure");
      expect(EVENT_TYPES).toContain("payment_initiated");
      expect(EVENT_TYPES).toContain("payment_success");
      expect(EVENT_TYPES).toContain("payment_failed");
      expect(EVENT_TYPES).toContain("ops_override_granted");
      expect(EVENT_TYPES).toContain("ops_override_denied");
      expect(EVENT_TYPES).toContain("webhook_error");
      expect(EVENT_TYPES).toContain("mutation_failed");
    });
  });

  describe("buildFormSubmittedPayload", () => {
    it("should build correct payload with all fields", () => {
      const payload = buildFormSubmittedPayload({
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        arrival: "2025-08-22",
        departure: "2025-09-01",
      });

      expect(payload.type).toBe("form_submitted");
      expect(payload.email).toBe("test@example.com");
      expect(payload.name).toBe("John Doe");
      expect(payload.arrival).toBe("2025-08-22");
      expect(payload.departure).toBe("2025-09-01");
      expect(payload.timestamp).toBe("2025-08-15T12:00:00.000Z");
    });
  });

  describe("buildInvalidDeparturePayload", () => {
    it("should build correct payload with cutoff info", () => {
      const payload = buildInvalidDeparturePayload({
        email: "test@example.com",
        requestedDeparture: "2025-08-30",
        cutoffDate: "2025-09-01",
      });

      expect(payload.type).toBe("invalid_departure");
      expect(payload.email).toBe("test@example.com");
      expect(payload.requestedDeparture).toBe("2025-08-30");
      expect(payload.cutoffDate).toBe("2025-09-01");
      expect(payload.reason).toContain("cutoff");
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe("buildPaymentInitiatedPayload", () => {
    it("should build correct payload with amount and session", () => {
      const payload = buildPaymentInitiatedPayload({
        email: "test@example.com",
        amountCents: 35000,
        stripeSessionId: "cs_test_123",
      });

      expect(payload.type).toBe("payment_initiated");
      expect(payload.email).toBe("test@example.com");
      expect(payload.amountCents).toBe(35000);
      expect(payload.stripeSessionId).toBe("cs_test_123");
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe("buildPaymentSuccessPayload", () => {
    it("should build correct payload with payment details", () => {
      const payload = buildPaymentSuccessPayload({
        email: "test@example.com",
        amountCents: 35000,
        stripeSessionId: "cs_test_123",
        stripePaymentIntentId: "pi_test_456",
      });

      expect(payload.type).toBe("payment_success");
      expect(payload.email).toBe("test@example.com");
      expect(payload.amountCents).toBe(35000);
      expect(payload.stripeSessionId).toBe("cs_test_123");
      expect(payload.stripePaymentIntentId).toBe("pi_test_456");
      expect(payload.timestamp).toBeDefined();
    });

    it("should handle missing payment intent ID", () => {
      const payload = buildPaymentSuccessPayload({
        email: "test@example.com",
        amountCents: 35000,
        stripeSessionId: "cs_test_123",
      });

      expect(payload.stripePaymentIntentId).toBeUndefined();
    });
  });

  describe("buildPaymentFailedPayload", () => {
    it("should build correct payload with reason", () => {
      const payload = buildPaymentFailedPayload({
        email: "test@example.com",
        stripeSessionId: "cs_test_123",
        reason: "Card declined",
      });

      expect(payload.type).toBe("payment_failed");
      expect(payload.email).toBe("test@example.com");
      expect(payload.stripeSessionId).toBe("cs_test_123");
      expect(payload.reason).toBe("Card declined");
      expect(payload.timestamp).toBeDefined();
    });

    it("should use default reason when not provided", () => {
      const payload = buildPaymentFailedPayload({
        email: "test@example.com",
        stripeSessionId: "cs_test_123",
      });

      expect(payload.reason).toBe("Payment was not completed");
    });
  });

  describe("buildOpsOverrideGrantedPayload", () => {
    it("should build correct payload with approver info", () => {
      const payload = buildOpsOverrideGrantedPayload({
        email: "member@example.com",
        approverEmail: "ops@example.com",
        requestedDeparture: "2025-08-30",
        notes: "Approved for family emergency",
      });

      expect(payload.type).toBe("ops_override_granted");
      expect(payload.email).toBe("member@example.com");
      expect(payload.approverEmail).toBe("ops@example.com");
      expect(payload.requestedDeparture).toBe("2025-08-30");
      expect(payload.notes).toBe("Approved for family emergency");
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe("buildOpsOverrideDeniedPayload", () => {
    it("should build correct payload with denial reason", () => {
      const payload = buildOpsOverrideDeniedPayload({
        email: "member@example.com",
        approverEmail: "ops@example.com",
        requestedDeparture: "2025-08-25",
        reason: "Too early, camp needs help",
      });

      expect(payload.type).toBe("ops_override_denied");
      expect(payload.email).toBe("member@example.com");
      expect(payload.approverEmail).toBe("ops@example.com");
      expect(payload.requestedDeparture).toBe("2025-08-25");
      expect(payload.reason).toBe("Too early, camp needs help");
      expect(payload.timestamp).toBeDefined();
    });

    it("should use default reason when not provided", () => {
      const payload = buildOpsOverrideDeniedPayload({
        email: "member@example.com",
        approverEmail: "ops@example.com",
        requestedDeparture: "2025-08-25",
      });

      expect(payload.reason).toBe("Request denied");
    });
  });

  describe("buildWebhookErrorPayload", () => {
    it("should build correct payload with error details", () => {
      const payload = buildWebhookErrorPayload({
        error: "Invalid signature",
        webhookType: "checkout.session.completed",
        stripeSessionId: "cs_test_123",
      });

      expect(payload.type).toBe("webhook_error");
      expect(payload.error).toBe("Invalid signature");
      expect(payload.webhookType).toBe("checkout.session.completed");
      expect(payload.stripeSessionId).toBe("cs_test_123");
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe("buildMutationFailedPayload", () => {
    it("should build correct payload with mutation info", () => {
      const payload = buildMutationFailedPayload({
        mutationName: "createDraftApplication",
        error: "Validation failed",
        input: { email: "test@example.com" },
      });

      expect(payload.type).toBe("mutation_failed");
      expect(payload.mutationName).toBe("createDraftApplication");
      expect(payload.error).toBe("Validation failed");
      expect(payload.input).toEqual({ email: "test@example.com" });
      expect(payload.timestamp).toBeDefined();
    });
  });

  describe("payload serialization", () => {
    it("all payloads should be JSON serializable", () => {
      const payloads = [
        buildFormSubmittedPayload({
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
          arrival: "2025-08-22",
          departure: "2025-09-01",
        }),
        buildInvalidDeparturePayload({
          email: "test@example.com",
          requestedDeparture: "2025-08-30",
          cutoffDate: "2025-09-01",
        }),
        buildPaymentInitiatedPayload({
          email: "test@example.com",
          amountCents: 35000,
          stripeSessionId: "cs_test_123",
        }),
        buildPaymentSuccessPayload({
          email: "test@example.com",
          amountCents: 35000,
          stripeSessionId: "cs_test_123",
        }),
        buildPaymentFailedPayload({
          email: "test@example.com",
          stripeSessionId: "cs_test_123",
        }),
        buildOpsOverrideGrantedPayload({
          email: "test@example.com",
          approverEmail: "ops@example.com",
          requestedDeparture: "2025-08-30",
        }),
        buildOpsOverrideDeniedPayload({
          email: "test@example.com",
          approverEmail: "ops@example.com",
          requestedDeparture: "2025-08-30",
        }),
        buildWebhookErrorPayload({
          error: "Test error",
        }),
        buildMutationFailedPayload({
          mutationName: "test",
          error: "Test error",
        }),
      ];

      for (const payload of payloads) {
        expect(() => JSON.stringify(payload)).not.toThrow();
        const parsed = JSON.parse(JSON.stringify(payload));
        expect(parsed.type).toBeDefined();
        expect(parsed.timestamp).toBeDefined();
      }
    });
  });
});
