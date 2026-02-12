/**
 * Config keys that must always come from CONFIG_DEFAULTS.
 * We keep reservationFeeCents immutable to prevent stale runtime overrides
 * from drifting user-facing pricing copy away from the repo source of truth.
 */
const NON_OVERRIDABLE_CONFIG_KEYS = new Set(["reservationFeeCents"]);

export function isRuntimeConfigOverrideAllowed(key: string): boolean {
  return !NON_OVERRIDABLE_CONFIG_KEYS.has(key);
}

export function mergeConfigValues(
  defaults: Record<string, string>,
  overrides: Record<string, string>
): Record<string, string> {
  const merged = {
    ...defaults,
    ...overrides,
  };

  for (const key of NON_OVERRIDABLE_CONFIG_KEYS) {
    if (key in defaults) {
      merged[key] = defaults[key];
    }
  }

  return merged;
}

/**
 * Parse maxMembers from a config string, with NaN guard.
 * Returns 0 (unlimited) only if the raw value is literally "0".
 * Throws on non-numeric / NaN values so a bad config can never
 * silently disable the capacity cap.
 */
export function parseMaxMembers(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid maxMembers config value: "${raw}". Must be a non-negative integer.`
    );
  }
  return Number(trimmed);
}
