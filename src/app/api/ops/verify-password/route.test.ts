import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Helper to create mock NextRequest
function createMockRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest;
}

describe("POST /api/ops/verify-password", () => {
  const originalEnv = process.env;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  describe("successful verification", () => {
    it("should return valid: true when password matches", async () => {
      process.env.OPS_PWD = "secret123";

      const request = createMockRequest({ password: "secret123" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
    });

    it("should return valid: false when password does not match", async () => {
      process.env.OPS_PWD = "secret123";

      const request = createMockRequest({ password: "wrongpassword" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
    });

    it("should be case sensitive", async () => {
      process.env.OPS_PWD = "Secret123";

      const request = createMockRequest({ password: "secret123" });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(false);
    });
  });

  describe("missing password in request", () => {
    it("should return 400 when password is missing", async () => {
      process.env.OPS_PWD = "secret123";

      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
      expect(data.error).toBe("Password is required");
    });

    it("should return 400 when password is null", async () => {
      process.env.OPS_PWD = "secret123";

      const request = createMockRequest({ password: null });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
    });

    it("should return 400 when password is empty string", async () => {
      process.env.OPS_PWD = "secret123";

      const request = createMockRequest({ password: "" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.valid).toBe(false);
    });
  });

  describe("server configuration errors", () => {
    it("should return 500 when OPS_PWD is not set", async () => {
      delete process.env.OPS_PWD;

      const request = createMockRequest({ password: "anypassword" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.valid).toBe(false);
      expect(data.error).toBe("Server configuration error");
    });

    it("should log error when OPS_PWD is not set", async () => {
      delete process.env.OPS_PWD;

      const request = createMockRequest({ password: "anypassword" });
      await POST(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "OPS_PWD environment variable is not set"
      );
    });

    it("should return 500 when OPS_PWD is empty string", async () => {
      process.env.OPS_PWD = "";

      const request = createMockRequest({ password: "anypassword" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.valid).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should return 500 on JSON parse error", async () => {
      const request = {
        json: () => Promise.reject(new Error("Invalid JSON")),
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.valid).toBe(false);
      expect(data.error).toBe("Internal server error");
    });

    it("should log errors to console", async () => {
      const request = {
        json: () => Promise.reject(new Error("Parse error")),
      } as unknown as NextRequest;

      await POST(request);

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("security considerations", () => {
    it("should not expose the actual password in responses", async () => {
      process.env.OPS_PWD = "supersecret";

      const request = createMockRequest({ password: "wrongpassword" });
      const response = await POST(request);
      const data = await response.json();
      const responseText = JSON.stringify(data);

      expect(responseText).not.toContain("supersecret");
    });

    it("should handle special characters in password", async () => {
      process.env.OPS_PWD = "p@ss!w0rd#$%^&*()";

      const request = createMockRequest({ password: "p@ss!w0rd#$%^&*()" });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(true);
    });

    it("should handle unicode characters in password", async () => {
      process.env.OPS_PWD = "密码123🔐";

      const request = createMockRequest({ password: "密码123🔐" });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(true);
    });

    it("should handle very long passwords", async () => {
      const longPassword = "a".repeat(1000);
      process.env.OPS_PWD = longPassword;

      const request = createMockRequest({ password: longPassword });
      const response = await POST(request);
      const data = await response.json();

      expect(data.valid).toBe(true);
    });
  });
});
