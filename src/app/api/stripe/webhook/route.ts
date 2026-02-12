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

  // ---------- checkout.session.completed ----------
  // Handled outside the generic try/catch because payment confirmation
  // errors (bad config, failed refunds) must return 500 so Stripe retries.
  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

      const result = await convex.mutation(api.payments.handleCheckoutSuccess, {
        stripeSessionId: session.id,
        amountCents: session.amount_total ?? 0,
        stripePaymentIntentId: paymentIntentId,
      });

      if (result.requiresRefund) {
        // Capacity exceeded — we must issue a refund.
        // If paymentIntentId is missing we can't refund: return 500 so
        // Stripe retries (the retry payload may include it, or ops can
        // investigate via the capacity_exceeded event log).
        if (!paymentIntentId) {
          console.error(
            `Capacity exceeded but no paymentIntentId for session ${session.id}. Returning 500 for retry.`
          );

          // Log so ops can find this when filtering by capacity_exceeded
          await convex.mutation(api.payments.logRefundOutcome, {
            stripeSessionId: session.id,
            refundSucceeded: false,
            error: "payment_intent missing from checkout session — manual refund required",
          });

          return NextResponse.json(
            { error: "Cannot refund: missing payment_intent" },
            { status: 500 }
          );
        }

        try {
          await stripe.refunds.create({ payment_intent: paymentIntentId });
          console.log(`Auto-refund issued for payment_intent ${paymentIntentId} (capacity exceeded)`);

          // Log success so ops can see the refund completed
          await convex.mutation(api.payments.logRefundOutcome, {
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntentId,
            refundSucceeded: true,
          });
        } catch (refundError) {
          const isAlreadyRefunded =
            refundError instanceof Error &&
            refundError.message.includes("already been refunded");
          if (isAlreadyRefunded) {
            // Already refunded — still log success for ops
            await convex.mutation(api.payments.logRefundOutcome, {
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentId,
              refundSucceeded: true,
            });
          } else {
            // Genuine failure — log for ops and return 500 so Stripe retries
            const errorMsg = refundError instanceof Error ? refundError.message : "Unknown error";
            console.error("Auto-refund failed, returning 500 for Stripe retry:", refundError);

            await convex.mutation(api.payments.logRefundOutcome, {
              stripeSessionId: session.id,
              stripePaymentIntentId: paymentIntentId,
              refundSucceeded: false,
              error: errorMsg,
            });

            return NextResponse.json(
              { error: "Refund failed, please retry" },
              { status: 500 }
            );
          }
        }
      } else if (result.success) {
        console.log(`Payment successful for session: ${session.id}`);
      } else {
        // Mutation returned failure without requiring refund (e.g. application
        // not found). The mutation already logged the error internally.
        // Return 500 so Stripe retries — the application record may appear
        // on a subsequent attempt (e.g. replication lag).
        console.error(`Payment confirmation failed for session ${session.id}: ${result.error}`);
        return NextResponse.json(
          { error: result.error ?? "Payment confirmation failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({ received: true }, { status: 200 });
    } catch (err) {
      // Any error during payment confirmation (including parseMaxMembers)
      // must return 500 so Stripe retries. Money is at stake.
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`Error confirming payment: ${errorMessage}`);
      try {
        await convex.mutation(api.payments.logWebhookError, {
          error: `Payment confirmation error: ${errorMessage}`,
          webhookType: event.type,
        });
      } catch {
        // Ignore logging errors
      }
      return NextResponse.json(
        { error: "Payment confirmation failed" },
        { status: 500 }
      );
    }
  }

  // ---------- All other event types ----------
  // Non-payment events (expired, failed, unknown). Processing errors here
  // are logged but return 200 — retrying won't help and no money is at risk.
  try {
    switch (event.type) {
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
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Error processing webhook: ${errorMessage}`);
    try {
      await convex.mutation(api.payments.logWebhookError, {
        error: `Webhook processing error: ${errorMessage}`,
        webhookType: event.type,
      });
    } catch {
      // Ignore logging errors
    }
    // Non-payment events — safe to return 200, error is logged for ops
    return NextResponse.json({ received: true, error: errorMessage }, { status: 200 });
  }
}
