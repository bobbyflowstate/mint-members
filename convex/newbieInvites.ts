import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isValidE164Phone } from "../src/lib/applications/validation";
import {
  buildNewbieInviteEmailFailedPayload,
  buildNewbieInviteEmailSentPayload,
  buildNewbieInvitedPayload,
  logEvent,
} from "./lib/events";
import { requireOpsPassword } from "./lib/auth";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function deriveInviteStatus(applicationStatus?: string | null): "invited" | "applied" | "confirmed" {
  if (!applicationStatus) {
    return "invited";
  }

  if (applicationStatus === "confirmed") {
    return "confirmed";
  }

  return "applied";
}

export const submitInvite = mutation({
  args: {
    newbieName: v.string(),
    newbieEmail: v.string(),
    newbiePhone: v.string(),
    whyTheyBelong: v.string(),
    preparednessAcknowledged: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to sponsor a newbie");
    }

    const invitesEnabledConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "newbieInvitesEnabled"))
      .first();
    const invitesEnabled = (invitesEnabledConfig?.value ?? "true") === "true";
    if (!invitesEnabled) {
      throw new Error("Newbie invites are currently disabled.");
    }

    const sponsor = await ctx.db.get(userId);
    if (!sponsor?.email) {
      throw new Error("Unable to determine sponsor email");
    }

    const sponsorApplication = await ctx.db
      .query("applications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!sponsorApplication || sponsorApplication.status !== "confirmed") {
      throw new Error("Only confirmed members can sponsor newbies");
    }

    if ((sponsorApplication.memberType ?? "alumni") !== "alumni") {
      throw new Error("Only confirmed alumni members can sponsor newbies");
    }

    const newbieName = normalizeName(args.newbieName);
    const newbieEmail = normalizeEmail(args.newbieEmail);
    const whyTheyBelong = args.whyTheyBelong.trim();

    if (!newbieName) {
      throw new Error("Newbie full name is required");
    }
    if (!newbieEmail) {
      throw new Error("Newbie email is required");
    }
    if (!isValidE164Phone(args.newbiePhone)) {
      throw new Error("Newbie phone must be in E.164 format");
    }
    if (!whyTheyBelong) {
      throw new Error("Please explain why this person would be a good addition");
    }
    if (!args.preparednessAcknowledged) {
      throw new Error("You must acknowledge sponsorship responsibilities");
    }

    const existingInvite = await ctx.db
      .query("newbie_invites")
      .withIndex("by_newbieEmail", (q) => q.eq("newbieEmail", newbieEmail))
      .first();

    if (existingInvite) {
      throw new Error(`${newbieName} has already been sponsored by ${existingInvite.sponsorName}.`);
    }

    const sponsorEmail = sponsor.email.toLowerCase();
    const sponsorName =
      `${sponsorApplication.firstName ?? ""} ${sponsorApplication.lastName ?? ""}`.trim() ||
      sponsorEmail;
    const now = Date.now();

    const existingAllowlistEntry = await ctx.db
      .query("email_allowlist")
      .withIndex("by_email", (q) => q.eq("email", newbieEmail))
      .first();

    if (existingAllowlistEntry) {
      throw new Error("This person is already invited.");
    }

    const allowlistEmailId = await ctx.db.insert("email_allowlist", {
      email: newbieEmail,
      addedBy: sponsorEmail,
      addedAt: now,
      memberType: "newbie",
      source: "sponsor_invite",
      sponsorUserId: userId,
      sponsorApplicationId: sponsorApplication._id,
      sponsorEmail,
      sponsorName,
      invitedAt: now,
    });

    const inviteId = await ctx.db.insert("newbie_invites", {
      sponsorUserId: userId,
      sponsorApplicationId: sponsorApplication._id,
      sponsorEmail,
      sponsorName,
      newbieName,
      newbieEmail,
      newbiePhone: args.newbiePhone,
      whyTheyBelong,
      preparednessAcknowledged: true,
      allowlistEmailId,
      createdAt: now,
      updatedAt: now,
    });

    await logEvent(ctx, {
      applicationId: sponsorApplication._id,
      eventType: "newbie_invited",
      payload: buildNewbieInvitedPayload({
        sponsorEmail,
        sponsorName,
        newbieEmail,
        newbieName,
      }),
      actor: sponsorEmail,
    });

    return {
      inviteId,
      inviteEmail: newbieEmail,
      sponsorName,
    };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const invites = await ctx.db
      .query("newbie_invites")
      .withIndex("by_sponsorUserId", (q) => q.eq("sponsorUserId", userId))
      .order("desc")
      .collect();

    return Promise.all(
      invites.map(async (invite) => {
        const application = invite.applicationId ? await ctx.db.get(invite.applicationId) : null;

        return {
          ...invite,
          derivedStatus: deriveInviteStatus(application?.status),
        };
      })
    );
  },
});

export const listForOps = query({
  args: {
    opsPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.opsPassword) {
      return [];
    }

    requireOpsPassword(args.opsPassword);

    const invites = await ctx.db
      .query("newbie_invites")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    return Promise.all(
      invites.map(async (invite) => {
        const application = invite.applicationId ? await ctx.db.get(invite.applicationId) : null;

        return {
          ...invite,
          derivedStatus: deriveInviteStatus(application?.status),
        };
      })
    );
  },
});

export const markInviteEmailOutcome = mutation({
  args: {
    inviteId: v.id("newbie_invites"),
    sent: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }

    const now = Date.now();

    if (args.sent) {
      await ctx.db.patch(args.inviteId, {
        inviteEmailSentAt: now,
        updatedAt: now,
      });

      await logEvent(ctx, {
        applicationId: invite.sponsorApplicationId,
        eventType: "newbie_invite_email_sent",
        payload: buildNewbieInviteEmailSentPayload({
          sponsorEmail: invite.sponsorEmail,
          sponsorName: invite.sponsorName,
          newbieEmail: invite.newbieEmail,
        }),
        actor: invite.sponsorEmail,
      });

      return { success: true };
    }

    await ctx.db.patch(args.inviteId, {
      updatedAt: now,
    });

    await logEvent(ctx, {
      applicationId: invite.sponsorApplicationId,
      eventType: "newbie_invite_email_failed",
      payload: buildNewbieInviteEmailFailedPayload({
        sponsorEmail: invite.sponsorEmail,
        sponsorName: invite.sponsorName,
        newbieEmail: invite.newbieEmail,
        error: args.error ?? "Unknown error",
      }),
      actor: invite.sponsorEmail,
    });

    return { success: false };
  },
});
