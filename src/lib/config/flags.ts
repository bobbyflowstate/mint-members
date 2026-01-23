export function isFlagEnabled(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  return value.trim().toLowerCase() === "true";
}
