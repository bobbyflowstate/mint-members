import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Id } from "./_generated/dataModel";
import {
  add,
  claim,
  getMyPendingInvite,
  listUnclaimedForOps,
  setCancelledForOps,
  setFullPayment,
} from "./opsManualInvites";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("./opsSignupRows", () => ({
  upsertOpsSignupRow: vi.fn().mockResolvedValue({ operation: "inserted", rowId: "row_1" }),
}));

// Keep requireOpsPassword real (reads process.env.OPS_PWD), mock getCurrentUserEmail
vi.mock("./lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/auth")>();
  return { ...actual, getCurrentUserEmail: vi.fn().mockResolvedValue("opsadmin@example.com") };
});

import { getAuthUserId } from "@convex-dev/auth/server";
import { upsertOpsSignupRow } from "./opsSignupRows";

function getHandler(fn: unknown): Function {
  const h =
    (fn as { handler?: unknown }).handler ??
    (fn as { _handler?: unknown })._handler;
  if (typeof h !== "function") throw new Error("Handler not found");
  return h as Function;
}

const OPS_PWD = "test-password";

const BASE_INVITE = {
  _id: "invite_1" as Id<"ops_manual_invites">,
  email: "sam@example.com",
  firstName: "Sam",
  lastName: "Patel",
  phone: "+15551234567",
  memberType: "alumni" as const,
  arrival: "2026-08-29",
  arrivalTime: "11.01 am to 6.00 pm" as const,
  departure: "2026-09-06",
  departureTime: "11.01 am to 6.00 pm" as const,
  hasFullPayment: true,
  addedBy: "opsadmin@example.com",
  createdAt: 1000,
  updatedAt: 1000,
};

// Returns a db.query stub where each table key maps to its first() result (or collect() array).
function makeQuery(tableMap: Record<string, unknown>) {
  return vi.fn((table: string) => {
    const val = tableMap[table] ?? null;
    return {
      withIndex: (_name: string, _cb?: unknown) => ({
        first: vi.fn().mockResolvedValue(Array.isArray(val) ? val[0] ?? null : val),
        order: () => ({ collect: vi.fn().mockResolvedValue(Array.isArray(val) ? val : []) }),
      }),
      order: (_dir?: string) => ({
        collect: vi.fn().mockResolvedValue(Array.isArray(val) ? val : []),
      }),
    };
  });
}

// ─── add ───────────────────────────────────────────────────────────────────

