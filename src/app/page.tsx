"use client";

import { Hero, Stats, Expectations } from "@/components/marketing";
import { getLandingContent } from "@/config/content";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AppConfig } from "@/config/content";

export default function Home() {
  const config = useQuery(api.config.getConfig);

  // Show loading state while config loads
  if (!config) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </main>
    );
  }

  const content = getLandingContent(config as AppConfig);

  return (
    <main className="min-h-screen">
      <Hero content={content} />
      <Stats content={content} />
      <Expectations content={content} />
      
      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-sm text-slate-400">
            &copy; {new Date().getFullYear()} {content.campName}. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
