import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOpsPassword } from "./lib/auth";

/**
 * Debug query to check allowlist status
 * Requires ops password
 */
export const checkAllowlistStatus = query({
  args: {
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    // Get current user
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { error: "Not authenticated" };
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      return { error: "No email found for user" };
    }

    const userEmail = user.email.toLowerCase();

    // Check config
    const allowlistConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "allowlistEnabled"))
      .first();

    const allowlistEnabled = allowlistConfig?.value === "true";

    // Check if email is in allowlist
    const emailEntry = await ctx.db
      .query("email_allowlist")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .first();

    // Get all allowlisted emails for comparison (ops only)
    const allAllowlisted = await ctx.db
      .query("email_allowlist")
      .collect();

    return {
      userEmail,
      allowlistEnabled,
      allowlistConfigValue: allowlistConfig?.value || "not set",
      isEmailInAllowlist: emailEntry !== null,
      emailEntry: emailEntry || null,
      totalAllowlistedEmails: allAllowlisted.length,
      allAllowlistedEmails: allAllowlisted.map(e => e.email),
    };
  },
});
