"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { api } from "./_generated/api";

export const sendInviteEmail = action({
  args: {
    inviteId: v.id("newbie_invites"),
    newbieEmail: v.string(),
    sponsorName: v.string(),
  },
  handler: async (ctx, args) => {
    const resendApiKey = process.env.AUTH_RESEND_KEY;
    if (!resendApiKey) {
      await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
        inviteId: args.inviteId,
        sent: false,
        error: "AUTH_RESEND_KEY is not configured",
      });
      throw new Error("Invite email is not configured");
    }

    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
        inviteId: args.inviteId,
        sent: false,
        error: "SITE_URL is not configured",
      });
      throw new Error("SITE_URL is not configured");
    }

    const resend = new Resend(resendApiKey);
    const fromEmail =
      process.env.AUTH_EMAIL_FROM ?? "DeMentha via Resend <onboarding@resend.dev>";
    const applyUrl = `${siteUrl.replace(/\/$/, "")}/apply`;

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: args.newbieEmail,
      subject: "You’ve been invited to DeMentha",
      text: `You've been invited to DeMentha by ${args.sponsorName}. Please sign up here: ${applyUrl}`,
    });

    if (error) {
      await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
        inviteId: args.inviteId,
        sent: false,
        error: error.message,
      });
      throw new Error(`Failed to send invite email: ${error.message}`);
    }

    await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
      inviteId: args.inviteId,
      sent: true,
    });

    return { success: true };
  },
});
