"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/ops/AuthGate";
import clsx from "clsx";

interface OpsLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/ops" },
  { name: "Review Queue", href: "/ops/review" },
  { name: "Sign Ups", href: "/ops/signups" },
  { name: "Event Logs", href: "/ops/logs" },
  { name: "Email Allowlist", href: "/ops/allowlist" },
];

export default function OpsLayout({ children }: OpsLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const isMobileMenuOpen = mobileMenuPath === pathname;

  const toggleMobileMenu = () => {
    setMobileMenuPath((currentPath) => (currentPath === pathname ? null : pathname));
  };

  return (
    <AuthGate>
      <div className="min-h-screen">
        {/* Header */}
        <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 sm:gap-6">
                <Link href="/" className="text-lg font-bold text-white">
                  DeMentha
                </Link>
                <Link
                  href="/ops"
                  className="hidden sm:inline-flex text-sm font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded hover:bg-emerald-500/20 transition-colors"
                >
                  Ops Portal
                </Link>
                <span className="inline-flex sm:hidden text-xs font-medium text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded">
                  Ops
                </span>
              </div>
              <nav className="hidden md:flex items-center gap-6">
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
              <button
                type="button"
                onClick={toggleMobileMenu}
                aria-expanded={isMobileMenuOpen}
                aria-controls="ops-mobile-navigation"
                aria-label="Toggle ops navigation menu"
                className="inline-flex items-center justify-center rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors md:hidden"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  )}
                </svg>
              </button>
            </div>
            {isMobileMenuOpen && (
              <nav
                id="ops-mobile-navigation"
                className="md:hidden border-t border-white/10 py-3"
              >
                <div className="grid gap-1">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuPath(null)}
                      className={clsx(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        pathname === item.href
                          ? "bg-white/10 text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </nav>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
