import { generalModule } from "./general";
import { lntModule } from "./lnt";
import type {
  GeneralKind,
  GeneralProgressState,
  GeneralQuizItem,
  GeneralQuizState,
  TrainingProgressState,
  TrainingRole,
} from "./types";

export const LNT_FINAL_STEP = 13;
export const GENERAL_FINAL_STEP = 30;

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

export function createDefaultGeneralProgress(): GeneralProgressState {
  return {
    step: 0,
    videos: [],
    safety: [],
    bikes: [],
    law: [],
    bar: [],
    mojito: [],
    cultureQuiz: { queue: generalModule.content.cultureQuiz.map((_, index) => index), marks: {} },
    barQuiz: { queue: generalModule.content.barQuiz.map((_, index) => index), marks: {} },
  };
}

export function parseGeneralProgressState(value?: string, completed = false): GeneralProgressState {
  const finish = (state: GeneralProgressState) => completed ? { ...state, step: GENERAL_FINAL_STEP } : state;
  if (!value) return finish(createDefaultGeneralProgress());
  try {
    const parsed = JSON.parse(value) as Partial<GeneralProgressState>;
    const content = generalModule.content;
    const validKind = parsed.kind === undefined || (["first", "return", "lead"] as GeneralKind[]).includes(parsed.kind);
    const validNumbers = (items: unknown, max: number) =>
      Array.isArray(items) && items.every((item) => Number.isInteger(item) && item >= 0 && item <= max);
    const validQuiz = (quiz: Partial<GeneralQuizState> | undefined, max: number) =>
      !!quiz && validNumbers(quiz.queue, max) && !!quiz.marks && typeof quiz.marks === "object";
    if (
      !Number.isInteger(parsed.step) || parsed.step! < 0 || parsed.step! > GENERAL_FINAL_STEP ||
      !validKind ||
      !validNumbers(parsed.videos, content.videos.length - 1) ||
      !validNumbers(parsed.safety, content.safetyItems.length - 1) ||
      !validNumbers(parsed.bikes, content.bikes.length - 1) ||
      !validNumbers(parsed.law, content.lawItems.length - 1) ||
      !validNumbers(parsed.bar, content.barRules.length - 1) ||
      !validNumbers(parsed.mojito, content.mojitoSteps.length - 1) ||
      !validQuiz(parsed.cultureQuiz, content.cultureQuiz.length - 1) ||
      !validQuiz(parsed.barQuiz, content.barQuiz.length - 1)
    ) return finish(createDefaultGeneralProgress());
    return finish({
      step: parsed.step!,
      kind: parsed.kind,
      videos: [...parsed.videos!],
      safety: [...parsed.safety!],
      bikes: [...parsed.bikes!],
      law: [...parsed.law!],
      bar: [...parsed.bar!],
      mojito: [...parsed.mojito!],
      cultureQuiz: { queue: [...parsed.cultureQuiz!.queue], marks: { ...parsed.cultureQuiz!.marks } },
      barQuiz: { queue: [...parsed.barQuiz!.queue], marks: { ...parsed.barQuiz!.marks } },
    });
  } catch {
    return finish(createDefaultGeneralProgress());
  }
}

export function isLntStateComplete(state: Partial<TrainingProgressState>): boolean {
  const content = lntModule.content;
  const allPackItemsChecked = Array.isArray(state.packed) &&
    content.packItems.every((_, index) => state.packed!.includes(index));
  const everyQuizItemCorrect = Array.isArray(state.quizQueue) && state.quizQueue.length === 0 &&
    content.quizItems.every((_, index) => state.quizMarks?.[index] === true);
  const validRole = state.role === "camp" || state.role === "crew" || state.role === "lead";
  return state.step === LNT_FINAL_STEP && validRole && allPackItemsChecked && everyQuizItemCorrect;
}

export function isGeneralStateComplete(state: Partial<GeneralProgressState>): boolean {
  const content = generalModule.content;
  const covered = (items: unknown, count: number) =>
    Array.isArray(items) && Array.from({ length: count }, (_, index) => index).every((index) => items.includes(index));
  const quizDone = (bank: readonly GeneralQuizItem[], quiz?: GeneralQuizState) =>
    !!quiz && Array.isArray(quiz.queue) && quiz.queue.length === 0 &&
    bank.every((item, index) => item.critical ? quiz.marks?.[index] === true : typeof quiz.marks?.[index] === "boolean");
  const validKind = state.kind === "first" || state.kind === "return" || state.kind === "lead";
  const badBikesFound = content.bikes.every((bike, index) =>
    !bike.bad || (Array.isArray(state.bikes) && state.bikes.includes(index))
  );
  return state.step === GENERAL_FINAL_STEP && validKind &&
    covered(state.videos, content.videos.length) &&
    covered(state.safety, content.safetyItems.length) &&
    badBikesFound &&
    covered(state.law, content.lawItems.length) &&
    covered(state.bar, content.barRules.length) &&
    covered(state.mojito, content.mojitoSteps.length) &&
    quizDone(content.cultureQuiz, state.cultureQuiz) &&
    quizDone(content.barQuiz, state.barQuiz);
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
