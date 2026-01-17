"use client";

import Link from "next/link";
import { LandingContent } from "@/config/content";

interface HeroProps {
  content: LandingContent;
}

export function Hero({ content }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-20 sm:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-amber-500/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {/* Camp name badge */}
          <div className="mb-8 flex justify-center">
            <div className="relative rounded-full px-4 py-1.5 text-sm leading-6 text-emerald-400 ring-1 ring-emerald-500/30 hover:ring-emerald-500/50 transition-all">
              <span className="font-semibold">{content.campName}</span>
              <span className="mx-2 text-slate-500">•</span>
              <span className="text-slate-400">Burning Man 2025</span>
            </div>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
            {content.heroTitle}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg leading-8 text-slate-300">
            {content.heroSubtitle}
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/apply"
              className="rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-all"
            >
              Reserve Your Spot
            </Link>
            <Link
              href="#expectations"
              className="text-sm font-semibold leading-6 text-slate-300 hover:text-white transition-colors"
            >
              Learn more <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Key info */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">Reservation Fee</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {content.reservationFeeFormatted}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">Camp Dates</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {content.campDates}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm p-6 ring-1 ring-white/10">
              <p className="text-sm text-slate-400">Location</p>
              <p className="mt-2 text-2xl font-bold text-white">
                Black Rock City
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
