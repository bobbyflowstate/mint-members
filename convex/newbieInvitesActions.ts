"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { api } from "./_generated/api";

async function sendInviteEmail(
  ctx: any,
  args: {
    inviteId: string;
    newbieEmail: string;
    emailType: "approved";
    subject: string;
    text: string;
  }
) {
  const resendApiKey = process.env.AUTH_RESEND_KEY;
  if (!resendApiKey) {
    await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
      inviteId: args.inviteId,
      emailType: args.emailType,
      sent: false,
      error: "AUTH_RESEND_KEY is not configured",
    });
    throw new Error("Invite email is not configured");
  }

  const resend = new Resend(resendApiKey);
  const fromEmail =
    process.env.AUTH_EMAIL_FROM ?? "DeMentha via Resend <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: args.newbieEmail,
    subject: args.subject,
    text: args.text,
  });

  if (error) {
    throw new Error(`Failed to send invite email: ${error.message}`);
  }
}

export const sendInviteApprovedEmail = action({
  args: {
    inviteId: v.id("newbie_invites"),
    newbieEmail: v.string(),
    sponsorName: v.string(),
  },
  handler: async (ctx, args) => {
    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
        inviteId: args.inviteId,
        emailType: "approved",
        sent: false,
        error: "SITE_URL is not configured",
      });
      throw new Error("SITE_URL is not configured");
    }

    try {
      await sendInviteEmail(ctx, {
        inviteId: args.inviteId,
        newbieEmail: args.newbieEmail,
        emailType: "approved",
        subject: "You can now apply to DeMentha",
        text: `Your invite to DeMentha from ${args.sponsorName} has been accepted. You can now apply here: ${siteUrl.replace(/\/$/, "")}/apply`,
      });
      await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
        inviteId: args.inviteId,
        emailType: "approved",
        sent: true,
      });
      return { success: true };
    } catch (error) {
      await ctx.runMutation(api.newbieInvites.markInviteEmailOutcome, {
        inviteId: args.inviteId,
        emailType: "approved",
        sent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});
