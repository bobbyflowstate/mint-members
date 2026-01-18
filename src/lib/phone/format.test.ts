import { describe, it, expect } from "vitest";
import { canonicalizePhoneInput, formatPhoneDisplay, formatPhoneInput } from "./format";

describe("canonicalizePhoneInput", () => {
  it("strips formatting characters and keeps leading plus", () => {
    const result = canonicalizePhoneInput(" +1 (415) 555-0101 ");
    expect(result).toBe("+14155550101");
  });

  it("adds a plus automatically when digits are entered without one", () => {
    const result = canonicalizePhoneInput("1415 555 0101");
    expect(result).toBe("+14155550101");
  });

  it("preserves a lone plus so users can keep typing", () => {
    const result = canonicalizePhoneInput("+");
    expect(result).toBe("+");
  });

  it("returns empty string when no digits or plus are present", () => {
    const result = canonicalizePhoneInput("abc");
    expect(result).toBe("");
  });

  it("caps digits to 15 characters per E.164", () => {
    const result = canonicalizePhoneInput("+12345678901234567890");
    expect(result).toBe("+123456789012345");
  });
});

describe("formatPhoneDisplay", () => {
  it("formats NANP numbers with +1 and 3-3-4 grouping", () => {
    const result = formatPhoneDisplay("+14155550101");
    expect(result).toBe("+1 415 555 0101");
  });

  it("handles partially entered NANP numbers", () => {
    const result = formatPhoneDisplay("+1415");
    expect(result).toBe("+1 415");
  });

  it("formats non-NANP numbers with a best-effort country code split", () => {
    const result = formatPhoneDisplay("+442079460958");
    expect(result).toBe("+44 207 946 0958");
  });

  it("shows a solitary plus when no digits exist", () => {
    const result = formatPhoneDisplay("+");
    expect(result).toBe("+");
  });

  it("returns empty string when canonical value is empty", () => {
    const result = formatPhoneDisplay("");
    expect(result).toBe("");
  });
});

describe("formatPhoneInput", () => {
  it("returns canonical and display strings from raw input", () => {
    const result = formatPhoneInput("1 (415) 555-0101");
    expect(result).toEqual({
      canonical: "+14155550101",
      display: "+1 415 555 0101",
    });
  });
});
