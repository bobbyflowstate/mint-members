import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCheckoutSuccess } from "./payments";
import { Id } from "./_generated/dataModel";

vi.mock("./opsSignupRows", () => ({
  upsertOpsSignupRow: vi.fn().mockResolvedValue({ operation: "updated", rowId: "row_1" }),
}));

vi.mock("./lib/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/events")>();
  return { ...actual, logEvent: vi.fn().mockResolvedValue(undefined) };
});

function getHandler(mutationObject: unknown): Function {
  const maybeHandler = (mutationObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler;
  }

  const maybeInternalHandler = (mutationObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler;
  }

  throw new Error("Unable to locate Convex mutation handler");
}

function createQueryMock({
  applicationsByCheckoutSession,
  confirmedApplications,
  maxMembers = "10",
}: {
  applicationsByCheckoutSession: unknown[];
  confirmedApplications: unknown[];
  maxMembers?: string;
}) {
  let applicationsQueryCount = 0;

  return vi.fn((table: string) => {
    if (table === "applications") {
      applicationsQueryCount += 1;
      if (applicationsQueryCount === 1) {
        return { collect: vi.fn().mockResolvedValue(applicationsByCheckoutSession) };
      }
      return {
        withIndex: vi.fn().mockReturnValue({
          collect: vi.fn().mockResolvedValue(confirmedApplications),
        }),
      };
    }

    if (table === "config") {
      return {
        withIndex: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ value: maxMembers }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe("payments.handleCheckoutSuccess cancellation guards", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not confirm or request refund for a cancelled application when Stripe reports checkout success", async () => {
    const handler = getHandler(handleCheckoutSuccess);
    const applicationId = "app_cancelled" as Id<"applications">;
    const patch = vi.fn();
    const ctx = {
      db: {
        query: createQueryMock({
          applicationsByCheckoutSession: [
            {
              _id: applicationId,
              email: "cancelled@example.com",
              status: "pending_payment",
              checkoutSessionId: "cs_cancelled",
              cancelled: true,
            },
          ],
          confirmedApplications: [],
        }),
        patch,
      },
    };

    const result = await handler(ctx, {
      stripeSessionId: "cs_cancelled",
      amountCents: 50000,
      stripePaymentIntentId: "pi_cancelled",
    });

    expect(result).toEqual({
      success: false,
      error: "application_cancelled",
      stripePaymentIntentId: "pi_cancelled",
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it("keeps already-confirmed payments idempotent after later cancellation", async () => {
    const handler = getHandler(handleCheckoutSuccess);
    const applicationId = "app_cancelled_confirmed" as Id<"applications">;
    const patch = vi.fn();
    const ctx = {
      db: {
        query: createQueryMock({
          applicationsByCheckoutSession: [
            {
              _id: applicationId,
              email: "cancelled@example.com",
              status: "confirmed",
              checkoutSessionId: "cs_confirmed",
              cancelled: true,
            },
          ],
          confirmedApplications: [],
        }),
        patch,
      },
    };

    const result = await handler(ctx, {
      stripeSessionId: "cs_confirmed",
      amountCents: 50000,
      stripePaymentIntentId: "pi_confirmed",
    });

    expect(result).toEqual({ success: true, applicationId });
    expect(patch).not.toHaveBeenCalled();
  });

  it("does not count cancelled confirmed applications against the payment hard cap", async () => {
    const handler = getHandler(handleCheckoutSuccess);
    const applicationId = "app_pending" as Id<"applications">;
    const patch = vi.fn();
    const ctx = {
      db: {
        query: createQueryMock({
          applicationsByCheckoutSession: [
            {
              _id: applicationId,
              email: "pending@example.com",
              status: "pending_payment",
              checkoutSessionId: "cs_pending",
            },
          ],
          confirmedApplications: [
            {
              _id: "app_cancelled_confirmed",
              email: "cancelled@example.com",
              status: "confirmed",
              cancelled: true,
            },
          ],
          maxMembers: "1",
        }),
        patch,
      },
    };

    const result = await handler(ctx, {
      stripeSessionId: "cs_pending",
      amountCents: 50000,
      stripePaymentIntentId: "pi_pending",
    });

    expect(result).toEqual({ success: true, applicationId });
    expect(patch).toHaveBeenCalledWith(
      applicationId,
      expect.objectContaining({ status: "confirmed" })
    );
  });
});
