/**
 * Case- and accent-insensitive key for search matching.
 *
 * Rosters are full of names carrying diacritics that nobody types when they
 * go looking for someone — "Zoë" has to be findable as "zoe", "José" as
 * "jose". Decomposing to NFD splits an accented letter into its base letter
 * plus a combining mark, which the range below strips.
 *
 * A handful of Latin letters have no decomposition (ø, ł, ß, æ…), so they are
 * mapped explicitly first — NFD leaves them untouched.
 */

const NON_DECOMPOSING: Record<string, string> = {
  ø: "o",
  Ø: "o",
  đ: "d",
  Đ: "d",
  ð: "d",
  Ð: "d",
  ł: "l",
  Ł: "l",
  ß: "ss",
  æ: "ae",
  Æ: "ae",
  œ: "oe",
  Œ: "oe",
  þ: "th",
  Þ: "th",
  ħ: "h",
  Ħ: "h",
  ı: "i",
};

// Combining Diacritical Marks (U+0300–U+036F): what NFD splits accents into.
// Written as an explicit range rather than \p{Diacritic}, which needs a
// Unicode-property escape and an ES2018+ target (this project targets ES2017).
const COMBINING_MARKS = /[̀-ͯ]/g;

export function foldForSearch(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  let folded = "";
  for (const char of value) {
    folded += NON_DECOMPOSING[char] ?? char;
  }

  return folded.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/** True when `haystack` contains `needle`, ignoring case and accents. */
export function foldedIncludes(
  haystack: string | null | undefined,
  needle: string | null | undefined
): boolean {
  return foldForSearch(haystack).includes(foldForSearch(needle));
}

/** True when both sides are equal, ignoring case and accents. */
export function foldedEquals(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  return foldForSearch(a) === foldForSearch(b);
}
