import { trainingModules } from "./modules";
import { moduleStatus, type ModuleStatus, type TrainingProgressRecord } from "./status";

/** A `training_progress` row narrowed to what the ops view reads. */
export interface OpsTrainingProgressRecord extends TrainingProgressRecord {
  updatedAt?: number;
}

export interface OpsTrainingModuleCell {
  slug: string;
  title: string;
  status: ModuleStatus;
  /** When the accepted completion landed, if there is one. */
  completedAt?: number;
  /** Last save against an accepted version — what "in progress since" means. */
  updatedAt?: number;
  /**
   * True when the member completed this module under a version the current
   * completion policy no longer accepts: they finished it once, and they owe
   * us a retake. Ops needs this distinct from a plain "not started".
   */
  staleCompletion: boolean;
  /**
   * When they last passed a version that no longer counts. Training is
   * retaken every year, so "did it last August" is the useful thing to see
   * next to a retake — a blank means they have genuinely never done it.
   */
  previousCompletedAt?: number;
}

export interface OpsTrainingSummary {
  /** One cell per required module, in registry order. */
  cells: OpsTrainingModuleCell[];
  /** Required modules complete under an accepted version. */
  completeCount: number;
  /** Required modules in total. */
  totalCount: number;
  allComplete: boolean;
  /** Latest touch across every module, accepted version or not. */
  lastActivityAt?: number;
}

function latest(values: (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length > 0 ? Math.max(...present) : undefined;
}

/**
 * Per-member training state for the ops table: one cell per required module
 * plus the counts the table sorts and filters on.
 */
export function summarizeOpsTraining(
  records: readonly OpsTrainingProgressRecord[]
): OpsTrainingSummary {
  const cells = trainingModules
    .filter((module) => module.required)
    .map((module) => {
      const mine = records.filter((record) => record.moduleSlug === module.slug);
      const accepted = mine.filter((record) =>
        module.completionPolicy.acceptedVersions.includes(record.moduleVersion)
      );
      const status = moduleStatus(module, records);
      const retiredCompletions = mine.filter(
        (record) =>
          record.completedAt !== undefined &&
          !module.completionPolicy.acceptedVersions.includes(record.moduleVersion)
      );
      const staleCompletion = status !== "complete" && retiredCompletions.length > 0;
      return {
        slug: module.slug,
        title: module.title,
        status,
        completedAt: latest(accepted.map((record) => record.completedAt)),
        updatedAt: latest(accepted.map((record) => record.updatedAt)),
        staleCompletion,
        previousCompletedAt: staleCompletion
          ? latest(retiredCompletions.map((record) => record.completedAt))
          : undefined,
      };
    });

  const completeCount = cells.filter((cell) => cell.status === "complete").length;

  return {
    cells,
    completeCount,
    totalCount: cells.length,
    allComplete: cells.length > 0 && completeCount === cells.length,
    lastActivityAt: latest(
      records.flatMap((record) => [record.updatedAt, record.completedAt])
    ),
  };
}
