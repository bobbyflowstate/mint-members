import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  logEvent,
  buildPaymentInitiatedPayload,
  buildPaymentSuccessPayload,
  buildPaymentFailedPayload,
  buildWebhookErrorPayload,
} from "./lib/events";
import { DEFAULT_CONFIG } from "./config";

/**
 * Create a Stripe checkout session for reservation payment
 * This is an action because it calls external Stripe API
 */
export const createReservationCheckout = action({
  args: {
    applicationId: v.id("applications"),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Get the application
    const application = await ctx.runQuery(api.applications.getById, {
      applicationId: args.applicationId,
    });

    if (!application) {
      throw new Error("Application not found");
    }

    if (!application.paymentAllowed) {
      throw new Error("Payment not allowed for this application");
    }

    if (application.status !== "pending_payment") {
      throw new Error(`Invalid application status: ${application.status}`);
    }

    // Get reservation fee from config
    const config = await ctx.runQuery(api.config.getConfig, {});
    const reservationFeeCents = parseInt(
      config.reservationFeeCents ?? DEFAULT_CONFIG.reservationFeeCents,
      10
    );

    // Create Stripe checkout session
    const stripe = await getStripeClient();
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "DeMentha Camp Reservation",
              description: `Reservation for ${application.firstName} ${application.lastName}`,
            },
            unit_amount: reservationFeeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      customer_email: application.email,
      metadata: {
        applicationId: args.applicationId,
        email: application.email,
      },
    });

    // Update application with checkout session ID and status
    await ctx.runMutation(api.payments.updateApplicationCheckout, {
      applicationId: args.applicationId,
      checkoutSessionId: session.id,
    });

    // Log payment initiated event
    await ctx.runMutation(api.payments.logPaymentEvent, {
      applicationId: args.applicationId,
      stripeSessionId: session.id,
      eventType: "payment_initiated",
      email: application.email,
      amountCents: reservationFeeCents,
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  },
});

/**
 * Update application with checkout session (internal mutation)
 */
export const updateApplicationCheckout = mutation({
  args: {
    applicationId: v.id("applications"),
    checkoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      checkoutSessionId: args.checkoutSessionId,
      status: "payment_processing",
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
 * Get Stripe client (lazy initialization)
 */
async function getStripeClient() {
  const Stripe = (await import("stripe")).default;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  
  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-04-30.basil",
  });
}