describe("opsManualInvites.add", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  const validArgs = {
    opsPassword: OPS_PWD,
    email: "Sam@Example.com",
    firstName: "Sam",
    lastName: "Patel",
    phone: "+15551234567",
    memberType: "alumni" as const,
    arrival: "2026-08-29",
    arrivalTime: "11.01 am to 6.00 pm" as const,
    departure: "2026-09-06",
    departureTime: "11.01 am to 6.00 pm" as const,
    hasFullPayment: false,
  };

  it("throws when ops password is wrong", async () => {
    const handler = getHandler(add);
    const ctx = { db: { query: vi.fn(), insert: vi.fn() } };
    await expect(
      handler(ctx, { ...validArgs, opsPassword: "wrong" })
    ).rejects.toThrow("Unauthorized");
    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("creates invite and allowlist entry for a new email", async () => {
    const handler = getHandler(add);
    const insertSpy = vi.fn().mockResolvedValue("invite_new");
    const ctx = {
      db: {
        query: makeQuery({
          ops_manual_invites: null,
          applications: null,
          email_allowlist: null,
        }),
        insert: insertSpy,
      },
    };

    const result = await handler(ctx, validArgs);

    expect(result).toEqual({ inviteId: "invite_new" });
    // allowlist insert first, then invite insert
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(insertSpy).toHaveBeenNthCalledWith(
      1,
      "email_allowlist",
      expect.objectContaining({ email: "sam@example.com", source: "ops" })
    );
    expect(insertSpy).toHaveBeenNthCalledWith(
      2,
      "ops_manual_invites",
      expect.objectContaining({
        email: "sam@example.com",
        firstName: "Sam",
        memberType: "alumni",
        hasFullPayment: false,
      })
    );
  });

  it("normalizes email to lowercase", async () => {
    const handler = getHandler(add);
    const insertSpy = vi.fn().mockResolvedValue("invite_new");
    const ctx = {
      db: {
        query: makeQuery({
          ops_manual_invites: null,
          applications: null,
          email_allowlist: null,
        }),
        insert: insertSpy,
      },
    };

    await handler(ctx, { ...validArgs, email: "SAM@EXAMPLE.COM" });

    expect(insertSpy).toHaveBeenNthCalledWith(
      2,
      "ops_manual_invites",
      expect.objectContaining({ email: "sam@example.com" })
    );
  });

  it("skips allowlist insert if email already on allowlist", async () => {
    const handler = getHandler(add);
    const insertSpy = vi.fn().mockResolvedValue("invite_new");
    const ctx = {
      db: {
        query: makeQuery({
          ops_manual_invites: null,
          applications: null,
          email_allowlist: { _id: "existing_allowlist", email: "sam@example.com" },
        }),
        insert: insertSpy,
      },
    };

    await handler(ctx, validArgs);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith("ops_manual_invites", expect.anything());
  });

  it("throws if a manual invite already exists for this email", async () => {
    const handler = getHandler(add);
    const ctx = {
      db: {
        query: makeQuery({ ops_manual_invites: { _id: "existing_invite" } }),
        insert: vi.fn(),
      },
    };

    await expect(handler(ctx, validArgs)).rejects.toThrow(
      "A manual invite already exists for sam@example.com"
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("throws if the email already has an application", async () => {
    const handler = getHandler(add);
    const ctx = {
      db: {
        query: makeQuery({
          ops_manual_invites: null,
          applications: { _id: "existing_app" },
        }),
        insert: vi.fn(),
      },
    };

    await expect(handler(ctx, validArgs)).rejects.toThrow(
      "sam@example.com already has an application in the system"
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
  });
});

// ─── claim ─────────────────────────────────────────────────────────────────

describe("opsManualInvites.claim", () => {
  const USER_ID = "user_1" as Id<"users">;

  afterEach(() => {
    vi.clearAllMocks();
  });

  function makeClaimCtx({
    invite = BASE_INVITE as unknown,
    existingApp = null as unknown,
  } = {}) {
    const insertSpy = vi.fn().mockResolvedValue("new_id");
    const patchSpy = vi.fn();
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ email: "sam@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "ops_manual_invites") {
            return {
              withIndex: () => ({ first: vi.fn().mockResolvedValue(invite) }),
            };
          }
          if (table === "applications") {
            return {
              withIndex: () => ({ first: vi.fn().mockResolvedValue(existingApp) }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        }),
        insert: insertSpy,
        patch: patchSpy,
      },
    };
    return { ctx, insertSpy, patchSpy };
  }

  it("throws when not signed in", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const handler = getHandler(claim);
    const { ctx } = makeClaimCtx();

    await expect(handler(ctx, {})).rejects.toThrow("You must be signed in");
  });

  it("throws when no manual invite exists for the user's email", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(claim);
    const { ctx } = makeClaimCtx({ invite: null });

    await expect(handler(ctx, {})).rejects.toThrow("No manual invite found for your email");
  });

  it("throws when the invite has already been claimed", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(claim);
    const { ctx } = makeClaimCtx({ invite: { ...BASE_INVITE, claimedAt: 9999 } });

    await expect(handler(ctx, {})).rejects.toThrow("This invite has already been claimed");
  });

  it("throws when the invite has been cancelled", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(claim);
    const { ctx, insertSpy, patchSpy } = makeClaimCtx({
      invite: { ...BASE_INVITE, cancelled: true },
    });

    await expect(handler(ctx, {})).rejects.toThrow("This invite has been cancelled");
    expect(insertSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("throws when the user already has an application", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(claim);
    const { ctx } = makeClaimCtx({ existingApp: { _id: "existing_app" } });

    await expect(handler(ctx, {})).rejects.toThrow("You already have an application");
  });

  it("creates a confirmed application and confirmed_members row with hasFullPayment from invite", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(claim);
    const { ctx, insertSpy, patchSpy } = makeClaimCtx();

    const result = await handler(ctx, {});

    expect(result).toHaveProperty("applicationId");

    // Application inserted as confirmed
    expect(insertSpy).toHaveBeenCalledWith(
      "applications",
      expect.objectContaining({
        userId: USER_ID,
        email: "sam@example.com",
        status: "confirmed",
        firstName: BASE_INVITE.firstName,
        lastName: BASE_INVITE.lastName,
        memberType: BASE_INVITE.memberType,
      })
    );

    // confirmed_members row carries hasFullPayment from invite
    expect(insertSpy).toHaveBeenCalledWith(
      "confirmed_members",
      expect.objectContaining({
        userId: USER_ID,
        hasFullPayment: BASE_INVITE.hasFullPayment,
        hasBurningManTicket: false,
        hasVehiclePass: false,
      })
    );

    // Invite marked as claimed
    expect(patchSpy).toHaveBeenCalledWith(
      BASE_INVITE._id,
      expect.objectContaining({
        claimedByUserId: USER_ID,
        claimedAt: expect.any(Number),
      })
    );

    // Projection row upserted
    expect(upsertOpsSignupRow).toHaveBeenCalled();
  });

  it("preserves hasFullPayment: false from invite", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(claim);
    const { ctx, insertSpy } = makeClaimCtx({
      invite: { ...BASE_INVITE, hasFullPayment: false },
    });

    await handler(ctx, {});

    expect(insertSpy).toHaveBeenCalledWith(
      "confirmed_members",
      expect.objectContaining({ hasFullPayment: false })
    );
  });
});

