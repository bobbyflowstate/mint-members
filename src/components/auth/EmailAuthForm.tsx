"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

interface EmailAuthFormProps {
  onSuccess?: () => void;
}

type Step = "email" | "code";

export function EmailAuthForm({ onSuccess }: EmailAuthFormProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Request OTP to be sent to email
      await signIn("email", { email, flow: "signIn" });
      setStep("code");
    } catch (err) {
      console.error("Auth error:", err);
      setError(
        err instanceof Error 
          ? err.message 
          : "Failed to send verification code. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Verify the OTP code
      await signIn("email", { email, code, flow: "email-verification" });
      onSuccess?.();
    } catch (err) {
      console.error("Verification error:", err);
      setError(
        err instanceof Error 
          ? err.message 
          : "Invalid or expired code. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="text-center mb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 mb-4">
            <svg
              className="h-6 w-6 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-400">
            We sent a code to <span className="text-white">{email}</span>
          </p>
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-slate-200">
            Verification Code
          </label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            autoComplete="one-time-code"
            className="mt-2 block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white text-center text-2xl tracking-widest shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm"
            placeholder="Enter code"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !code}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? "Verifying..." : "Verify Code"}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to email
          </button>
          <span className="mx-2 text-slate-600">|</span>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={isLoading}
            className="text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            Resend code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-200">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          className="mt-2 block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm"
          placeholder="you@example.com"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isLoading ? "Sending code..." : "Continue with Email"}
      </button>

      <p className="text-center text-xs text-slate-500">
        We&apos;ll send you a verification code. No password needed.
      </p>
    </form>
  );
}
