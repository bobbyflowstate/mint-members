"use client";

import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";

// List of authorized ops emails (could be moved to Convex config)
const OPS_EMAILS = [
  "ops@dementha.com",
  "admin@dementha.com",
  // Add more authorized emails here
];

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  // For now, we'll use a simple email-based auth check
  // In production, this would check the authenticated user's email
  const config = useQuery(api.config.getConfig);
  
  // Get ops emails from config or use defaults
  const authorizedEmails = config?.opsEmails 
    ? JSON.parse(config.opsEmails) 
    : OPS_EMAILS;

  // For demo purposes, we'll allow access
  // In production, you'd check against the authenticated user
  const isAuthorized = true; // Replace with actual auth check

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">Access Denied</h1>
          <p className="mt-2 text-slate-400">
            You don&apos;t have permission to access this page.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
