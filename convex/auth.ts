import { convexAuth } from "@convex-dev/auth/server";
import { Email } from "@convex-dev/auth/providers/Email";
import { Resend } from "resend";

/**
 * Dementha authentication configuration
 * Uses magic link via email for passwordless authentication
 */
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Email({
      id: "resend",
      apiKey: process.env.AUTH_RESEND_KEY,
      maxAge: 60 * 15, // 15 minutes
      // Magic link behavior - only the token/link is needed, no email re-verification
      authorize: undefined,
      async sendVerificationRequest({ identifier: email, url }) {
        const resendApiKey = process.env.AUTH_RESEND_KEY;
        
        if (!resendApiKey) {
          // In development without Resend, log the magic link
          console.log("======================================");
          console.log("MAGIC LINK (dev mode - click or copy this URL):");
          console.log(url);
          console.log("======================================");
          return;
        }

        const resend = new Resend(resendApiKey);
        const fromEmail = process.env.AUTH_EMAIL_FROM ?? "DeMentha via Resend <onboarding@resend.dev>";

        console.log("[Auth] Attempting to send magic link email", {
          to: email,
          from: fromEmail,
          apiKeyPrefix: resendApiKey.substring(0, 10) + "...",
        });

        try {
          const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: "Sign in to DeMentha",
            html: `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
                  <div style="text-align: center;">
                    <h1 style="color: #10b981; margin-bottom: 24px;">DeMentha Camp</h1>
                    <p style="color: #374151; font-size: 16px; margin-bottom: 32px;">
                      Click the button below to sign in to your account:
                    </p>
                    <a href="${url}" 
                       style="display: inline-block; background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Sign In to DeMentha
                    </a>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 32px;">
                      This link expires in 15 minutes.
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
                      If you didn't request this email, you can safely ignore it.
                    </p>
                  </div>
                </body>
              </html>
            `,
          });

          if (error) {
            console.error("[Auth] Resend API returned error:", {
              error,
              to: email,
              from: fromEmail,
            });
            throw new Error(`Failed to send verification email: ${error.message}`);
          }

          console.log("[Auth] Magic link email sent successfully", {
            emailId: data?.id,
            to: email,
          });
        } catch (err) {
          console.error("[Auth] Exception while sending email:", {
            error: err instanceof Error ? err.message : err,
            stack: err instanceof Error ? err.stack : undefined,
            to: email,
          });
          throw err;
        }
      },
    }),
  ],
});
