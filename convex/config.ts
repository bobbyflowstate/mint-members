import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Default configuration values
 * These are used when no database override exists
 * 
 * Note: Primary configuration is in src/config/camp.config.ts
 * These values can be overridden at runtime via the database
 */
const DEFAULT_CONFIG: Record<string, string> = {
  // Burning Man 2025 dates
  burningManStartDate: "2025-08-24",
  burningManEndDate: "2025-09-01",
  
  // Camp operational dates
  earliestArrival: "2025-08-22",
  latestDeparture: "2025-09-02",
  
  // Departure cutoff - members leaving before this need ops approval
  departureCutoff: "2025-09-01",
  
  // Reservation fee in cents (e.g., 35000 = $350.00)
  reservationFeeCents: "35000",
  
  // Camp name for display
  campName: "DeMentha",
};

/**
 * Get all configuration values, merging defaults with database overrides
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
    
    // Merge defaults with database overrides (database takes precedence)
    const mergedConfig: Record<string, string> = {
      ...DEFAULT_CONFIG,
      ...dbConfigMap,
    };
    
    return mergedConfig;
  },
});

/**
 * Get a single configuration value by key
 */
export const getConfigByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const dbConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (dbConfig) {
      return dbConfig.value;
    }
    
    // Return default if exists
    return DEFAULT_CONFIG[args.key] ?? null;
  },
});

/**
 * Set a configuration value (admin use only)
 * Creates or updates the config entry
 */
export const setConfig = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
 * Delete a configuration value (resets to default)
 */
export const deleteConfig = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
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

// Export defaults for use in other modules
export { DEFAULT_CONFIG };
