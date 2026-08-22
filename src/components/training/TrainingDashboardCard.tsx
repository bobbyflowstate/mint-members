"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { summarizeRequiredTraining } from "@/lib/training/status";
import { TrainingStatusPanel } from "./TrainingStatusPanel";

export function TrainingDashboardCard() {
  const records = useQuery(api.training.listMine);
  if (records === undefined) return <div className="h-40 animate-pulse rounded-2xl bg-white/5" />;

  return <TrainingStatusPanel summary={summarizeRequiredTraining(records)} />;
}
