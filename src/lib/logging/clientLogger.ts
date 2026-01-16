/**
 * Client-side logging utilities
 * Logs events to console and can be extended to send to Convex
 */

export type ClientEventType =
  | "page_view"
  | "form_start"
  | "form_submit"
  | "form_error"
  | "payment_start"
  | "payment_cancel"
  | "ui_error";

export interface ClientEvent {
  type: ClientEventType;
  page: string;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Log a client event to console
 * In production, this could also send to an analytics service
 */
export function logClientEvent(
  type: ClientEventType,
  data?: Record<string, unknown>
): void {
  const event: ClientEvent = {
    type,
    page: typeof window !== "undefined" ? window.location.pathname : "unknown",
    timestamp: new Date().toISOString(),
    data,
  };

  // Always log to console in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Client Event]", event);
  }

  // In production, you might want to:
  // 1. Send to an analytics service
  // 2. Call a Convex action to log to event_logs
  // 3. Use a service like Sentry or LogRocket
}

/**
 * Log a client error
 */
export function logClientError(
  error: Error | string,
  context?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  const event: ClientEvent = {
    type: "ui_error",
    page: typeof window !== "undefined" ? window.location.pathname : "unknown",
    timestamp: new Date().toISOString(),
    error: errorMessage,
    data: {
      ...context,
      stack: errorStack,
    },
  };

  // Always log errors to console
  console.error("[Client Error]", event);

  // In production, send to error tracking service
}

/**
 * Track page views
 */
export function trackPageView(page?: string): void {
  logClientEvent("page_view", {
    page: page || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
    referrer: typeof document !== "undefined" ? document.referrer : undefined,
  });
}
