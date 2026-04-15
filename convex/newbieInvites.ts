import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isValidE164Phone } from "../src/lib/applications/validation";
import { CONFIG_DEFAULTS } from "./config";
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

function buildDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
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

function getInviteReviewStatus(
  invite: {
    status?: "pending" | "accepted" | "denied";
    allowlistEmailId?: unknown;
  }
): "pending" | "accepted" | "denied" {
  if (invite.status) {
    return invite.status;
  }

  return invite.allowlistEmailId ? "accepted" : "pending";
}

async function listInvitesByEmail(
  ctx: { db: { query: (table: "newbie_invites") => { withIndex: (index: "by_newbieEmail", cb: (q: any) => any) => { collect: () => Promise<any[]> } } } },
  newbieEmail: string
) {
  return ctx.db
    .query("newbie_invites")
    .withIndex("by_newbieEmail", (q) => q.eq("newbieEmail", newbieEmail))
    .collect();
}

export const submitInvite = mutation({
  args: {
    newbieFirstName: v.string(),
    newbieLastName: v.string(),
    newbieEmail: v.string(),
    newbiePhone: v.string(),
    estimatedArrival: v.string(),
    estimatedDeparture: v.string(),
    earlyDepartureReason: v.optional(v.string()),
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

    const newbieFirstName = normalizeName(args.newbieFirstName);
    const newbieLastName = normalizeName(args.newbieLastName);
    const newbieName = buildDisplayName(newbieFirstName, newbieLastName);
    const newbieEmail = normalizeEmail(args.newbieEmail);
    const whyTheyBelong = args.whyTheyBelong.trim();
    const estimatedArrival = args.estimatedArrival.trim();
    const estimatedDeparture = args.estimatedDeparture.trim();
    const earlyDepartureReason = args.earlyDepartureReason?.trim();

    if (!newbieFirstName) {
      throw new Error("Newbie first name is required");
    }
    if (!newbieLastName) {
      throw new Error("Newbie last name is required");
    }
    if (!newbieEmail) {
      throw new Error("Newbie email is required");
    }
    if (!isValidE164Phone(args.newbiePhone)) {
      throw new Error("Newbie phone must be in E.164 format");
    }
    if (!estimatedArrival) {
      throw new Error("Estimated arrival date is required");
    }
    if (!estimatedDeparture) {
      throw new Error("Estimated departure date is required");
    }
    const cutoffConfig = await ctx.db
      .query("config")
      .withIndex("by_key", (q) => q.eq("key", "departureCutoff"))
      .first();
    const departureCutoff = cutoffConfig?.value ?? CONFIG_DEFAULTS.departureCutoff;
    const requiresEarlyDepartureReason =
      new Date(estimatedDeparture) < new Date(departureCutoff);
    if (requiresEarlyDepartureReason && !earlyDepartureReason) {
      throw new Error("Please explain why this newbie needs to leave before the standard departure date.");
    }
    if (!whyTheyBelong) {
      throw new Error("Please explain why this person would be a good addition");
    }
    if (!args.preparednessAcknowledged) {
      throw new Error("You must acknowledge sponsorship responsibilities");
    }

    const existingInvites = await listInvitesByEmail(ctx, newbieEmail);
    const existingInvite = existingInvites.find(
      (invite) => getInviteReviewStatus(invite) !== "denied"
    );

    if (existingInvite) {
      throw new Error(`${newbieEmail} has already been sponsored by ${existingInvite.sponsorName}.`);
    }

    const sponsorEmail = sponsor.email.toLowerCase();
    const sponsorName =
      `${sponsorApplication.firstName ?? ""} ${sponsorApplication.lastName ?? ""}`.trim() ||
      sponsorEmail;
    const now = Date.now();

    const inviteId = await ctx.db.insert("newbie_invites", {
      sponsorUserId: userId,
      sponsorApplicationId: sponsorApplication._id,
      sponsorEmail,
      sponsorName,
      newbieFirstName,
      newbieLastName,
      newbieName,
      newbieEmail,
      newbiePhone: args.newbiePhone,
      estimatedArrival,
      estimatedDeparture,
      earlyDepartureReason: requiresEarlyDepartureReason ? earlyDepartureReason : undefined,
      whyTheyBelong,
      preparednessAcknowledged: true,
      status: "pending",
      approvalEmailSentAt: undefined,
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
          newbieName:
            invite.newbieName ??
            buildDisplayName(invite.newbieFirstName ?? "", invite.newbieLastName ?? ""),
          status: getInviteReviewStatus(invite),
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
          newbieName:
            invite.newbieName ??
            buildDisplayName(invite.newbieFirstName ?? "", invite.newbieLastName ?? ""),
          status: getInviteReviewStatus(invite),
          derivedStatus: deriveInviteStatus(application?.status),
        };
      })
    );
  },
});

export const setInviteDecision = mutation({
  args: {
    inviteId: v.id("newbie_invites"),
    accepted: v.boolean(),
    opsPassword: v.string(),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);

    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new Error("Invite not found");
    }

    if (!args.accepted && invite.applicationId) {
      throw new Error("Cannot deny an invite after the newbie has applied.");
    }

    const now = Date.now();

    if (args.accepted) {
      const existingAllowlistEntry = await ctx.db
        .query("email_allowlist")
        .withIndex("by_email", (q) => q.eq("email", invite.newbieEmail))
        .first();

      let allowlistEmailId = invite.allowlistEmailId;
      if (!existingAllowlistEntry) {
        allowlistEmailId = await ctx.db.insert("email_allowlist", {
          email: invite.newbieEmail,
          addedBy: invite.sponsorEmail,
          addedAt: now,
          memberType: "newbie",
          source: "sponsor_invite",
          sponsorUserId: invite.sponsorUserId,
          sponsorApplicationId: invite.sponsorApplicationId,
          sponsorEmail: invite.sponsorEmail,
          sponsorName: invite.sponsorName,
          invitedAt: invite.createdAt,
        });
      }

      await ctx.db.patch(args.inviteId, {
        status: "accepted",
        allowlistEmailId,
        updatedAt: now,
      });

      return {
        success: true,
        status: "accepted" as const,
        shouldSendApprovalEmail: !invite.approvalEmailSentAt,
      };
    }

    if (invite.allowlistEmailId) {
      const allowlistEntry = await ctx.db.get(invite.allowlistEmailId);
      if (
        allowlistEntry &&
        allowlistEntry.source === "sponsor_invite" &&
        allowlistEntry.email === invite.newbieEmail &&
        allowlistEntry.sponsorApplicationId === invite.sponsorApplicationId
      ) {
        await ctx.db.delete(invite.allowlistEmailId);
      }
    }

    await ctx.db.patch(args.inviteId, {
      status: "denied",
      updatedAt: now,
    });

    return {
      success: true,
      status: "denied" as const,
      shouldSendApprovalEmail: false,
    };
  },
});

export const markInviteEmailOutcome = mutation({
  args: {
    inviteId: v.id("newbie_invites"),
    emailType: v.literal("approved"),
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
        approvalEmailSentAt: now,
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
