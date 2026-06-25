"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { Resend } from "resend";
import { api } from "./_generated/api";
import { requireOpsPassword } from "./lib/auth";

export const sendInviteEmail = action({
  args: {
    opsPassword: v.string(),
    inviteId: v.id("ops_manual_invites"),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);

    const invite = await ctx.runQuery(api.opsManualInvites.getById, {
      opsPassword: args.opsPassword,
      inviteId: args.inviteId,
    });
    if (!invite) throw new Error("Invite not found");

    const siteUrl = process.env.SITE_URL;
    const resendApiKey = process.env.AUTH_RESEND_KEY;

    if (!siteUrl || !resendApiKey) {
      throw new Error("Email is not configured (SITE_URL or AUTH_RESEND_KEY missing)");
    }

    const resend = new Resend(resendApiKey);
    const fromEmail =
      process.env.AUTH_EMAIL_FROM ?? "DeMentha via Resend <onboarding@resend.dev>";
    const applyUrl = `${siteUrl.replace(/\/$/, "")}/apply`;

    const { error } = await resend.emails.send({
      from: fromEmail,
      to: invite.email,
      subject: "You're confirmed for DeMentha Mint — complete your registration",
      text: [
        `Hi ${invite.firstName},`,
        "",
        "You've been manually confirmed for DeMentha Mint by the ops team.",
        "",
        "To complete your registration and update your logistics details (Burning Man ticket, vehicle pass, etc.), click the link below:",
        "",
        applyUrl,
        "",
        "See you at camp!",
        "— DeMentha Ops",
      ].join("\n"),
    });

    if (error) {
      throw new Error(`Failed to send invite email: ${error.message}`);
    }

    await ctx.runMutation(api.opsManualInvites.markEmailSent, {
      opsPassword: args.opsPassword,
      inviteId: args.inviteId,
    });

    return { success: true };
  },
});
