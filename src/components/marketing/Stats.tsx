"use client";

import { LandingContent } from "@/config/content";

interface StatsProps {
  content: LandingContent;
}

export function Stats({ content }: StatsProps) {
  const stats = [
    {
      label: "Burning Man Dates",
      value: content.burningManDates,
      description: "The official event dates",
    },
    {
      label: `${content.campName} Camp Dates`,
      value: content.campDates,
      description: "Includes early arrival for setup and extended time for tear-down",
    },
    {
      label: "Earliest Departure",
      value: content.departureCutoffFormatted,
      description: "Stay through the burn and teardown",
    },
    {
      label: "Non Refundable Registration Fee",
      value: content.reservationFeeFormatted,
      description: "Secures your spot",
    },
  ];

  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:max-w-none">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Important Dates & Details
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Everything you need to know about joining {content.campName} at Burning Man 2025
            </p>
          </div>
          <dl className="mt-16 grid grid-cols-1 gap-4 overflow-hidden rounded-2xl text-center sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col bg-white/5 backdrop-blur-sm p-8 ring-1 ring-white/10 rounded-xl"
              >
                <dt className="text-sm font-semibold leading-6 text-slate-400">
                  {stat.label}
                </dt>
                <dd className="order-first text-2xl font-bold tracking-tight text-white">
                  {stat.value}
                </dd>
                <dd className="mt-2 text-xs text-slate-500">
                  {stat.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
