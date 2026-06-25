import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireOpsPassword, getCurrentUserEmail } from "./lib/auth";
import { upsertOpsSignupRow } from "./opsSignupRows";

const arrivalDepartureTime = v.union(
  v.literal("12:01 am to 11.00 am"),
  v.literal("11.01 am to 6.00 pm"),
  v.literal("6.01 pm to 12.00 am")
);

export const add = mutation({
  args: {
    opsPassword: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    phone: v.string(),
    memberType: v.union(v.literal("alumni"), v.literal("newbie")),
    arrival: v.string(),
    arrivalTime: arrivalDepartureTime,
    departure: v.string(),
    departureTime: arrivalDepartureTime,
    notes: v.optional(v.string()),
    hasFullPayment: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);

    const normalizedEmail = args.email.trim().toLowerCase();
    const now = Date.now();

    const existingInvite = await ctx.db
      .query("ops_manual_invites")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingInvite) {
      throw new Error(`A manual invite already exists for ${normalizedEmail}`);
    }

    const existingApp = await ctx.db
      .query("applications")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingApp) {
      throw new Error(`${normalizedEmail} already has an application in the system`);
    }

    const existingAllowlist = await ctx.db
      .query("email_allowlist")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    const addedBy = await getCurrentUserEmail(ctx);

    if (!existingAllowlist) {
      await ctx.db.insert("email_allowlist", {
        email: normalizedEmail,
        addedBy,
        addedAt: now,
        memberType: args.memberType,
        source: "ops",
      });
    }

    const inviteId = await ctx.db.insert("ops_manual_invites", {
      email: normalizedEmail,
      firstName: args.firstName.trim(),
      lastName: args.lastName.trim(),
      phone: args.phone.trim(),
      memberType: args.memberType,
      arrival: args.arrival,
      arrivalTime: args.arrivalTime,
      departure: args.departure,
      departureTime: args.departureTime,
      notes: args.notes?.trim() || undefined,
      hasFullPayment: args.hasFullPayment,
      addedBy,
      createdAt: now,
      updatedAt: now,
    });

    return { inviteId };
  },
});

export const listUnclaimedForOps = query({
  args: { opsPassword: v.string() },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const all = await ctx.db
      .query("ops_manual_invites")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
    return all.filter((invite) => !invite.claimedAt);
  },
});

export const getMyPendingInvite = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user?.email) return null;

    const invite = await ctx.db
      .query("ops_manual_invites")
      .withIndex("by_email", (q) => q.eq("email", user.email!.toLowerCase()))
      .first();

    if (!invite || invite.claimedAt) return null;
    return invite;
  },
});

export const setFullPayment = mutation({
  args: {
    opsPassword: v.string(),
    inviteId: v.id("ops_manual_invites"),
    hasFullPayment: v.boolean(),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    await ctx.db.patch(args.inviteId, { hasFullPayment: args.hasFullPayment, updatedAt: Date.now() });
  },
});

export const getById = query({
  args: {
    opsPassword: v.string(),
    inviteId: v.id("ops_manual_invites"),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    return await ctx.db.get(args.inviteId);
  },
});

export const markEmailSent = mutation({
  args: {
    opsPassword: v.string(),
    inviteId: v.id("ops_manual_invites"),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    await ctx.db.patch(args.inviteId, {
      inviteEmailSentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const claim = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to claim this invite");
    }

    const user = await ctx.db.get(userId);
    if (!user?.email) {
      throw new Error("Unable to retrieve user email");
    }

    const userEmail = user.email.toLowerCase();

    const invite = await ctx.db
      .query("ops_manual_invites")
      .withIndex("by_email", (q) => q.eq("email", userEmail))
      .first();

    if (!invite) {
      throw new Error("No manual invite found for your email");
    }
    if (invite.claimedAt) {
      throw new Error("This invite has already been claimed");
    }

    const existingApp = await ctx.db
      .query("applications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (existingApp) {
      throw new Error("You already have an application");
    }

    const now = Date.now();

    const applicationId = await ctx.db.insert("applications", {
      userId,
      firstName: invite.firstName,
      lastName: invite.lastName,
      email: userEmail,
      phone: invite.phone,
      arrival: invite.arrival,
      arrivalTime: invite.arrivalTime,
      departure: invite.departure,
      departureTime: invite.departureTime,
      status: "confirmed",
      dietaryPreference: "",
      allergyFlag: false,
      earlyDepartureRequested: false,
      paymentAllowed: false,
      memberType: invite.memberType,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("confirmed_members", {
      userId,
      applicationId,
      hasBurningManTicket: false,
      hasVehiclePass: false,
      hasFullPayment: invite.hasFullPayment,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(invite._id, {
      claimedByUserId: userId,
      claimedApplicationId: applicationId,
      claimedAt: now,
      updatedAt: now,
    });

    await upsertOpsSignupRow(ctx, applicationId);

    return { applicationId };
  },
});
