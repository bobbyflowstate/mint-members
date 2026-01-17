import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Runtime config overrides from database
 * 
 * IMPORTANT: The primary configuration is in src/config/camp.config.ts
 * This query only returns DATABASE OVERRIDES, not defaults.
 * The frontend merges these overrides with camp.config.ts values.
 */

/**
 * Get runtime configuration overrides from the database
 * Returns ONLY values that have been explicitly set in the database
 * The frontend's camp.config.ts provides all default values
 */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    // Get all config entries from database (overrides only)
    const dbConfigs = await ctx.db.query("config").collect();
    
    // Create a map of database values - these are OVERRIDES only
    const dbConfigMap: Record<string, string> = {};
    for (const config of dbConfigs) {
      dbConfigMap[config.key] = config.value;
    }
    
    // Return only database overrides, NOT merged with defaults
    // The frontend will merge with camp.config.ts defaults
    return dbConfigMap;
  },
});

/**
 * Get a single configuration override by key
 * Returns null if no override exists (frontend should use camp.config.ts default)
 */
export const getConfigByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const dbConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    // Return database override or null (frontend uses camp.config.ts for defaults)
    return dbConfig?.value ?? null;
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
 * Delete a configuration override (reverts to camp.config.ts default)
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
