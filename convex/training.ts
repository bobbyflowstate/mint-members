import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTrainingModule } from "../src/lib/training/modules";
import { isGeneralStateComplete, isLntStateComplete } from "../src/lib/training/progress";
import { summarizeOpsTraining } from "../src/lib/training/opsStatus";
import { getCurrentUserEmail, requireOpsPassword } from "./lib/auth";
import { logEvent } from "./lib/events";
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

/**
 * One row per active member with their status on each required training
 * module — what /ops/training lists and exports.
 *
 * Reads every progress record rather than only completions so ops can tell
 * "started and stalled" from "never opened it", and so a completion under a
 * retired module version still shows as a retake.
 */
export const listForOps = query({
  args: { opsPassword: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.opsPassword) {
      return [];
    }
    requireOpsPassword(args.opsPassword);

    const applications = (await ctx.db.query("applications").collect()).filter(
      countsForLogistics
    );
    const records = await ctx.db.query("training_progress").collect();

    const byUserId = new Map<string, typeof records>();
    for (const record of records) {
      const existing = byUserId.get(record.userId);
      if (existing) {
        existing.push(record);
      } else {
        byUserId.set(record.userId, [record]);
      }
    }

    return applications
      .map((application) => {
        const summary = summarizeOpsTraining(byUserId.get(application.userId) ?? []);
        return {
          applicationId: application._id,
          fullName: `${application.firstName} ${application.lastName}`.trim(),
          email: application.email,
          memberType: application.memberType ?? "alumni",
          status: application.status,
          ...summary,
        };
      })
      .sort((a, b) => {
        // Least-trained first so ops sees who to chase.
        if (a.completeCount !== b.completeCount) {
          return a.completeCount - b.completeCount;
        }
        return a.fullName.localeCompare(b.fullName);
      });
  },
});

/** A progress record ops created by hand carries no member work. */
const EMPTY_STATE = "{}";

/**
 * Mark a module complete on a member's behalf, against the module's current
 * version. Deliberately skips the completion checks `completeProgressRecord`
 * runs — that is the whole point of an override — and stamps who did it so a
 * marked completion is never mistaken for an earned one.
 */
export async function markCompleteRecord(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  args: { moduleSlug: string; note?: string },
  actor: string,
  now = Date.now()
) {
  const trainingModule = getTrainingModule(args.moduleSlug);
  if (!trainingModule) throw new Error("Unknown training module");
  if (args.note && args.note.length > 500) throw new Error("Note is too long");

  const moduleVersion = trainingModule.version;
  const existing = await findProgress(ctx, userId, { moduleSlug: args.moduleSlug, moduleVersion });

  if (existing?.completedAt && !existing.overriddenBy) {
    // Already earned it the honest way — leave the record alone.
    return { id: existing._id, moduleVersion, alreadyComplete: true };
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      completedAt: existing.completedAt ?? now,
      overriddenBy: actor,
      overrideNote: args.note,
      updatedAt: now,
    });
    return { id: existing._id, moduleVersion, alreadyComplete: false };
  }

  const id = await ctx.db.insert("training_progress", {
    userId,
    moduleSlug: args.moduleSlug,
    moduleVersion,
    state: EMPTY_STATE,
    startedAt: now,
    updatedAt: now,
    completedAt: now,
    overriddenBy: actor,
    overrideNote: args.note,
  });
  return { id, moduleVersion, alreadyComplete: false };
}

/**
 * Undo an ops override. Refuses to touch a completion the member earned —
 * clearing one of those would delete real work, and ops asking for it means
 * they picked the wrong row.
 */
export async function clearOverrideRecord(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  moduleSlug: string,
  now = Date.now()
) {
  const trainingModule = getTrainingModule(moduleSlug);
  if (!trainingModule) throw new Error("Unknown training module");

  const moduleVersion = trainingModule.version;
  const existing = await findProgress(ctx, userId, { moduleSlug, moduleVersion });
  if (!existing?.overriddenBy) {
    throw new Error("That completion was earned by the member, not marked by ops");
  }

  if (existing.state === EMPTY_STATE) {
    // Nothing of the member's under it — take the row out entirely so they
    // read as "not started" rather than half-way through.
    await ctx.db.delete(existing._id);
    return { id: existing._id, moduleVersion, deleted: true };
  }

  await ctx.db.patch(existing._id, {
    completedAt: undefined,
    pledgedAt: undefined,
    overriddenBy: undefined,
    overrideNote: undefined,
    updatedAt: now,
  });
  return { id: existing._id, moduleVersion, deleted: false };
}

async function requireActiveApplication(ctx: MutationCtx, applicationId: Id<"applications">) {
  const application = await ctx.db.get(applicationId);
  if (!countsForLogistics(application)) {
    throw new Error("No active application for that member");
  }
  return application!;
}

export const opsMarkComplete = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    moduleSlug: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplication(ctx, args.applicationId);
    const actor = await getCurrentUserEmail(ctx);

    const result = await markCompleteRecord(
      ctx,
      application.userId,
      { moduleSlug: args.moduleSlug, note: args.note },
      actor
    );

    if (!result.alreadyComplete) {
      await logEvent(ctx, {
        applicationId: application._id,
        eventType: "training_marked_complete",
        payload: {
          memberEmail: application.email,
          moduleSlug: args.moduleSlug,
          moduleVersion: result.moduleVersion,
          note: args.note ?? "",
        },
        actor,
      });
    }

    return result;
  },
});

export const opsClearOverride = mutation({
  args: {
    opsPassword: v.string(),
    applicationId: v.id("applications"),
    moduleSlug: v.string(),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);
    const application = await requireActiveApplication(ctx, args.applicationId);
    const actor = await getCurrentUserEmail(ctx);

    const result = await clearOverrideRecord(ctx, application.userId, args.moduleSlug);

    await logEvent(ctx, {
      applicationId: application._id,
      eventType: "training_override_cleared",
      payload: {
        memberEmail: application.email,
        moduleSlug: args.moduleSlug,
        moduleVersion: result.moduleVersion,
      },
      actor,
    });

    return result;
  },
});
