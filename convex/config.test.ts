import { describe, expect, it } from "vitest";
import {
  CONFIG_DEFAULTS,
  isRuntimeConfigOverrideAllowed,
  mergeConfigValues,
  parseMaxMembers,
} from "./config";

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
    const merged = mergeConfigValues(CONFIG_DEFAULTS, {
      paymentsEnabled: "true",
    });

    expect(merged.paymentsEnabled).toBe("true");
  });

  it("keeps reservationFeeCents pinned to CONFIG_DEFAULTS", () => {
    const merged = mergeConfigValues(CONFIG_DEFAULTS, {
      reservationFeeCents: "15000",
      paymentsEnabled: "true",
    });

    expect(merged.reservationFeeCents).toBe(CONFIG_DEFAULTS.reservationFeeCents);
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
