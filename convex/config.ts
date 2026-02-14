import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOpsPassword } from "./lib/auth";
import {
  isRuntimeConfigOverrideAllowed,
  mergeConfigValues,
  parseMaxMembers,
} from "./configPolicy";

export {
  isRuntimeConfigOverrideAllowed,
  mergeConfigValues,
  parseMaxMembers,
};

/**
 * =============================================================================
 * CAMP CONFIGURATION - SINGLE SOURCE OF TRUTH
 * =============================================================================
 * 
 * Edit these defaults to configure your camp. All values are stored here and
 * served to both frontend and backend from Convex.
 * 
 * To override at runtime without redeploying:
 *   npx convex run config:setConfig '{"key": "paymentsEnabled", "value": "true"}'
 */
export const CONFIG_DEFAULTS: Record<string, string> = {
  // Camp identity
  campName: "DeMentha",
  year: "2026",

  // Burning Man dates (official event)
  burningManStartDate: "2026-08-31",
  burningManEndDate: "2026-09-06",

  // Camp operational dates
  earliestArrival: "2026-08-26",
  latestDeparture: "2026-09-09",

  // Departure cutoff - leaving before this date's final departure window requires ops approval
  departureCutoff: "2026-09-06",

  // Reservation fee in cents (10000 = $100.00)
  // NOTE: This key is intentionally NOT runtime-overridable.
  reservationFeeCents: "10000",

  // Capacity (0 = unlimited)
  maxMembers: "70",
  
  // Whether applications are open
  applicationsOpen: "true",

  // Whether payments are enabled
  paymentsEnabled: "false",

  // Email allowlist enforcement
  allowlistEnabled: "false",
};

/**
 * Get all configuration values
 * Returns defaults merged with any database overrides
 */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    // Get all config entries from database
    const dbConfigs = await ctx.db.query("config").collect();
    
    // Create a map of database values
    const dbConfigMap: Record<string, string> = {};
    for (const config of dbConfigs) {
      dbConfigMap[config.key] = config.value;
    }
    
    // Merge defaults with DB values, then enforce non-overridable keys.
    return mergeConfigValues(CONFIG_DEFAULTS, dbConfigMap);
  },
});

/**
 * Get a single configuration value by key
 * Returns database override if exists, otherwise the default
 */
export const getConfigByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    if (!isRuntimeConfigOverrideAllowed(args.key)) {
      return CONFIG_DEFAULTS[args.key] ?? null;
    }

    const dbConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    return dbConfig?.value ?? CONFIG_DEFAULTS[args.key] ?? null;
  },
});

/**
 * Set a configuration value (ops only)
 * Creates or updates the config entry
 * Requires ops password
 */
export const setConfig = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    if (!isRuntimeConfigOverrideAllowed(args.key)) {
      throw new Error(
        `Config key "${args.key}" cannot be overridden at runtime. ` +
        "Edit CONFIG_DEFAULTS in convex/config.ts instead."
      );
    }

    const existing = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing config
      await ctx.db.patch(existing._id, {
        value: args.value,
        description: args.description,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new config entry
      return await ctx.db.insert("config", {
        key: args.key,
        value: args.value,
        description: args.description,
        updatedAt: now,
      });
    }
  },
});

/**
 * Delete a configuration override (reverts to convex/config.ts default)
 * Requires ops password
 */
export const deleteConfig = mutation({
  args: {
    key: v.string(),
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    const existing = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
