"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";

interface EmailAuthFormProps {
  onSuccess?: () => void;
}

export function EmailAuthForm({ onSuccess }: EmailAuthFormProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signIn("resend", { email });
      setEmailSent(true);
      // Don't call onSuccess here - keep modal open to show "check email" message
      // User will be redirected after clicking magic link
    } catch (err) {
      console.error("Auth error:", err);
      setError(
        err instanceof Error 
          ? err.message 
          : "Failed to send magic link. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/30">
          <svg
            className="h-10 w-10 text-emerald-400"
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
        <h3 className="mt-6 text-xl font-bold text-white">Check your inbox!</h3>
        <p className="mt-3 text-base text-slate-300">
          We sent a magic link to:
        </p>
        <p className="mt-1 text-lg font-semibold text-emerald-400">{email}</p>
        <div className="mt-6 p-4 bg-white/5 rounded-lg ring-1 ring-white/10">
          <p className="text-sm text-slate-300">
            📧 Open your email and click the link to sign in instantly.
          </p>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Link expires in 15 minutes. Check spam if you don&apos;t see it.
        </p>
        <button
          onClick={() => {
            setEmailSent(false);
            setEmail("");
          }}
          className="mt-6 text-sm text-slate-400 hover:text-white transition-colors"
        >
          ← Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        {isLoading ? "Sending..." : "Continue with Email"}
      </button>

      <p className="text-center text-xs text-slate-500">
        We&apos;ll send you a magic link to sign in instantly. No password needed.
      </p>
    </form>
  );
}
