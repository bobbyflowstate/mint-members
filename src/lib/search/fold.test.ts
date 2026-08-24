import { describe, expect, it } from "vitest";
import { foldForSearch, foldedEquals, foldedIncludes } from "./fold";

describe("foldForSearch", () => {
  it("lowercases", () => {
    expect(foldForSearch("Alex RIVERA")).toBe("alex rivera");
  });

  it("strips accents that decompose", () => {
    expect(foldForSearch("Zoë")).toBe("zoe");
    expect(foldForSearch("José")).toBe("jose");
    expect(foldForSearch("Renée Dupré")).toBe("renee dupre");
    expect(foldForSearch("Ångström")).toBe("angstrom");
    expect(foldForSearch("Nguyễn")).toBe("nguyen");
  });

  it("maps Latin letters that have no decomposition", () => {
    expect(foldForSearch("Ørjan")).toBe("orjan");
    expect(foldForSearch("Łukasz")).toBe("lukasz");
    expect(foldForSearch("Straße")).toBe("strasse");
    expect(foldForSearch("Æsa")).toBe("aesa");
  });

  it("leaves unaccented text alone", () => {
    expect(foldForSearch("Sam Okafor")).toBe("sam okafor");
  });

  it("treats null and undefined as empty", () => {
    expect(foldForSearch(null)).toBe("");
    expect(foldForSearch(undefined)).toBe("");
  });
});

describe("foldedIncludes", () => {
  it("matches an unaccented query against an accented name", () => {
    expect(foldedIncludes("Zoë Dupré", "zoe")).toBe(true);
    expect(foldedIncludes("Zoë Dupré", "dupre")).toBe(true);
  });

  it("matches an accented query against an unaccented name", () => {
    expect(foldedIncludes("Jose Garcia", "José")).toBe(true);
  });

  it("still rejects genuine non-matches", () => {
    expect(foldedIncludes("Zoë Dupré", "smith")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(foldedIncludes("anyone", "")).toBe(true);
  });
});

describe("foldedEquals", () => {
  it("ignores case and accents", () => {
    expect(foldedEquals("Renée", "renee")).toBe(true);
    expect(foldedEquals("Renée", "renata")).toBe(false);
  });
});