// ─── setFullPayment ─────────────────────────────────────────────────────────

describe("opsManualInvites.setFullPayment", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  it("throws on wrong password", async () => {
    const handler = getHandler(setFullPayment);
    const patchSpy = vi.fn();
    await expect(
      handler({ db: { patch: patchSpy } }, {
        opsPassword: "wrong",
        inviteId: "invite_1" as Id<"ops_manual_invites">,
        hasFullPayment: true,
      })
    ).rejects.toThrow("Unauthorized");
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("patches hasFullPayment on the invite", async () => {
    const handler = getHandler(setFullPayment);
    const patchSpy = vi.fn();
    await handler({ db: { patch: patchSpy } }, {
      opsPassword: OPS_PWD,
      inviteId: "invite_1" as Id<"ops_manual_invites">,
      hasFullPayment: true,
    });
    expect(patchSpy).toHaveBeenCalledWith(
      "invite_1",
      expect.objectContaining({ hasFullPayment: true, updatedAt: expect.any(Number) })
    );
  });
});

// ─── setCancelledForOps ─────────────────────────────────────────────────────

describe("opsManualInvites ops cancellation", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  it("marks an unclaimed invite as cancelled", async () => {
    const handler = getHandler(setCancelledForOps);
    const patchSpy = vi.fn();
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue(BASE_INVITE),
        patch: patchSpy,
      },
    };

    await handler(ctx, {
      opsPassword: OPS_PWD,
      inviteId: "invite_1" as Id<"ops_manual_invites">,
      cancelled: true,
    });

    expect(patchSpy).toHaveBeenCalledWith(
      "invite_1",
      expect.objectContaining({
        cancelled: true,
        updatedAt: expect.any(Number),
      })
    );
  });

  it("refuses to cancel a claimed invite", async () => {
    const handler = getHandler(setCancelledForOps);
    const patchSpy = vi.fn();
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ ...BASE_INVITE, claimedAt: 9999 }),
        patch: patchSpy,
      },
    };

    await expect(
      handler(ctx, {
        opsPassword: OPS_PWD,
        inviteId: "invite_1" as Id<"ops_manual_invites">,
        cancelled: true,
      })
    ).rejects.toThrow("Claimed invites cannot be cancelled from this view");
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it("can clear the cancelled flag", async () => {
    const handler = getHandler(setCancelledForOps);
    const patchSpy = vi.fn();
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          ...BASE_INVITE,
          cancelled: true,
        }),
        patch: patchSpy,
      },
    };

    await handler(ctx, {
      opsPassword: OPS_PWD,
      inviteId: "invite_1" as Id<"ops_manual_invites">,
      cancelled: false,
    });

    expect(patchSpy).toHaveBeenCalledWith(
      "invite_1",
      expect.objectContaining({
        cancelled: false,
        updatedAt: expect.any(Number),
      })
    );
  });
});

