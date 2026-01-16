"use client";

import { useState } from "react";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: "signIn" | "signUp";
}

export function AuthModal({ isOpen, onClose, defaultMode = "signIn" }: AuthModalProps) {
  const [mode, setMode] = useState<"signIn" | "signUp">(defaultMode);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform rounded-2xl bg-slate-800 p-8 shadow-xl ring-1 ring-white/10 transition-all">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">
              {mode === "signIn" ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === "signIn"
                ? "Sign in to continue your application"
                : "Sign up to reserve your spot at DeMentha"}
            </p>
          </div>

          {/* Form */}
          {mode === "signIn" ? (
            <SignInForm
              onSuccess={onClose}
              onSwitchToSignUp={() => setMode("signUp")}
            />
          ) : (
            <SignUpForm
              onSuccess={onClose}
              onSwitchToSignIn={() => setMode("signIn")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
