import { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Verify ops password
 * Throws an error if password is invalid
 */
export function requireOpsPassword(password: string): void {
  const opsPassword = process.env.OPS_PWD;

  if (!opsPassword) {
    throw new Error("Server configuration error: OPS_PWD not set");
  }

  if (password !== opsPassword) {
    throw new Error("Unauthorized: Invalid ops password");
  }
}

/**
 * Get current authenticated user's email
 * Returns "ops" if not authenticated
 */
export async function getCurrentUserEmail(ctx: QueryCtx | MutationCtx): Promise<string> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return "ops";
  }

  const user = await ctx.db.get(userId);
  if (!user || !user.email) {
    return "ops";
  }

  return user.email.toLowerCase();
}
