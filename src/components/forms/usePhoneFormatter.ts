"use client";

import { useCallback, useEffect, useState } from "react";
import { canonicalizePhoneInput, formatPhoneDisplay } from "@/lib/phone/format";

type PhoneFormatterHook = {
  displayValue: string;
  handleChange: (rawValue: string) => string;
  handleBlur: (rawValue: string) => string;
  setCanonical: (canonicalValue: string) => void;
};

/**
 * Keeps form state canonical (E.164) while showing a friendlier formatted value.
 */
export function usePhoneFormatter(initialCanonicalValue = ""): PhoneFormatterHook {
  const [displayValue, setDisplayValue] = useState(() =>
    formatPhoneDisplay(initialCanonicalValue)
  );

  // Sync display state whenever the canonical value changes externally (e.g. form reset)
  useEffect(() => {
    setDisplayValue(formatPhoneDisplay(initialCanonicalValue));
  }, [initialCanonicalValue]);

  const applyValue = useCallback((rawValue: string) => {
    const canonical = canonicalizePhoneInput(rawValue);
    setDisplayValue(formatPhoneDisplay(canonical));
    return canonical;
  }, []);

  const handleChange = useCallback((rawValue: string) => applyValue(rawValue), [applyValue]);

  const handleBlur = useCallback((rawValue: string) => applyValue(rawValue), [applyValue]);

  const setCanonical = useCallback((canonicalValue: string) => {
    const canonical = canonicalizePhoneInput(canonicalValue);
    setDisplayValue(formatPhoneDisplay(canonical));
  }, []);

  return { displayValue, handleChange, handleBlur, setCanonical };
}
