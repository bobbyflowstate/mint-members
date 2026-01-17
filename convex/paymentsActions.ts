"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import Stripe from "stripe";
import { Doc } from "./_generated/dataModel";

/**
 * Fallback reservation fee - MUST match src/config/camp.config.ts
 * This is only used if no database override exists
 */
const FALLBACK_RESERVATION_FEE_CENTS = 35000;

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

    // Get reservation fee from config (database override or fallback)
    const config: Record<string, string> = await ctx.runQuery(api.config.getConfig, {});
    const reservationFeeCents = parseInt(
      config.reservationFeeCents ?? String(FALLBACK_RESERVATION_FEE_CENTS),
      10
    );

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
