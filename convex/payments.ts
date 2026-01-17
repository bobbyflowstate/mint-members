import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  logEvent,
  buildPaymentInitiatedPayload,
  buildPaymentSuccessPayload,
  buildPaymentFailedPayload,
  buildWebhookErrorPayload,
} from "./lib/events";

/**
 * Update application with checkout session (internal mutation)
 * Note: We DON'T change status here - status only changes when Stripe
 * confirms payment via webhook (handleCheckoutSuccess)
 */
export const updateApplicationCheckout = mutation({
  args: {
    applicationId: v.id("applications"),
    checkoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      checkoutSessionId: args.checkoutSessionId,
      // Status stays as "pending_payment" until Stripe webhook confirms
      updatedAt: Date.now(),
    });
  },
});

/**
 * Log payment event (internal mutation called from action)
 */
export const logPaymentEvent = mutation({
  args: {
    applicationId: v.id("applications"),
    stripeSessionId: v.string(),
    eventType: v.union(
      v.literal("payment_initiated"),
      v.literal("payment_success"),
      v.literal("payment_failed")
    ),
    email: v.string(),
    amountCents: v.optional(v.number()),
    stripePaymentIntentId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let payload: Record<string, unknown>;

    switch (args.eventType) {
      case "payment_initiated":
        payload = buildPaymentInitiatedPayload({
          email: args.email,
          amountCents: args.amountCents ?? 0,
          stripeSessionId: args.stripeSessionId,
        });
        break;
      case "payment_success":
        payload = buildPaymentSuccessPayload({
          email: args.email,
          amountCents: args.amountCents ?? 0,
          stripeSessionId: args.stripeSessionId,
          stripePaymentIntentId: args.stripePaymentIntentId,
        });
        break;
      case "payment_failed":
        payload = buildPaymentFailedPayload({
          email: args.email,
          stripeSessionId: args.stripeSessionId,
          reason: args.reason,
        });
        break;
    }

    await logEvent(ctx, {
      applicationId: args.applicationId,
      stripeSessionId: args.stripeSessionId,
      eventType: args.eventType,
      payload,
      actor: "stripe",
    });
  },
});

/**
 * Handle successful checkout webhook from Stripe
 */
export const handleCheckoutSuccess = mutation({
  args: {
    stripeSessionId: v.string(),
    amountCents: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find application by checkout session ID
    const applications = await ctx.db.query("applications").collect();
    const application = applications.find(
      (app) => app.checkoutSessionId === args.stripeSessionId
    );

    if (!application) {
      // Log error but don't fail - might be a duplicate webhook
      await logEvent(ctx, {
        stripeSessionId: args.stripeSessionId,
        eventType: "webhook_error",
        payload: buildWebhookErrorPayload({
          error: "Application not found for checkout session",
          webhookType: "checkout.session.completed",
          stripeSessionId: args.stripeSessionId,
        }),
        actor: "stripe",
      });
      return { success: false, error: "Application not found" };
    }

    // Update application status to confirmed
    await ctx.db.patch(application._id, {
      status: "confirmed",
      updatedAt: Date.now(),
    });

    // Log success event
    await logEvent(ctx, {
      applicationId: application._id,
      stripeSessionId: args.stripeSessionId,
      eventType: "payment_success",
      payload: buildPaymentSuccessPayload({
        email: application.email,
        amountCents: args.amountCents,
        stripeSessionId: args.stripeSessionId,
        stripePaymentIntentId: args.stripePaymentIntentId,
      }),
      actor: "stripe",
    });

    return { success: true, applicationId: application._id };
  },
});

/**
 * Handle failed/expired checkout webhook from Stripe
 */
export const handleCheckoutFailed = mutation({
  args: {
    stripeSessionId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find application by checkout session ID
    const applications = await ctx.db.query("applications").collect();
    const application = applications.find(
      (app) => app.checkoutSessionId === args.stripeSessionId
    );

    if (!application) {
      return { success: false, error: "Application not found" };
    }

    // Revert status to pending_payment so they can try again
    await ctx.db.patch(application._id, {
      status: "pending_payment",
      checkoutSessionId: undefined,
      updatedAt: Date.now(),
    });

    // Log failure event
    await logEvent(ctx, {
      applicationId: application._id,
      stripeSessionId: args.stripeSessionId,
      eventType: "payment_failed",
      payload: buildPaymentFailedPayload({
        email: application.email,
        stripeSessionId: args.stripeSessionId,
        reason: args.reason,
      }),
      actor: "stripe",
    });

    return { success: true, applicationId: application._id };
  },
});

/**
 * Log webhook error (called from webhook route)
 */
export const logWebhookError = mutation({
  args: {
    error: v.string(),
    webhookType: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logEvent(ctx, {
      stripeSessionId: args.stripeSessionId,
      eventType: "webhook_error",
      payload: buildWebhookErrorPayload({
        error: args.error,
        webhookType: args.webhookType,
        stripeSessionId: args.stripeSessionId,
      }),
      actor: "stripe",
    });
  },
});

/**
 * Reset application to pending_payment status (admin use)
 * Use this to fix applications stuck in payment_processing after abandoned checkout
 * 
 * Usage: npx convex run payments:resetToPendingPayment '{"applicationId": "..."}'
 */
export const resetToPendingPayment = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    
    if (!application) {
      throw new Error("Application not found");
    }

    if (application.status === "confirmed") {
      throw new Error("Cannot reset a confirmed application");
    }

    await ctx.db.patch(args.applicationId, {
      status: "pending_payment",
      checkoutSessionId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true, applicationId: args.applicationId };
  },
});

/**
 * Manually confirm payment (admin use)
 * Use this when you've verified payment in Stripe dashboard but webhook didn't fire
 * (common in local development without Stripe CLI)
 * 
 * Usage: npx convex run payments:manuallyConfirmPayment '{"applicationId": "..."}'
 */
export const manuallyConfirmPayment = mutation({
  args: {
    applicationId: v.id("applications"),
  },
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    
    if (!application) {
      throw new Error("Application not found");
    }

    if (application.status === "confirmed") {
      return { success: true, message: "Already confirmed" };
    }

    await ctx.db.patch(args.applicationId, {
      status: "confirmed",
      updatedAt: Date.now(),
    });

    // Log manual confirmation
    await logEvent(ctx, {
      applicationId: args.applicationId,
      eventType: "payment_success",
      payload: {
        type: "payment_success",
        email: application.email,
        note: "Manually confirmed by admin",
        timestamp: new Date().toISOString(),
      },
      actor: "admin",
    });

    return { success: true, applicationId: args.applicationId };
  },
});
