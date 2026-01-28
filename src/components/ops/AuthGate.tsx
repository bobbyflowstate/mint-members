"use client";

import { ReactNode, useState, useEffect, FormEvent } from "react";
import Link from "next/link";

interface AuthGateProps {
  children: ReactNode;
}

const OPS_AUTH_KEY = "ops_authenticated";
const OPS_PASSWORD_KEY = "ops_password";

export function AuthGate({ children }: AuthGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if already authenticated on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(OPS_AUTH_KEY);
    setIsAuthenticated(stored === "true");
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ops/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.valid) {
        sessionStorage.setItem(OPS_AUTH_KEY, "true");
        sessionStorage.setItem(OPS_PASSWORD_KEY, password);
        setIsAuthenticated(true);
      } else {
        setError(data.error || "Invalid password");
        setPassword("");
      }
    } catch {
      setError("Failed to verify password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking session storage
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated - show password form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md mx-auto px-6">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <svg
                className="h-8 w-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h1 className="mt-6 text-2xl font-bold text-white">Ops Portal</h1>
            <p className="mt-2 text-slate-400">
              Enter the ops password to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-lg border-0 bg-white/5 px-4 py-3 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm"
                placeholder="Enter password"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Verifying..." : "Access Ops Portal"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
