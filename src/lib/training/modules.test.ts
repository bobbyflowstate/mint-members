import { describe, expect, it } from "vitest";
import { getTrainingModule, trainingModules } from "./modules";
import {
  createDefaultGeneralProgress,
  createDefaultProgress,
  isGeneralStateComplete,
  parseGeneralProgressState,
  parseProgressState,
  selectModuleProgress,
} from "./progress";

function getLntModule() {
  const trainingModule = getTrainingModule("lnt");
  if (trainingModule?.slug !== "lnt") throw new Error("LNT module is not registered");
  return trainingModule;
}

function getGeneralModule() {
  const trainingModule = getTrainingModule("general");
  if (trainingModule?.slug !== "general") throw new Error("General module is not registered");
  return trainingModule;
}

describe("training module registry", () => {
  it("registers the required 2026 Leave No Trace module", () => {
    const trainingModule = getTrainingModule("lnt");

    expect(trainingModule).toMatchObject({
      slug: "lnt",
      version: "2026.2",
      title: "Leave No Trace",
      required: true,
      estimatedMinutes: 10,
    });
    expect(trainingModule?.completionPolicy.acceptedVersions).toContain("2026.1");
    expect(trainingModule?.completionPolicy.acceptedVersions).toContain("2026.2");
  });

  it("keeps module slugs and versions unique", () => {
    expect(new Set(trainingModules.map((module) => module.slug)).size).toBe(trainingModules.length);
    expect(
      new Set(trainingModules.map((module) => `${module.slug}:${module.version}`)).size
    ).toBe(trainingModules.length);
  });

  it("contains the complete LNT learning material", () => {
    const trainingModule = getLntModule();

    expect(trainingModule.content.streams).toHaveLength(12);
    expect(trainingModule.content.packItems).toHaveLength(6);
    expect(trainingModule.content.quizItems).toHaveLength(8);
    expect(trainingModule.content.quizItems.every((item) =>
      trainingModule.content.streams.some((stream) => stream.id === item.answer)
    )).toBe(true);
  });

  it("registers the required 2026 General module", () => {
    const trainingModule = getTrainingModule("general");

    expect(trainingModule).toMatchObject({
      slug: "general",
      version: "2026.2",
      title: "How to be a Dementhian",
      required: true,
      estimatedMinutes: 28,
    });
    expect(trainingModule?.completionPolicy.acceptedVersions).toEqual(["2026.2"]);
  });

  it("contains the complete General learning material", () => {
    const { content } = getGeneralModule();

    expect(content.videos).toHaveLength(2);
    expect(content.videos.every((video) => video.youtubeId && video.credit)).toBe(true);
    expect(content.videos.filter((video) => video.ours)).toHaveLength(1);
    expect(content.bikes.filter((bike) => bike.bad)).toHaveLength(3);
    expect(content.lawItems).toHaveLength(4);
    expect(content.barRules).toHaveLength(4);
    expect(content.mojitoSteps).toHaveLength(9);
    expect(content.cultureQuiz).toHaveLength(4);
    expect(content.barQuiz).toHaveLength(3);
    for (const quiz of [...content.cultureQuiz, ...content.barQuiz]) {
      expect(quiz.answer).toBeGreaterThanOrEqual(0);
      expect(quiz.answer).toBeLessThan(quiz.options.length);
    }
    expect(content.cultureQuiz.filter((quiz) => quiz.critical)).toHaveLength(2);
    expect(content.barQuiz.filter((quiz) => quiz.critical)).toHaveLength(2);
  });

  it("returns undefined for an unknown module", () => {
    expect(getTrainingModule("not-real")).toBeUndefined();
  });
});

