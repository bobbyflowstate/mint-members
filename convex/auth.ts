import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";

/**
 * Dementha authentication configuration
 * Uses magic link via email (OTP) for passwordless authentication
 */
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Email({
      // Magic link behavior - only token needed, no email re-verification
      authorize: undefined,
      
      // Send verification email via Resend
      sendVerificationRequest: async ({ identifier: email, token, expires }) => {
        const resendApiKey = process.env.AUTH_RESEND_KEY;
        
        if (!resendApiKey) {
          // In development without Resend, log the token
          console.log("======================================");
          console.log("MAGIC LINK TOKEN (dev mode)");
          console.log(`Email: ${email}`);
          console.log(`Token: ${token}`);
          console.log(`Expires: ${expires}`);
          console.log("======================================");
          return;
        }

        const resend = new Resend(resendApiKey);
        const fromEmail = process.env.AUTH_EMAIL_FROM ?? "DeMentha <noreply@dementha.com>";

        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: "Sign in to DeMentha",
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
              <h1 style="color: #10b981;">DeMentha Camp</h1>
              <p>Click the link below to sign in to your account:</p>
              <p style="margin: 24px 0;">
                <a href="${process.env.CONVEX_SITE_URL}/auth/verify?token=${token}" 
                   style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                  Sign In to DeMentha
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">
                Or copy this code: <strong>${token}</strong>
              </p>
              <p style="color: #999; font-size: 12px;">
                This link expires at ${expires.toLocaleString()}.
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          `,
        });
      },
    }),
  ],
});
