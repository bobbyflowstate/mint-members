import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

/**
 * Dementha authentication configuration
 * Uses password-based authentication for member signups
 */
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
