import { describe, expect, it } from "vitest";
import { getTrainingModule, trainingModules } from "./modules";
import { createDefaultProgress, parseProgressState, selectModuleProgress } from "./progress";

describe("training module registry", () => {
  it("registers the required 2026 Leave No Trace module", () => {
    const trainingModule = getTrainingModule("lnt");

    expect(trainingModule).toMatchObject({
      slug: "lnt",
      version: "2026.1",
      title: "Leave No Trace",
      required: true,
      estimatedMinutes: 8,
    });
    expect(trainingModule?.completionPolicy.acceptedVersions).toContain("2026.1");
  });

  it("keeps module slugs and versions unique", () => {
    expect(new Set(trainingModules.map((module) => module.slug)).size).toBe(trainingModules.length);
    expect(
      new Set(trainingModules.map((module) => `${module.slug}:${module.version}`)).size
    ).toBe(trainingModules.length);
  });

  it("contains the complete LNT learning material", () => {
    const trainingModule = getTrainingModule("lnt");

    expect(trainingModule?.content.streams).toHaveLength(12);
    expect(trainingModule?.content.packItems).toHaveLength(6);
    expect(trainingModule?.content.quizItems).toHaveLength(8);
    expect(trainingModule?.content.quizItems.every((item) =>
      trainingModule.content.streams.some((stream) => stream.id === item.answer)
    )).toBe(true);
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
      quizQueue: [0, 1, 2, 3, 4, 5, 6, 7],
      quizMarks: {},
    });
  });

  it("falls back safely when stored state is invalid", () => {
    expect(parseProgressState("not json")).toEqual(createDefaultProgress());
    expect(parseProgressState('{"step":99}')).toEqual(createDefaultProgress());
  });

  it("preserves completion when an accepted legacy record has old state", () => {
    expect(parseProgressState('{"legacy":true}', true).step).toBe(13);
  });

  it("restores valid stored progress", () => {
    expect(parseProgressState('{"step":4,"role":"crew","packed":[0],"quizQueue":[2],"quizMarks":{"0":true}}'))
      .toMatchObject({ step: 4, role: "crew", packed: [0], quizQueue: [2] });
  });

  it("uses an accepted prior completion when the current version has no progress", () => {
    const priorCompletion = { moduleSlug: "lnt", moduleVersion: "2026.1", state: '{"step":13}', completedAt: 100 };
    expect(selectModuleProgress(
      [priorCompletion], "lnt", "2026.2", ["2026.1", "2026.2"]
    )).toBe(priorCompletion);
  });

  it("prefers current-version progress over an accepted prior completion", () => {
    const priorCompletion = { moduleSlug: "lnt", moduleVersion: "2026.1", state: '{"step":13}', completedAt: 100 };
    const currentProgress = { moduleSlug: "lnt", moduleVersion: "2026.2", state: '{"step":4}' };
    expect(selectModuleProgress(
      [priorCompletion, currentProgress], "lnt", "2026.2", ["2026.1", "2026.2"]
    )).toBe(currentProgress);
  });
});
