"use client";

import { Hero, Stats, Expectations } from "@/components/marketing";
import { getLandingContent } from "@/config/content";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Home() {
  // Try to get config from Convex, fall back to defaults
  const config = useQuery(api.config.getConfig);
  const content = getLandingContent(config ?? undefined);

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
