import { describe, expect, it } from "vitest";
import { summarizeOpsTraining } from "./opsStatus";

const lnt = (extra: Record<string, unknown>) => ({
  moduleSlug: "lnt",
  moduleVersion: "2026.2",
  ...extra,
});
const general = (extra: Record<string, unknown>) => ({
  moduleSlug: "general",
  moduleVersion: "2026.2",
  ...extra,
});

function cell(records: Parameters<typeof summarizeOpsTraining>[0], slug: string) {
  return summarizeOpsTraining(records).cells.find((entry) => entry.slug === slug)!;
}

describe("summarizeOpsTraining", () => {
  it("reports every required module as not started for a member with no records", () => {
    const summary = summarizeOpsTraining([]);

    expect(summary.cells.map((entry) => entry.status)).toEqual([
      "not_started",
      "not_started",
    ]);
    expect(summary.completeCount).toBe(0);
    expect(summary.totalCount).toBe(2);
    expect(summary.allComplete).toBe(false);
    expect(summary.lastActivityAt).toBeUndefined();
  });

  it("separates a saved-but-unfinished module from an untouched one", () => {
    const summary = summarizeOpsTraining([lnt({ updatedAt: 300 })]);

    expect(cell([lnt({ updatedAt: 300 })], "lnt")).toMatchObject({
      status: "in_progress",
      updatedAt: 300,
      completedAt: undefined,
      staleCompletion: false,
    });
    expect(summary.completeCount).toBe(0);
  });

  it("counts a completion under any accepted version and marks the row complete", () => {
    const records = [
      { moduleSlug: "lnt", moduleVersion: "2026.1", completedAt: 100, updatedAt: 100 },
      general({ completedAt: 200, updatedAt: 200 }),
    ];
    const summary = summarizeOpsTraining(records);

    expect(summary.completeCount).toBe(2);
    expect(summary.allComplete).toBe(true);
    expect(cell(records, "lnt")).toMatchObject({
      status: "complete",
      completedAt: 100,
      staleCompletion: false,
      previousCompletedAt: undefined,
    });
    expect(summary.lastActivityAt).toBe(200);
  });

  it("flags a completion under a retired version as a retake rather than a fresh start", () => {
    const records = [
      { moduleSlug: "general", moduleVersion: "2025.1", completedAt: 50, updatedAt: 50 },
    ];

    expect(cell(records, "general")).toMatchObject({
      status: "not_started",
      completedAt: undefined,
      staleCompletion: true,
      previousCompletedAt: 50,
    });
    expect(summarizeOpsTraining(records).completeCount).toBe(0);
    expect(summarizeOpsTraining(records).lastActivityAt).toBe(50);
  });

  it("does not call an accepted in-progress module a retake", () => {
    const records = [
      { moduleSlug: "lnt", moduleVersion: "2025.1", completedAt: 10, updatedAt: 10 },
      lnt({ updatedAt: 400 }),
    ];

    expect(cell(records, "lnt")).toMatchObject({
      status: "in_progress",
      staleCompletion: true,
      updatedAt: 400,
    });
  });
});