describe("training progress state", () => {
  it("creates a fresh quiz queue for a new module", () => {
    expect(createDefaultProgress()).toMatchObject({
      step: 0,
      packed: [],
      streamsRead: [],
      quizQueue: [0, 1, 2, 3, 4, 5, 6, 7],
      quizMarks: {},
    });
  });

  it("falls back safely when stored state is invalid", () => {
    expect(parseProgressState("not json")).toEqual(createDefaultProgress());
    expect(parseProgressState('{"step":99}')).toEqual(createDefaultProgress());
    expect(parseProgressState('{"step":5,"packed":[],"streamsRead":[99],"quizQueue":[],"quizMarks":{}}'))
      .toEqual(createDefaultProgress());
  });

  it("preserves completion when an accepted legacy record has old state", () => {
    expect(parseProgressState('{"legacy":true}', true).step).toBe(13);
  });

  it("restores valid stored progress", () => {
    expect(parseProgressState('{"step":5,"role":"crew","packed":[0],"streamsRead":[0,11],"quizQueue":[2],"quizMarks":{"0":true}}'))
      .toMatchObject({ step: 5, role: "crew", packed: [0], streamsRead: [0, 11], quizQueue: [2] });
  });

  it("tolerates records saved before stream reading was tracked", () => {
    expect(parseProgressState('{"step":4,"role":"crew","packed":[0],"quizQueue":[2],"quizMarks":{"0":true}}'))
      .toMatchObject({ step: 4, role: "crew", streamsRead: [] });
  });

  it("dedupes repeated indexes in stored progress", () => {
    expect(parseProgressState('{"step":5,"role":"crew","packed":[0,0],"streamsRead":[3,3,1],"quizQueue":[],"quizMarks":{}}'))
      .toMatchObject({ packed: [0], streamsRead: [3, 1] });
  });

  it("uses an accepted prior completion when the current version has no progress", () => {
    const priorCompletion = { moduleSlug: "lnt", moduleVersion: "2026.1", state: '{"step":13}', completedAt: 100 };
    expect(selectModuleProgress(
      [priorCompletion], "lnt", "2026.2", ["2026.1", "2026.2"]
    )).toBe(priorCompletion);
  });

  it("falls back to an accepted in-progress record when the current version has none", () => {
    const inProgress = { moduleSlug: "lnt", moduleVersion: "2026.1", state: '{"step":10}', updatedAt: 50 };
    expect(selectModuleProgress(
      [inProgress], "lnt", "2026.2", ["2026.1", "2026.2"]
    )).toBe(inProgress);
  });

  it("prefers current-version progress over an accepted prior completion", () => {
    const priorCompletion = { moduleSlug: "lnt", moduleVersion: "2026.1", state: '{"step":13}', completedAt: 100 };
    const currentProgress = { moduleSlug: "lnt", moduleVersion: "2026.2", state: '{"step":4}' };
    expect(selectModuleProgress(
      [priorCompletion, currentProgress], "lnt", "2026.2", ["2026.1", "2026.2"]
    )).toBe(currentProgress);
  });
});

describe("general module progress state", () => {
  const completeState = {
    step: 30,
    kind: "first" as const,
    videos: [0, 1],
    bikes: [3, 4, 5],
    law: [0, 1, 2, 3],
    bar: [0, 1, 2, 3],
    mojito: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    cultureQuiz: { queue: [], marks: { 0: true, 1: true, 2: true, 3: true } },
    barQuiz: { queue: [], marks: { 0: true, 1: true, 2: true } },
  };

  it("creates fresh quiz queues for a new module", () => {
    expect(createDefaultGeneralProgress()).toMatchObject({
      step: 0,
      videos: [],
      bikes: [],
      cultureQuiz: { queue: [0, 1, 2, 3], marks: {} },
      barQuiz: { queue: [0, 1, 2], marks: {} },
    });
  });

  it("falls back safely when stored state is invalid", () => {
    expect(parseGeneralProgressState("not json")).toEqual(createDefaultGeneralProgress());
    expect(parseGeneralProgressState('{"step":99}')).toEqual(createDefaultGeneralProgress());
    expect(parseGeneralProgressState(JSON.stringify({ ...completeState, videos: [9] })))
      .toEqual(createDefaultGeneralProgress());
  });

  it("restores valid stored progress and preserves completion for legacy records", () => {
    expect(parseGeneralProgressState(JSON.stringify({ ...completeState, step: 6 })))
      .toMatchObject({ step: 6, kind: "first", bikes: [3, 4, 5] });
    expect(parseGeneralProgressState('{"legacy":true}', true).step).toBe(30);
  });

  it("recognizes a genuinely complete state", () => {
    expect(isGeneralStateComplete(completeState)).toBe(true);
  });

  it("allows wrong answers only on non-critical quiz questions", () => {
    expect(isGeneralStateComplete({
      ...completeState,
      cultureQuiz: { queue: [], marks: { 0: true, 1: true, 2: false, 3: false } },
    })).toBe(true);
    expect(isGeneralStateComplete({
      ...completeState,
      cultureQuiz: { queue: [], marks: { 0: false, 1: true, 2: true, 3: true } },
    })).toBe(false);
    expect(isGeneralStateComplete({
      ...completeState,
      barQuiz: { queue: [], marks: { 0: true, 1: true } },
    })).toBe(false);
  });

  it("requires every bad bike, video, sheet, and mojito step", () => {
    expect(isGeneralStateComplete({ ...completeState, bikes: [3, 4] })).toBe(false);
    expect(isGeneralStateComplete({ ...completeState, bikes: [0, 1, 2] })).toBe(false);
    expect(isGeneralStateComplete({ ...completeState, videos: [0] })).toBe(false);
    expect(isGeneralStateComplete({ ...completeState, law: [0, 1, 2] })).toBe(false);
    expect(isGeneralStateComplete({ ...completeState, mojito: [0, 1, 2, 3, 4, 5, 6, 7] })).toBe(false);
    expect(isGeneralStateComplete({ ...completeState, step: 29 })).toBe(false);
    expect(isGeneralStateComplete({ ...completeState, kind: undefined })).toBe(false);
  });
});
