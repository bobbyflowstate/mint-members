import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  logEvent,
  buildAllowlistEmailsAddedPayload,
  buildAllowlistEmailRemovedPayload,
  buildAllowlistEmailsRemovedBulkPayload,
} from "./lib/events";
import { requireOpsPassword, getCurrentUserEmail } from "./lib/auth";

/**
 * Add emails to the allowlist in bulk
 * Normalizes emails to lowercase and skips duplicates
 * Requires ops password
 */
export const addEmails = mutation({
  args: {
    emails: v.array(v.string()),
    notes: v.optional(v.string()),
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    // Get authenticated user's email for logging
    const opsEmail = await getCurrentUserEmail(ctx);
    const now = Date.now();

    // Normalize emails to lowercase and get unique set
    const uniqueEmails = [...new Set(args.emails.map(email => email.toLowerCase().trim()))];

    let addedCount = 0;
    let duplicateCount = 0;

    // Check each email and insert if not exists
    for (const email of uniqueEmails) {
      const existing = await ctx.db
        .query("email_allowlist")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (existing) {
        duplicateCount++;
      } else {
        await ctx.db.insert("email_allowlist", {
          email,
          addedBy: opsEmail,
          addedAt: now,
          notes: args.notes,
        });
        addedCount++;
      }
    }

    // Log event
    await logEvent(ctx, {
      eventType: "allowlist_emails_added",
      payload: buildAllowlistEmailsAddedPayload({
        addedBy: opsEmail,
        totalAdded: addedCount,
        duplicates: duplicateCount,
        invalid: 0, // Validation happens on frontend
      }),
      actor: opsEmail,
    });

    return {
      added: addedCount,
      duplicates: duplicateCount,
      total: uniqueEmails.length,
    };
  },
});

/**
 * Remove a single email from the allowlist
 * Requires ops password
 */
export const removeEmail = mutation({
  args: {
    email: v.string(),
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    // Get authenticated user's email for logging
    const opsEmail = await getCurrentUserEmail(ctx);

    const normalizedEmail = args.email.toLowerCase().trim();

    const entry = await ctx.db
      .query("email_allowlist")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (!entry) {
      throw new Error("Email not found in allowlist");
    }

    await ctx.db.delete(entry._id);

    // Log event
    await logEvent(ctx, {
      eventType: "allowlist_email_removed",
      payload: buildAllowlistEmailRemovedPayload({
        email: normalizedEmail,
        removedBy: opsEmail,
      }),
      actor: opsEmail,
    });

    return { success: true };
  },
});

/**
 * Remove multiple emails from the allowlist
 * Requires ops password
 */
export const removeEmails = mutation({
  args: {
    emails: v.array(v.string()),
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    // Get authenticated user's email for logging
    const opsEmail = await getCurrentUserEmail(ctx);

    const normalizedEmails = args.emails.map(email => email.toLowerCase().trim());
    let removedCount = 0;

    for (const email of normalizedEmails) {
      const entry = await ctx.db
        .query("email_allowlist")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      if (entry) {
        await ctx.db.delete(entry._id);
        removedCount++;
      }
    }

    // Log event
    await logEvent(ctx, {
      eventType: "allowlist_emails_removed_bulk",
      payload: buildAllowlistEmailsRemovedBulkPayload({
        count: removedCount,
        removedBy: opsEmail,
      }),
      actor: opsEmail,
    });

    return {
      removed: removedCount,
      total: normalizedEmails.length,
    };
  },
});

/**
 * List all allowlisted emails
 * Requires ops password
 */
export const listAllowedEmails = query({
  args: {
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    return await ctx.db
      .query("email_allowlist")
      .withIndex("by_addedAt")
      .order("desc")
      .collect();
  },
});

/**
 * Check if an email is allowlisted
 * Only allows checking your own authenticated email
 */
export const isEmailAllowed = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Must be authenticated
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Get the authenticated user's email
    const user = await ctx.db.get(userId);
    if (!user || !user.email) {
      throw new Error("User email not found");
    }

    const userEmail = user.email.toLowerCase();
    const requestedEmail = args.email.toLowerCase().trim();

    // Can only check your own email
    if (userEmail !== requestedEmail) {
      throw new Error("Can only check your own email");
    }

    const entry = await ctx.db
      .query("email_allowlist")
      .withIndex("by_email", (q) => q.eq("email", requestedEmail))
      .first();

    return entry !== null;
  },
});

/**
 * Get count of allowlisted emails
 * Requires ops password
 */
export const count = query({
  args: {
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ops password
    requireOpsPassword(args.opsPassword);

    const entries = await ctx.db.query("email_allowlist").collect();
    return entries.length;
  },
});
