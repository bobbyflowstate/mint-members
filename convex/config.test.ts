import { describe, expect, it } from "vitest";
import {
  isRuntimeConfigOverrideAllowed,
  mergeConfigValues,
  parseMaxMembers,
} from "./configPolicy";

const DEFAULTS = {
  reservationFeeCents: "10000",
  paymentsEnabled: "false",
  departureCutoff: "2026-09-06",
};

describe("config override policy", () => {
  it("disallows runtime overrides for reservationFeeCents", () => {
    expect(isRuntimeConfigOverrideAllowed("reservationFeeCents")).toBe(false);
  });

  it("allows runtime overrides for mutable keys", () => {
    expect(isRuntimeConfigOverrideAllowed("paymentsEnabled")).toBe(true);
    expect(isRuntimeConfigOverrideAllowed("departureCutoff")).toBe(true);
  });
});

describe("mergeConfigValues", () => {
  it("applies runtime overrides for mutable keys", () => {
    const merged = mergeConfigValues(DEFAULTS, {
      paymentsEnabled: "true",
    });

    expect(merged.paymentsEnabled).toBe("true");
  });

  it("keeps reservationFeeCents pinned to CONFIG_DEFAULTS", () => {
    const merged = mergeConfigValues(DEFAULTS, {
      reservationFeeCents: "15000",
      paymentsEnabled: "true",
    });

    expect(merged.reservationFeeCents).toBe(DEFAULTS.reservationFeeCents);
    expect(merged.paymentsEnabled).toBe("true");
  });
});

describe("parseMaxMembers", () => {
  it("parses a valid integer string", () => {
    expect(parseMaxMembers("70")).toBe(70);
  });

  it("throws on invalid values", () => {
    expect(() => parseMaxMembers("7.5")).toThrow();
    expect(() => parseMaxMembers("abc")).toThrow();
    expect(() => parseMaxMembers("-1")).toThrow();
  });
});
