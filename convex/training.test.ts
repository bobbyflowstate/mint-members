import { describe, expect, it, vi } from "vitest";
import {
  completeProgressRecord,
  assertCompletableProgress,
  requireTrainingUser,
  requireActiveTrainingMember,
  saveProgressRecord,
} from "./training";

function progressQuery(existing: unknown) {
  const first = vi.fn().mockResolvedValue(existing);
  const unique = vi.fn().mockResolvedValue(existing);
  const withIndex = vi.fn().mockImplementation((_name, callback) => {
    const q = { eq: vi.fn().mockReturnThis() };
    callback(q);
    return { first, unique };
  });
  return { withIndex, first, unique };
}

describe("training progress", () => {
  const completeLntState = {
    step: 13,
    role: "camp",
    packed: [0, 1, 2, 3, 4, 5],
    streamsRead: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    quizQueue: [],
    quizMarks: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true },
  };
  const completeState = JSON.stringify(completeLntState);

  const completeGeneralState = JSON.stringify({
    step: 30,
    kind: "return",
    videos: [0, 1],
    bikes: [3, 4, 5],
    law: [0, 1, 2, 3],
    bar: [0, 1, 2, 3],
    mojito: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    cultureQuiz: { queue: [], marks: { 0: true, 1: true, 2: true, 3: true } },
    barQuiz: { queue: [], marks: { 0: true, 1: true, 2: true } },
  });

  it("validates the general module with its own completion rules", () => {
    expect(() => assertCompletableProgress({
      moduleSlug: "general", moduleVersion: "2026.2", state: completeGeneralState,
    })).not.toThrow();
    expect(() => assertCompletableProgress({
      moduleSlug: "general", moduleVersion: "2025.1", state: completeGeneralState,
    })).toThrow("Unknown training module version");
    expect(() => assertCompletableProgress({
      moduleSlug: "general", moduleVersion: "2026.2", state: JSON.stringify({ step: 30 }),
    })).toThrow("Training module is not complete");
    expect(() => assertCompletableProgress({
      moduleSlug: "general", moduleVersion: "2026.2", state: completeState,
    })).toThrow("Training module is not complete");
  });

  it("accepts only registered LNT versions with genuinely complete state", () => {
    expect(() => assertCompletableProgress({
      moduleSlug: "unknown", moduleVersion: "2026.1", state: completeState,
    })).toThrow("Unknown training module");
    expect(() => assertCompletableProgress({
      moduleSlug: "lnt", moduleVersion: "2025.1", state: completeState,
    })).toThrow("Unknown training module version");
    expect(() => assertCompletableProgress({
      moduleSlug: "lnt", moduleVersion: "2026.2", state: JSON.stringify({ step: 13 }),
    })).toThrow("Training module is not complete");
    expect(() => assertCompletableProgress({
      moduleSlug: "lnt", moduleVersion: "2026.2", state: completeState,
    })).not.toThrow();
    expect(() => assertCompletableProgress({
      moduleSlug: "lnt", moduleVersion: "2026.1", state: completeState,
    })).not.toThrow();
  });

  it("rejects completion when any stream card is unread", () => {
    expect(() => assertCompletableProgress({
      moduleSlug: "lnt",
      moduleVersion: "2026.2",
      state: JSON.stringify({ ...completeLntState, streamsRead: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }),
    })).toThrow("Training module is not complete");
  });

  it("rejects non-object progress state without crashing", () => {
    expect(() => assertCompletableProgress({
      moduleSlug: "lnt", moduleVersion: "2026.2", state: "null",
    })).toThrow("Training module is not complete");
    expect(() => assertCompletableProgress({
      moduleSlug: "general", moduleVersion: "2026.2", state: "null",
    })).toThrow("Training module is not complete");
  });

  it("rejects unauthenticated access", () => {
    expect(() => requireTrainingUser(null)).toThrow("Unauthenticated");
    expect(requireTrainingUser("user_1" as never)).toBe("user_1");
  });

  it("requires an active application before training writes", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const withIndex = vi.fn().mockReturnValue({ first });
    const ctx = { db: { query: vi.fn().mockReturnValue({ withIndex }) } };

    await expect(requireActiveTrainingMember(ctx as never, "user_1" as never))
      .rejects.toThrow("active application");

    first.mockResolvedValue({ status: "confirmed", cancelled: false });
    await expect(requireActiveTrainingMember(ctx as never, "user_1" as never))
      .resolves.toMatchObject({ status: "confirmed" });
  });

  it("rejects progress for unregistered modules and versions", async () => {
    const ctx = { db: { query: vi.fn(), insert: vi.fn(), patch: vi.fn() } };
    await expect(saveProgressRecord(ctx as never, "user_1" as never, {
      moduleSlug: "unknown", moduleVersion: "2026.1", state: "{}",
    }, 100)).rejects.toThrow("Unknown training module");
    await expect(saveProgressRecord(ctx as never, "user_1" as never, {
      moduleSlug: "lnt", moduleVersion: "2025.1", state: "{}",
    }, 100)).rejects.toThrow("Unknown training module version");
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("creates progress for the exact module version", async () => {
    const insert = vi.fn().mockResolvedValue("progress_1");
    const query = vi.fn().mockReturnValue(progressQuery(null));
    const ctx = { db: { query, insert, patch: vi.fn() } };

    const result = await saveProgressRecord(ctx as never, "user_1" as never, {
      moduleSlug: "lnt",
      moduleVersion: "2026.2",
      state: "{\"step\":2}",
    }, 100);

    expect(insert).toHaveBeenCalledWith("training_progress", expect.objectContaining({
      userId: "user_1",
      moduleSlug: "lnt",
      moduleVersion: "2026.2",
      state: "{\"step\":2}",
      startedAt: 100,
      updatedAt: 100,
    }));
    expect(result).toEqual({ id: "progress_1", completedAt: undefined });
  });

  it("resumes by patching the existing version without erasing completion", async () => {
    const existing = { _id: "progress_1", completedAt: 90 };
    const patch = vi.fn();
    const ctx = { db: { query: vi.fn().mockReturnValue(progressQuery(existing)), patch } };

    const result = await saveProgressRecord(ctx as never, "user_1" as never, {
      moduleSlug: "lnt",
      moduleVersion: "2026.2",
      state: "{\"step\":4}",
    }, 100);

    expect(patch).toHaveBeenCalledWith("progress_1", {
      state: "{\"step\":4}",
      updatedAt: 100,
    });
    expect(result.completedAt).toBe(90);
  });

  it("completes idempotently and records the pledge time", async () => {
    const existing = { _id: "progress_1", completedAt: undefined };
    const patch = vi.fn();
    const ctx = { db: { query: vi.fn().mockReturnValue(progressQuery(existing)), patch } };

    const first = await completeProgressRecord(ctx as never, "user_1" as never, {
      moduleSlug: "lnt",
      moduleVersion: "2026.2",
      state: completeState,
    }, 200);

    expect(patch).toHaveBeenCalledWith("progress_1", expect.objectContaining({
      completedAt: 200,
      pledgedAt: 200,
      updatedAt: 200,
    }));
    expect(first.completedAt).toBe(200);

    patch.mockClear();
    const alreadyComplete = { _id: "progress_1", completedAt: 150, pledgedAt: 150 };
    const secondCtx = { db: { query: vi.fn().mockReturnValue(progressQuery(alreadyComplete)), patch } };
    const second = await completeProgressRecord(secondCtx as never, "user_1" as never, {
      moduleSlug: "lnt", moduleVersion: "2026.2", state: "{}",
    }, 300);

    expect(patch).not.toHaveBeenCalled();
    expect(second.completedAt).toBe(150);
  });
});