// ─── listUnclaimedForOps ────────────────────────────────────────────────────

describe("opsManualInvites.listUnclaimedForOps", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  it("throws on wrong password", async () => {
    const handler = getHandler(listUnclaimedForOps);
    const ctx = { db: { query: vi.fn() } };
    await expect(handler(ctx, { opsPassword: "wrong" })).rejects.toThrow("Unauthorized");
  });

  it("returns unclaimed invites including cancelled invites", async () => {
    const handler = getHandler(listUnclaimedForOps);
    const invites = [
      { ...BASE_INVITE, _id: "invite_a" },
      { ...BASE_INVITE, _id: "invite_b", claimedAt: 9999 },
      { ...BASE_INVITE, _id: "invite_c" },
      { ...BASE_INVITE, _id: "invite_d", cancelled: true },
    ];
    const ctx = {
      db: {
        query: vi.fn(() => ({
          withIndex: () => ({
            order: () => ({ collect: vi.fn().mockResolvedValue(invites) }),
          }),
        })),
      },
    };

    const result = await handler(ctx, { opsPassword: OPS_PWD });

    expect(result).toHaveLength(3);
    expect(result.map((r: { _id: string }) => r._id)).toEqual(["invite_a", "invite_c", "invite_d"]);
  });
});

// ─── getMyPendingInvite ─────────────────────────────────────────────────────

describe("opsManualInvites.getMyPendingInvite", () => {
  const USER_ID = "user_1" as Id<"users">;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not signed in", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const handler = getHandler(getMyPendingInvite);
    const result = await handler({ db: { get: vi.fn() } }, {});
    expect(result).toBeNull();
  });

  it("returns null when user has no email", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(getMyPendingInvite);
    const ctx = { db: { get: vi.fn().mockResolvedValue({ email: null }) } };
    const result = await handler(ctx, {});
    expect(result).toBeNull();
  });

  it("returns null when the invite is already claimed", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(getMyPendingInvite);
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ email: "sam@example.com" }),
        query: vi.fn(() => ({
          withIndex: () => ({
            first: vi.fn().mockResolvedValue({ ...BASE_INVITE, claimedAt: 9999 }),
          }),
        })),
      },
    };

    const result = await handler(ctx, {});
    expect(result).toBeNull();
  });

  it("returns null when the invite has been cancelled", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(getMyPendingInvite);
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ email: "sam@example.com" }),
        query: vi.fn(() => ({
          withIndex: () => ({
            first: vi.fn().mockResolvedValue({ ...BASE_INVITE, cancelled: true }),
          }),
        })),
      },
    };

    const result = await handler(ctx, {});
    expect(result).toBeNull();
  });

  it("returns the invite when unclaimed", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(USER_ID);
    const handler = getHandler(getMyPendingInvite);
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ email: "sam@example.com" }),
        query: vi.fn(() => ({
          withIndex: () => ({ first: vi.fn().mockResolvedValue(BASE_INVITE) }),
        })),
      },
    };

    const result = await handler(ctx, {});
    expect(result).toEqual(BASE_INVITE);
  });
});
