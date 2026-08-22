import { describe, expect, it } from "vitest";
import { getTrainingModule } from "./modules";
import { moduleStatus, summarizeRequiredTraining, trainingHeadline } from "./status";

const lnt = getTrainingModule("lnt")!;
const general = getTrainingModule("general")!;

describe("moduleStatus", () => {
  it("reports not_started when no record exists", () => {
    expect(moduleStatus(lnt, [])).toBe("not_started");
  });

  it("reports in_progress for an accepted version with no completedAt", () => {
    expect(moduleStatus(lnt, [{ moduleSlug: "lnt", moduleVersion: "2026.2" }])).toBe("in_progress");
  });

  it("reports complete for the current version", () => {
    expect(moduleStatus(general, [{ moduleSlug: "general", moduleVersion: "2026.2", completedAt: 1 }]))
      .toBe("complete");
  });

  it("no longer counts a superseded General 2026.1 completion", () => {
    expect(moduleStatus(general, [{ moduleSlug: "general", moduleVersion: "2026.1", completedAt: 1 }]))
      .toBe("not_started");
  });

  it("ignores records for other modules and unaccepted versions", () => {
    expect(moduleStatus(general, [
      { moduleSlug: "lnt", moduleVersion: "2026.2", completedAt: 1 },
      { moduleSlug: "general", moduleVersion: "2025.1", completedAt: 1 },
    ])).toBe("not_started");
  });

  it("prefers a completion over an in-progress record for the same module", () => {
    expect(moduleStatus(general, [
      { moduleSlug: "general", moduleVersion: "2026.2" },
      { moduleSlug: "general", moduleVersion: "2026.2", completedAt: 1 },
    ])).toBe("complete");
  });
});

describe("summarizeRequiredTraining", () => {
  it("counts outstanding minutes across the modules still to do", () => {
    const summary = summarizeRequiredTraining([]);

    expect(summary.entries).toHaveLength(2);
    expect(summary.allComplete).toBe(false);
    expect(summary.minutesOutstanding).toBe(lnt.estimatedMinutes + general.estimatedMinutes);
  });

  it("drops completed modules from outstanding", () => {
    const summary = summarizeRequiredTraining([
      { moduleSlug: "lnt", moduleVersion: "2026.2", completedAt: 1 },
    ]);

    expect(summary.outstanding.map((entry) => entry.module.slug)).toEqual(["general"]);
    expect(summary.minutesOutstanding).toBe(general.estimatedMinutes);
  });

  it("is complete once every required module is on file", () => {
    const summary = summarizeRequiredTraining([
      { moduleSlug: "lnt", moduleVersion: "2026.2", completedAt: 1 },
      { moduleSlug: "general", moduleVersion: "2026.2", completedAt: 1 },
    ]);

    expect(summary.allComplete).toBe(true);
    expect(summary.minutesOutstanding).toBe(0);
  });
});

describe("trainingHeadline", () => {
  it("names both modules when nothing is started", () => {
    expect(trainingHeadline(summarizeRequiredTraining([])))
      .toBe("You still need to do Leave No Trace and How to be a Dementhian.");
  });

  it("names the single outstanding module", () => {
    expect(trainingHeadline(summarizeRequiredTraining([
      { moduleSlug: "general", moduleVersion: "2026.2", completedAt: 1 },
    ]))).toBe("You still need to do Leave No Trace.");
  });

  it("switches to finish once any outstanding module is underway", () => {
    expect(trainingHeadline(summarizeRequiredTraining([
      { moduleSlug: "lnt", moduleVersion: "2026.2" },
    ]))).toBe("Finish Leave No Trace and How to be a Dementhian.");
  });

  it("congratulates a fully trained member", () => {
    expect(trainingHeadline(summarizeRequiredTraining([
      { moduleSlug: "lnt", moduleVersion: "2026.2", completedAt: 1 },
      { moduleSlug: "general", moduleVersion: "2026.2", completedAt: 1 },
    ]))).toBe("You're trained up.");
  });
});
