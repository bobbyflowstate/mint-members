const MAX_E164_DIGITS = 15;

/**
 * Normalize user input into canonical E.164 form used by the backend.
 * Keeps a single leading plus, strips other characters, and caps total digits.
 */
export function canonicalizePhoneInput(raw: string): string {
  if (!raw) {
    return "";
  }

  const digits = raw.replace(/\D/g, "").slice(0, MAX_E164_DIGITS);

  if (digits.length === 0) {
    // Preserve a typed plus so the user can continue entering digits
    return raw.trim().startsWith("+") ? "+" : "";
  }

  return `+${digits}`;
}

/**
 * Split digits into country code + groups for display.
 * This is a best-effort formatter – it guarantees a readable grouping but
 * does not attempt full libphonenumber fidelity.
 */
export function formatPhoneDisplay(input: string): string {
  const canonical = canonicalizePhoneInput(input);

  if (!canonical) {
    return "";
  }

  if (canonical === "+") {
    return "+";
  }

  const digits = canonical.slice(1);
  if (!digits) {
    return "+";
  }

  const { countryCode, nationalNumber } = splitCountryCode(digits);
  const groups = chunkNationalDigits(nationalNumber);
  const pieces = [`+${countryCode}`];

  if (groups.length) {
    pieces.push(groups.join(" "));
  }

  return pieces.join(" ");
}

/** Convenience helper that returns canonical + display strings together. */
export function formatPhoneInput(raw: string): { canonical: string; display: string } {
  const canonical = canonicalizePhoneInput(raw);
  return {
    canonical,
    display: formatPhoneDisplay(canonical),
  };
}

function splitCountryCode(digits: string): { countryCode: string; nationalNumber: string } {
  if (!digits) {
    return { countryCode: "", nationalNumber: "" };
  }

  // North America (+1) and Russia/Kazakhstan (+7) are single-digit codes.
  if (digits[0] === "1" || digits[0] === "7") {
    const code = digits.slice(0, 1);
    return {
      countryCode: code,
      nationalNumber: digits.slice(code.length),
    };
  }

  // Fallback to two-digit country codes for most other regions.
  const codeLength = Math.min(2, digits.length);
  return {
    countryCode: digits.slice(0, codeLength),
    nationalNumber: digits.slice(codeLength),
  };
}

function chunkNationalDigits(national: string): string[] {
  if (!national) {
    return [];
  }

  const groups: string[] = [];
  let remaining = national;

  while (remaining.length > 4) {
    groups.push(remaining.slice(0, 3));
    remaining = remaining.slice(3);
  }

  if (remaining.length) {
    groups.push(remaining);
  }

  return groups;
}
