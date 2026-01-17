import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Initialize Stripe (using default API version from SDK)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Stripe webhook handler
 * Processes checkout.session.completed and checkout.session.expired events
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Webhook signature verification failed: ${errorMessage}`);
    
    // Log the error to Convex
    try {
      await convex.mutation(api.payments.logWebhookError, {
        error: `Signature verification failed: ${errorMessage}`,
        webhookType: "unknown",
      });
    } catch {
      // Ignore logging errors
    }
    
    return NextResponse.json(
      { error: `Webhook signature verification failed` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        await convex.mutation(api.payments.handleCheckoutSuccess, {
          stripeSessionId: session.id,
          amountCents: session.amount_total ?? 0,
          stripePaymentIntentId: typeof session.payment_intent === "string" 
            ? session.payment_intent 
            : session.payment_intent?.id,
        });
        
        console.log(`Payment successful for session: ${session.id}`);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        await convex.mutation(api.payments.handleCheckoutFailed, {
          stripeSessionId: session.id,
          reason: "Checkout session expired",
        });
        
        console.log(`Checkout expired for session: ${session.id}`);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        await convex.mutation(api.payments.handleCheckoutFailed, {
          stripeSessionId: session.id,
          reason: "Async payment failed",
        });
        
        console.log(`Payment failed for session: ${session.id}`);
        break;
      }

      default:
        // Log unhandled event types but return 200
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error processing webhook: ${errorMessage}`);
    
    // Log the error to Convex
    try {
      await convex.mutation(api.payments.logWebhookError, {
        error: `Webhook processing error: ${errorMessage}`,
        webhookType: event.type,
      });
    } catch {
      // Ignore logging errors
    }
    
    // Return 200 to prevent Stripe from retrying
    // The error is logged for manual investigation
    return NextResponse.json({ received: true, error: errorMessage }, { status: 200 });
  }
}
