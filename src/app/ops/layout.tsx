"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/ops/AuthGate";
import clsx from "clsx";

interface OpsLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Review Queue", href: "/ops/review" },
  { name: "Sign Ups", href: "/ops/signups" },
  { name: "Event Logs", href: "/ops/logs" },
  { name: "Email Allowlist", href: "/ops/allowlist" },
];

export default function OpsLayout({ children }: OpsLayoutProps) {
  const pathname = usePathname();

  return (
    <AuthGate>
      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-8">
                <Link href="/" className="text-lg font-bold text-white">
                  DeMentha
                </Link>
                <Link 
                  href="/ops"
                  className="text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded hover:bg-emerald-500/20 transition-colors"
                >
                  Ops Portal
                </Link>
              </div>
              <nav className="flex items-center gap-6">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      "text-sm font-medium transition-colors",
                      pathname === item.href
                        ? "text-white"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="py-8">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
