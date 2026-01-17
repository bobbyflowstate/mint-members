import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logClientEvent,
  logClientError,
  trackPageView,
  type ClientEventType,
  type ClientEvent,
} from "./clientLogger";

describe("Client Logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-08-15T12:00:00.000Z"));

    // Mock window and document for browser environment
    global.window = {
      location: {
        pathname: "/apply",
      },
    } as unknown as Window & typeof globalThis;

    global.document = {
      referrer: "https://google.com",
    } as unknown as Document;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
    global.window = originalWindow;
    global.document = originalDocument;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("logClientEvent", () => {
    it("should log event with correct structure in development", () => {
      process.env.NODE_ENV = "development";

      logClientEvent("page_view");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          type: "page_view",
          page: "/apply",
          timestamp: "2025-08-15T12:00:00.000Z",
        })
      );
    });

    it("should include optional data in event", () => {
      process.env.NODE_ENV = "development";

      logClientEvent("form_submit", { email: "test@example.com", step: 1 });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          type: "form_submit",
          data: { email: "test@example.com", step: 1 },
        })
      );
    });

    it("should not log to console in production", () => {
      process.env.NODE_ENV = "production";

      logClientEvent("form_start");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle all event types", () => {
      process.env.NODE_ENV = "development";
      const eventTypes: ClientEventType[] = [
        "page_view",
        "form_start",
        "form_submit",
        "form_error",
        "payment_start",
        "payment_cancel",
        "ui_error",
      ];

      for (const eventType of eventTypes) {
        logClientEvent(eventType);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          "[Client Event]",
          expect.objectContaining({ type: eventType })
        );
      }
    });

    it("should use 'unknown' when window is not available", () => {
      process.env.NODE_ENV = "development";
      // @ts-expect-error - testing undefined window
      global.window = undefined;

      logClientEvent("page_view");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          page: "unknown",
        })
      );
    });
  });

  describe("logClientError", () => {
    it("should log Error objects correctly", () => {
      const error = new Error("Test error message");

      logClientError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error]",
        expect.objectContaining({
          type: "ui_error",
          page: "/apply",
          error: "Test error message",
          data: expect.objectContaining({
            stack: expect.stringContaining("Error: Test error message"),
          }),
        })
      );
    });

    it("should log string errors correctly", () => {
      logClientError("Something went wrong");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error]",
        expect.objectContaining({
          type: "ui_error",
          error: "Something went wrong",
          data: expect.objectContaining({
            stack: undefined,
          }),
        })
      );
    });

    it("should include additional context in data", () => {
      const error = new Error("API failed");
      const context = { endpoint: "/api/test", statusCode: 500 };

      logClientError(error, context);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error]",
        expect.objectContaining({
          data: expect.objectContaining({
            endpoint: "/api/test",
            statusCode: 500,
          }),
        })
      );
    });

    it("should always log errors regardless of NODE_ENV", () => {
      process.env.NODE_ENV = "production";

      logClientError("Production error");

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should handle undefined window", () => {
      // @ts-expect-error - testing undefined window
      global.window = undefined;

      logClientError("Error without window");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[Client Error]",
        expect.objectContaining({
          page: "unknown",
        })
      );
    });
  });

  describe("trackPageView", () => {
    it("should track page view with current path", () => {
      process.env.NODE_ENV = "development";

      trackPageView();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          type: "page_view",
          data: expect.objectContaining({
            page: "/apply",
            referrer: "https://google.com",
          }),
        })
      );
    });

    it("should track page view with custom page", () => {
      process.env.NODE_ENV = "development";

      trackPageView("/custom-page");

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          type: "page_view",
          data: expect.objectContaining({
            page: "/custom-page",
          }),
        })
      );
    });

    it("should handle undefined document", () => {
      process.env.NODE_ENV = "development";
      // @ts-expect-error - testing undefined document
      global.document = undefined;

      trackPageView();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          data: expect.objectContaining({
            referrer: undefined,
          }),
        })
      );
    });

    it("should use window.location.pathname when no custom page provided", () => {
      process.env.NODE_ENV = "development";
      global.window = {
        location: { pathname: "/ops/review" },
      } as unknown as Window & typeof globalThis;

      trackPageView();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "[Client Event]",
        expect.objectContaining({
          data: expect.objectContaining({
            page: "/ops/review",
          }),
        })
      );
    });
  });

  describe("ClientEvent type", () => {
    it("should produce valid event structure", () => {
      process.env.NODE_ENV = "development";

      logClientEvent("form_submit", { formName: "application" });

      const loggedEvent = consoleLogSpy.mock.calls[0][1] as ClientEvent;

      expect(loggedEvent.type).toBe("form_submit");
      expect(loggedEvent.page).toBeDefined();
      expect(loggedEvent.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
      );
      expect(loggedEvent.data).toEqual({ formName: "application" });
    });
  });
});
