"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

const OPS_PASSWORD_KEY = "ops_password";

export default function DebugAllowlistPage() {
  const [opsPassword] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(OPS_PASSWORD_KEY);
    }
    return null;
  });

  const debugInfo = useQuery(
    api.debug.checkAllowlistStatus,
    opsPassword ? { opsPassword } : "skip"
  );

  if (!opsPassword || debugInfo === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Allowlist Debug Info</h1>

        <div className="bg-white/5 rounded-xl p-6 ring-1 ring-white/10">
          <pre className="text-sm text-white whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="mt-8 space-y-4">
          <div className="bg-white/5 rounded-xl p-6 ring-1 ring-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Status Summary</h2>

            {debugInfo && !('error' in debugInfo) && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Your Email:</span>
                  <span className="text-white font-mono">{debugInfo.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Allowlist Enabled:</span>
                  <span className={debugInfo.allowlistEnabled ? "text-emerald-400" : "text-red-400"}>
                    {debugInfo.allowlistEnabled ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Config Value:</span>
                  <span className="text-white font-mono">{debugInfo.allowlistConfigValue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Email In Allowlist:</span>
                  <span className={debugInfo.isEmailInAllowlist ? "text-emerald-400" : "text-red-400"}>
                    {debugInfo.isEmailInAllowlist ? "YES" : "NO"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Allowlisted:</span>
                  <span className="text-white">{debugInfo.totalAllowlistedEmails}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <h3 className="text-white font-semibold mb-2">Expected Behavior:</h3>
                  {debugInfo.allowlistEnabled ? (
                    debugInfo.isEmailInAllowlist ? (
                      <p className="text-emerald-400">✓ You SHOULD be able to submit an application</p>
                    ) : (
                      <p className="text-red-400">✗ You should NOT be able to submit an application</p>
                    )
                  ) : (
                    <p className="text-slate-400">• Allowlist is disabled, anyone can submit</p>
                  )}
                </div>
              </div>
            )}

            {debugInfo && 'error' in debugInfo && (
              <p className="text-red-400">{debugInfo.error}</p>
            )}
          </div>

          {debugInfo && !('error' in debugInfo) && debugInfo.allAllowlistedEmails && (
            <div className="bg-white/5 rounded-xl p-6 ring-1 ring-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">All Allowlisted Emails ({debugInfo.allAllowlistedEmails.length})</h2>
              <div className="space-y-1">
                {debugInfo.allAllowlistedEmails.map((email, i) => (
                  <div key={i} className="text-sm font-mono text-slate-300">
                    {email}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
