import type { TrainingProgressState, TrainingRole } from "./types";

export function createDefaultProgress(): TrainingProgressState {
  return {
    step: 0,
    packed: [],
    quizQueue: [0, 1, 2, 3, 4, 5, 6, 7],
    quizMarks: {},
  };
}

export function parseProgressState(value?: string, completed = false): TrainingProgressState {
  const finish = (state: TrainingProgressState) => completed ? { ...state, step: 13 } : state;
  if (!value) return finish(createDefaultProgress());
  try {
    const parsed = JSON.parse(value) as Partial<TrainingProgressState>;
    const validRole = parsed.role === undefined || (["camp", "crew", "lead"] as TrainingRole[]).includes(parsed.role);
    const validNumbers = (items: unknown, max: number) =>
      Array.isArray(items) && items.every((item) => Number.isInteger(item) && item >= 0 && item <= max);
    if (
      !Number.isInteger(parsed.step) || parsed.step! < 0 || parsed.step! > 13 ||
      !validRole || !validNumbers(parsed.packed, 5) || !validNumbers(parsed.quizQueue, 7) ||
      !parsed.quizMarks || typeof parsed.quizMarks !== "object"
    ) return finish(createDefaultProgress());
    return finish({
      step: parsed.step!,
      role: parsed.role,
      packed: [...parsed.packed!],
      quizQueue: [...parsed.quizQueue!],
      quizMarks: { ...parsed.quizMarks },
    });
  } catch {
    return finish(createDefaultProgress());
  }
}

type ModuleProgressRecord = {
  moduleSlug: string;
  moduleVersion: string;
  state: string;
  completedAt?: number;
};

export function selectModuleProgress<T extends ModuleProgressRecord>(
  records: readonly T[],
  moduleSlug: string,
  currentVersion: string,
  acceptedVersions: readonly string[]
): T | undefined {
  const moduleRecords = records.filter((record) => record.moduleSlug === moduleSlug);
  const current = moduleRecords.find((record) => record.moduleVersion === currentVersion);
  if (current) return current;
  return moduleRecords
    .filter((record) => record.completedAt && acceptedVersions.includes(record.moduleVersion))
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
}
