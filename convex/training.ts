import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTrainingModule } from "../src/lib/training/modules";
import { isGeneralStateComplete, isLntStateComplete } from "../src/lib/training/progress";
import { countsForLogistics } from "./lib/profileValidators";

type ProgressArgs = {
  moduleSlug: string;
  moduleVersion: string;
  state: string;
};

export function requireTrainingUser(userId: Id<"users"> | null): Id<"users"> {
  if (!userId) throw new Error("Unauthenticated: Sign in to access training");
  return userId;
}

function assertProgressArgs(args: ProgressArgs): void {
  if (!/^[a-z0-9-]{1,64}$/.test(args.moduleSlug)) throw new Error("Invalid module slug");
  if (!/^[a-zA-Z0-9.-]{1,32}$/.test(args.moduleVersion)) throw new Error("Invalid module version");
  if (args.state.length > 50_000) throw new Error("Training progress is too large");
  try {
    JSON.parse(args.state);
  } catch {
    throw new Error("Training progress must be valid JSON");
  }
}

function assertKnownProgressTarget(args: ProgressArgs): void {
  const trainingModule = getTrainingModule(args.moduleSlug);
  if (!trainingModule) throw new Error("Unknown training module");
  if (!trainingModule.completionPolicy.acceptedVersions.includes(args.moduleVersion)) {
    throw new Error("Unknown training module version");
  }
}

export async function requireActiveTrainingMember(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  const application = await ctx.db
    .query("applications")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!countsForLogistics(application)) {
    throw new Error("You need an active application to update training progress");
  }
  return application!;
}

export function assertCompletableProgress(args: ProgressArgs): void {
  assertProgressArgs(args);
  assertKnownProgressTarget(args);
  const trainingModule = getTrainingModule(args.moduleSlug)!;

  const state = JSON.parse(args.state);
  const complete = trainingModule.slug === "general"
    ? isGeneralStateComplete(state)
    : isLntStateComplete(state);
  if (!complete) {
    throw new Error("Training module is not complete");
  }
}

async function findProgress(ctx: Pick<MutationCtx, "db">, userId: Id<"users">, args: Pick<ProgressArgs, "moduleSlug" | "moduleVersion">) {
  return ctx.db
    .query("training_progress")
    .withIndex("by_user_module_version", (q) =>
      q.eq("userId", userId).eq("moduleSlug", args.moduleSlug).eq("moduleVersion", args.moduleVersion)
    )
    .first();
}

export async function saveProgressRecord(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  args: ProgressArgs,
  now = Date.now()
) {
  assertProgressArgs(args);
  assertKnownProgressTarget(args);
  const existing = await findProgress(ctx, userId, args);
  if (existing) {
    await ctx.db.patch(existing._id, { state: args.state, updatedAt: now });
    return { id: existing._id, completedAt: existing.completedAt };
  }
  const id = await ctx.db.insert("training_progress", {
    userId,
    moduleSlug: args.moduleSlug,
    moduleVersion: args.moduleVersion,
    state: args.state,
    startedAt: now,
    updatedAt: now,
  });
  return { id, completedAt: undefined };
}

export async function completeProgressRecord(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  args: ProgressArgs,
  now = Date.now()
) {
  assertProgressArgs(args);
  const existing = await findProgress(ctx, userId, args);
  if (existing?.completedAt) {
    return { id: existing._id, completedAt: existing.completedAt };
  }
  assertCompletableProgress(args);
  if (existing) {
    await ctx.db.patch(existing._id, {
      state: args.state,
      pledgedAt: now,
      completedAt: now,
      updatedAt: now,
    });
    return { id: existing._id, completedAt: now };
  }
  const id = await ctx.db.insert("training_progress", {
    userId,
    moduleSlug: args.moduleSlug,
    moduleVersion: args.moduleVersion,
    state: args.state,
    startedAt: now,
    updatedAt: now,
    pledgedAt: now,
    completedAt: now,
  });
  return { id, completedAt: now };
}

export const getMine = query({
  args: { moduleSlug: v.string(), moduleVersion: v.string() },
  handler: async (ctx, args) => {
    const userId = requireTrainingUser(await getAuthUserId(ctx));
    return ctx.db
      .query("training_progress")
      .withIndex("by_user_module_version", (q) =>
        q.eq("userId", userId).eq("moduleSlug", args.moduleSlug).eq("moduleVersion", args.moduleVersion)
      )
      .first();
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = requireTrainingUser(await getAuthUserId(ctx));
    const records = await ctx.db
      .query("training_progress")
      .withIndex("by_user_module_version", (q) => q.eq("userId", userId))
      .collect();
    return records.map(({ _id, moduleSlug, moduleVersion, state, startedAt, updatedAt, completedAt }) => ({
      _id,
      moduleSlug,
      moduleVersion,
      state,
      startedAt,
      updatedAt,
      completedAt,
    }));
  },
});

const progressArgs = {
  moduleSlug: v.string(),
  moduleVersion: v.string(),
  state: v.string(),
};

export const saveMine = mutation({
  args: progressArgs,
  handler: async (ctx, args) => {
    const userId = requireTrainingUser(await getAuthUserId(ctx));
    await requireActiveTrainingMember(ctx, userId);
    return saveProgressRecord(ctx, userId, args);
  },
});

export const completeMine = mutation({
  args: progressArgs,
  handler: async (ctx, args) => {
    const userId = requireTrainingUser(await getAuthUserId(ctx));
    await requireActiveTrainingMember(ctx, userId);
    return completeProgressRecord(ctx, userId, args);
  },
});
