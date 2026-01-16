"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function UserButton() {
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
    } finally {
      setIsSigningOut(false);
      setIsOpen(false);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition-colors"
      >
        <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-medium">
          {user.email?.[0].toUpperCase() || "U"}
        </div>
        <span className="hidden sm:inline">{user.email}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 rounded-lg bg-slate-800 py-2 shadow-lg ring-1 ring-white/10 z-20">
            <div className="px-4 py-2 border-b border-white/10">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm text-white truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
