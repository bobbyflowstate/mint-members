import { mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireOpsPassword } from "./lib/auth";

const OPS_SIGNUP_ROW_SOURCE_VERSION = 1;

export interface UpsertOpsSignupRowResult {
  operation: "inserted" | "updated";
  rowId: Id<"ops_signup_rows">;
}

/**
 * Build or update a denormalized ops signup row from application + related
 * confirmed-member data.
 */
export async function upsertOpsSignupRow(
  ctx: MutationCtx,
  applicationId: Id<"applications">
): Promise<UpsertOpsSignupRowResult | null> {
  const application = await ctx.db.get(applicationId);
  if (!application) {
    return null;
  }

  const confirmedMember = await ctx.db
    .query("confirmed_members")
    .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
    .first();

  const existingRow = await ctx.db
    .query("ops_signup_rows")
    .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
    .first();

  const requests = confirmedMember?.requests ?? confirmedMember?.notes ?? "";
  const mergedRow = {
    applicationId: application._id,
    userId: application.userId,
    email: application.email,
    firstName: application.firstName,
    lastName: application.lastName,
    fullName: `${application.firstName} ${application.lastName}`.trim(),
    phone: application.phone,
    arrival: application.arrival,
    arrivalTime: application.arrivalTime,
    departure: application.departure,
    departureTime: application.departureTime,
    status: application.status,
    paymentAllowed: application.paymentAllowed,
    earlyDepartureRequested: application.earlyDepartureRequested,
    hasBurningManTicket: confirmedMember?.hasBurningManTicket ?? false,
    hasVehiclePass: confirmedMember?.hasVehiclePass ?? false,
    requests,
    applicationCreatedAt: application.createdAt,
    updatedAt: Date.now(),
    sourceVersion: OPS_SIGNUP_ROW_SOURCE_VERSION,
  };

  if (existingRow) {
    await ctx.db.patch(existingRow._id, mergedRow);
    return { operation: "updated", rowId: existingRow._id };
  }

  const rowId = await ctx.db.insert("ops_signup_rows", mergedRow);
  return { operation: "inserted", rowId };
}

/**
 * Backfill projection rows for all applications.
 */
export const backfillOpsSignupRows = mutation({
  args: {
    opsPassword: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireOpsPassword(args.opsPassword);

    const dryRun = args.dryRun ?? false;
    const applications = await ctx.db.query("applications").collect();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const application of applications) {
      if (dryRun) {
        const existingRow = await ctx.db
          .query("ops_signup_rows")
          .withIndex("by_applicationId", (q) => q.eq("applicationId", application._id))
          .first();
        if (existingRow) {
          updated += 1;
        } else {
          inserted += 1;
        }
        continue;
      }

      const result = await upsertOpsSignupRow(ctx, application._id);
      if (!result) {
        skipped += 1;
        continue;
      }
      if (result.operation === "inserted") {
        inserted += 1;
      } else {
        updated += 1;
      }
    }

    return {
      success: true,
      dryRun,
      scanned: applications.length,
      inserted,
      updated,
      skipped,
      sourceVersion: OPS_SIGNUP_ROW_SOURCE_VERSION,
    };
  },
});
