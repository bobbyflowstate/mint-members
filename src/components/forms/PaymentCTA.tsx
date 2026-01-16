"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { loadStripe } from "@stripe/stripe-js";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentCTAProps {
  applicationId: Id<"applications">;
  amount: string;
  disabled?: boolean;
}

export function PaymentCTA({ applicationId, amount, disabled = false }: PaymentCTAProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const createCheckout = useAction(api.paymentsActions.createReservationCheckout);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Failed to load Stripe");
      }

      const result = await createCheckout({
        applicationId,
        successUrl: `${window.location.origin}/apply/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${window.location.origin}/apply/error`,
      });

      if (result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to initiate payment"
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Complete Payment</h3>
            <p className="text-sm text-slate-400">Secure your reservation</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{amount}</p>
            <p className="text-sm text-slate-400">Reservation fee</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={disabled || isLoading}
          className="mt-6 w-full rounded-lg bg-emerald-500 px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                />
              </svg>
              Pay with Card
            </>
          )}
        </button>

        <p className="mt-4 text-center text-xs text-slate-500">
          Secure payment powered by Stripe
        </p>
      </div>
    </div>
  );
}
