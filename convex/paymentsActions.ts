"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Stripe from "stripe";
import { Doc } from "./_generated/dataModel";

/**
 * Verify payment status from Stripe session ID (called from success page)
 * This allows confirming payment via redirect without webhooks
 */
export const verifyAndConfirmPayment = action({
  args: {
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return { success: false, error: "Stripe not configured" };
    }

    const stripe = new Stripe(stripeSecretKey);

    try {
      // Retrieve the checkout session from Stripe
      const session = await stripe.checkout.sessions.retrieve(args.stripeSessionId);

      // Check if payment was successful
      if (session.payment_status !== "paid") {
        return { success: false, error: "Payment not completed" };
      }

      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : undefined;

      // Update application status via mutation (serialized — race-condition safe)
      const result = await ctx.runMutation(api.payments.handleCheckoutSuccess, {
        stripeSessionId: args.stripeSessionId,
        amountCents: session.amount_total ?? 0,
        stripePaymentIntentId: paymentIntentId,
      });

      // If capacity was exceeded, automatically refund via Stripe
      if (result.requiresRefund && paymentIntentId) {
        try {
          await stripe.refunds.create({ payment_intent: paymentIntentId });
          console.log(`Auto-refund issued for payment_intent ${paymentIntentId} (capacity exceeded)`);
          return {
            success: false,
            error: "Camp is at full capacity. Your payment has been automatically refunded.",
          };
        } catch (refundError) {
          // Refund may already have been issued by the webhook path
          const isAlreadyRefunded =
            refundError instanceof Error &&
            refundError.message.includes("already been refunded");
          if (isAlreadyRefunded) {
            return {
              success: false,
              error: "Camp is at full capacity. Your payment has been automatically refunded.",
            };
          }
          // Genuine refund failure — tell the user the truth
          console.error("Auto-refund failed:", refundError);
          return {
            success: false,
            error: "Camp is at full capacity. We were unable to process your refund automatically — please contact us and we will refund you promptly.",
          };
        }
      }

      return { success: result.success ?? false, error: result.error };
    } catch (error) {
      console.error("Error verifying payment:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Failed to verify payment" 
      };
    }
  },
});

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
  handler: async (ctx, args): Promise<{ sessionId: string; url: string | null }> => {
    // Get the application
    const application: Doc<"applications"> | null = await ctx.runQuery(
      api.applications.getById,
      { applicationId: args.applicationId }
    );

    if (!application) {
      throw new Error("Application not found");
    }

    if (!application.paymentAllowed) {
      throw new Error("Payment not allowed for this application");
    }

    if (application.status !== "pending_payment") {
      throw new Error(`Invalid application status: ${application.status}`);
    }

    // Get reservation fee from config (includes defaults)
    const config: Record<string, string> = await ctx.runQuery(api.config.getConfig, {});
    const paymentsEnabled = (config.paymentsEnabled ?? "").trim().toLowerCase() === "true";
    if (!paymentsEnabled) {
      throw new Error("Payments are currently disabled");
    }

    // Enforce capacity hard cap — reject if camp is full
    const capacity = await ctx.runQuery(api.applications.getCapacityStatus, {});
    if (capacity.isFull) {
      throw new Error(
        "Camp is at full capacity. No more reservations are being accepted."
      );
    }

    const reservationFeeCents = parseInt(config.reservationFeeCents, 10);

    // Create Stripe client
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    
    const stripe = new Stripe(stripeSecretKey);

    // Create Stripe checkout session
    const session: Stripe.Checkout.Session = await stripe.checkout.sessions.create({
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
