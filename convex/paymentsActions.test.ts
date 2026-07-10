import { afterEach, describe, expect, it, vi } from "vitest";
import { createReservationCheckout } from "./paymentsActions";
import { Id } from "./_generated/dataModel";

function getHandler(actionObject: unknown): Function {
  const maybeHandler = (actionObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler;
  }

  const maybeInternalHandler = (actionObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler;
  }

  throw new Error("Unable to locate Convex action handler");
}

describe("paymentsActions.createReservationCheckout cancellation guards", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects checkout creation for cancelled applications", async () => {
    const handler = getHandler(createReservationCheckout);
    const applicationId = "app_cancelled" as Id<"applications">;
    const ctx = {
      runQuery: vi.fn().mockResolvedValueOnce({
        _id: applicationId,
        firstName: "Casey",
        lastName: "Cancelled",
        email: "cancelled@example.com",
        status: "pending_payment",
        paymentAllowed: true,
        cancelled: true,
      }),
      runMutation: vi.fn(),
    };

    await expect(
      handler(ctx, {
        applicationId,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      })
    ).rejects.toThrow("Payment not allowed for cancelled application");
    expect(ctx.runQuery).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
