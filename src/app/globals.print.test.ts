import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");

describe("shift print typography", () => {
  it("scopes US Letter settings to the shifts schedule", () => {
    expect(css).toContain("@page shifts");
    expect(css).toContain("page: shifts");
    expect(css).not.toMatch(/@page\s*\{/);
  });

  it("uses distance-readable type sizes on US Letter", () => {
    expect(css).toContain("--shift-print-name-size: 21.6pt");
    expect(css).toContain("--shift-print-role-size: 16.8pt");
    expect(css).toContain("--shift-print-time-size: 19.2pt");
    expect(css).toContain("--shift-print-activity-size: 20.4pt");
  });
});
