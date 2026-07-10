import { afterEach, describe, expect, it, vi } from "vitest";
import { getMine, listForOps, setCancelledForOps, upsertMine } from "./confirmedMembers";
import { Id } from "./_generated/dataModel";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("./opsSignupRows", () => ({
  upsertOpsSignupRow: vi.fn().mockResolvedValue({ operation: "updated", rowId: "row_1" }),
}));

vi.mock("./lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/auth")>();
  return { ...actual, getCurrentUserEmail: vi.fn().mockResolvedValue("opsadmin@example.com") };
});

import { upsertOpsSignupRow } from "./opsSignupRows";
import { getAuthUserId } from "@convex-dev/auth/server";

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

describe("confirmedMembers ops cancellation", () => {
  const originalOpsPwd = process.env.OPS_PWD;
  const OPS_PWD = "correct-password";

  afterEach(() => {
    if (originalOpsPwd === undefined) {
      delete process.env.OPS_PWD;
    } else {
      process.env.OPS_PWD = originalOpsPwd;
    }
    vi.restoreAllMocks();
  });

  it("marks an application as cancelled and refreshes its ops signup row", async () => {
    process.env.OPS_PWD = OPS_PWD;
    const handler = getQueryHandler(setCancelledForOps);
    const patch = vi.fn();
    const applicationId = "app_1" as Id<"applications">;
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: applicationId,
          status: "confirmed",
          updatedAt: 1000,
        }),
        patch,
      },
    };

    await handler(ctx, { opsPassword: OPS_PWD, applicationId, cancelled: true });

    expect(patch).toHaveBeenCalledWith(
      applicationId,
      expect.objectContaining({
        cancelled: true,
        updatedAt: expect.any(Number),
      })
    );
    expect(upsertOpsSignupRow).toHaveBeenCalledWith(ctx, applicationId);
  });

  it("can clear the cancelled flag", async () => {
    process.env.OPS_PWD = OPS_PWD;
    const handler = getQueryHandler(setCancelledForOps);
    const patch = vi.fn();
    const applicationId = "app_1" as Id<"applications">;
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: applicationId,
          status: "confirmed",
          cancelled: true,
          updatedAt: 2000,
        }),
        patch,
      },
    };

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId,
      cancelled: false,
    });

    expect(patch).toHaveBeenCalledWith(
      applicationId,
      expect.objectContaining({
        cancelled: false,
        updatedAt: expect.any(Number),
      })
    );
    expect(upsertOpsSignupRow).toHaveBeenCalledWith(ctx, applicationId);
  });
});

describe("confirmedMembers member-facing cancellation guards", () => {
  const USER_ID = "user_1" as Id<"users">;
  const APPLICATION_ID = "app_1" as Id<"applications">;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for a cancelled confirmed application", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getQueryHandler(getMine);
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: APPLICATION_ID,
                  userId: USER_ID,
                  status: "confirmed",
                  cancelled: true,
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
      },
    };

    const result = await handler(ctx, {});

    expect(result).toBeNull();
  });

  it("prevents cancelled confirmed members from updating details", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getQueryHandler(upsertMine);
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: APPLICATION_ID,
                  userId: USER_ID,
                  status: "confirmed",
                  cancelled: true,
                }),
              }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        patch: vi.fn(),
        insert: vi.fn(),
      },
    };

    await expect(
      handler(ctx, { hasBurningManTicket: true, hasVehiclePass: false })
    ).rejects.toThrow("Only confirmed members can update this information");
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});
