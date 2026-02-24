import { afterEach, describe, expect, it, vi } from "vitest";
import { listForOps } from "./confirmedMembers";

function getQueryHandler(queryObject: unknown): Function {
  const maybeHandler = (queryObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler;
  }

  const maybeInternalHandler = (queryObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler;
  }

  throw new Error("Unable to locate Convex query handler");
}

describe("confirmedMembers.listForOps auth", () => {
  const originalOpsPwd = process.env.OPS_PWD;

  afterEach(() => {
    if (originalOpsPwd === undefined) {
      delete process.env.OPS_PWD;
    } else {
      process.env.OPS_PWD = originalOpsPwd;
    }
    vi.restoreAllMocks();
  });

  it("returns an empty list when opsPassword is missing", async () => {
    const handler = getQueryHandler(listForOps);
    const querySpy = vi.fn();
    const ctx = { db: { query: querySpy } };

    const result = await handler(ctx, {});

    expect(result).toEqual([]);
    expect(querySpy).not.toHaveBeenCalled();
  });

  it("throws when opsPassword is invalid", async () => {
    process.env.OPS_PWD = "correct-password";
    const handler = getQueryHandler(listForOps);
    const querySpy = vi.fn();
    const ctx = { db: { query: querySpy } };

    await expect(
      handler(ctx, { opsPassword: "wrong-password" })
    ).rejects.toThrow("Unauthorized: Invalid ops password");
    expect(querySpy).not.toHaveBeenCalled();
  });
});
