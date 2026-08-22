import { trainingModules } from "./modules";
import type { TrainingModule } from "./types";

export type ModuleStatus = "complete" | "in_progress" | "not_started";

/** The shape of a `training.listMine` row, narrowed to what status needs. */
export interface TrainingProgressRecord {
  moduleSlug: string;
  moduleVersion: string;
  completedAt?: number;
}

export interface ModuleStatusEntry {
  module: TrainingModule;
  status: ModuleStatus;
}

export const STATUS_LABELS: Record<ModuleStatus, string> = {
  complete: "Complete",
  in_progress: "In progress",
  not_started: "Not started",
};

export function moduleStatus(
  module: TrainingModule,
  records: readonly TrainingProgressRecord[]
): ModuleStatus {
  const accepted = records.filter((record) =>
    record.moduleSlug === module.slug &&
    module.completionPolicy.acceptedVersions.includes(record.moduleVersion)
  );
  if (accepted.some((record) => record.completedAt)) return "complete";
  return accepted.length > 0 ? "in_progress" : "not_started";
}

export interface TrainingSummary {
  /** Every required module, in registry order, with its status. */
  entries: readonly ModuleStatusEntry[];
  /** The required modules still to do, in registry order. */
  outstanding: readonly ModuleStatusEntry[];
  /** True when every required module is complete. */
  allComplete: boolean;
  /** Estimated minutes left across the outstanding modules. */
  minutesOutstanding: number;
}

export function summarizeRequiredTraining(
  records: readonly TrainingProgressRecord[]
): TrainingSummary {
  const entries = trainingModules
    .filter((module) => module.required)
    .map((module) => ({ module, status: moduleStatus(module, records) }));
  const outstanding = entries.filter((entry) => entry.status !== "complete");
  return {
    entries,
    outstanding,
    allComplete: outstanding.length === 0,
    minutesOutstanding: outstanding.reduce((sum, entry) => sum + entry.module.estimatedMinutes, 0),
  };
}

/** The line that tells a member what they still owe us, by name. */
export function trainingHeadline(summary: TrainingSummary): string {
  const { outstanding } = summary;
  if (outstanding.length === 0) return "You're trained up.";
  const titles = outstanding.map((entry) => entry.module.title);
  const named = titles.length === 1
    ? titles[0]
    : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
  const started = outstanding.some((entry) => entry.status === "in_progress");
  return started ? `Finish ${named}.` : `You still need to do ${named}.`;
}
