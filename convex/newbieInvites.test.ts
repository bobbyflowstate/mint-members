import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";

const { getAuthUserId } = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId,
}));

import { listForOps, listMine, setInviteDecision, submitInvite } from "./newbieInvites";

type Handler = (ctx: unknown, args: unknown) => Promise<unknown>;

function getHandler(functionObject: unknown): Handler {
  const maybeHandler = (functionObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler as Handler;
  }

  const maybeInternalHandler = (functionObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler as Handler;
  }

  throw new Error("Unable to locate Convex handler");
}

describe("newbieInvites.submitInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPS_PWD = "secret";
  });

  it("creates a pending newbie invite for a confirmed sponsor without allowlisting them", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const applicationId = "app_1" as Id<"applications">;
    const inviteId = "invite_1" as Id<"newbie_invites">;
    const insertSpy = vi.fn().mockResolvedValueOnce(inviteId).mockResolvedValueOnce("event_1");

    const ctx = {
      db: {
        get: vi.fn().mockImplementation(async (id: string) => {
          if (id === "user_1") {
            return { _id: "user_1", email: "sponsor@example.com" };
          }
          return null;
        }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }

          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: applicationId,
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                }),
              }),
            };
          }

          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: insertSpy,
      },
    };

    const handler = getHandler(submitInvite);
    const result = await handler(ctx, {
      newbieFirstName: "Sam",
      newbieLastName: "Patel",
      newbieEmail: "Sam@example.com",
      newbiePhone: "+15551231234",
      whyTheyBelong: "Great camp contributor.",
      preparednessAcknowledged: true,
      estimatedArrival: "2026-08-24",
      estimatedDeparture: "2026-09-07",
    });

    expect(result).toEqual({
      inviteId,
      inviteEmail: "sam@example.com",
      sponsorName: "Alex Rivera",
    });

    expect(insertSpy).toHaveBeenNthCalledWith(
      1,
      "newbie_invites",
      expect.objectContaining({
        sponsorUserId: "user_1",
        sponsorApplicationId: applicationId,
        sponsorEmail: "sponsor@example.com",
        sponsorName: "Alex Rivera",
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieName: "Sam Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great camp contributor.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
        status: "pending",
        approvalEmailSentAt: undefined,
      })
    );
  });

  it("rejects an early estimated departure without a reason", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "sponsor@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: (_index: string, cb: (q: { eq: (field: string, value: string) => string }) => string) => {
                const key = cb({ eq: (_field, value) => value });
                return {
                  first: vi.fn().mockResolvedValue(
                    key === "departureCutoff"
                      ? { key: "departureCutoff", value: "2026-09-01" }
                      : null
                  ),
                };
              },
            };
          }

          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                }),
              }),
            };
          }

          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn(),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "Sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great camp contributor.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-08-31",
      })
    ).rejects.toThrow("Please explain why this newbie needs to leave before the standard departure date.");

    expect(ctx.db.insert).not.toHaveBeenCalled();
  });

  it("stores the reason for an early estimated departure", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const applicationId = "app_1" as Id<"applications">;
    const inviteId = "invite_1" as Id<"newbie_invites">;
    const insertSpy = vi.fn().mockResolvedValueOnce(inviteId).mockResolvedValueOnce("event_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "sponsor@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: (_index: string, cb: (q: { eq: (field: string, value: string) => string }) => string) => {
                const key = cb({ eq: (_field, value) => value });
                return {
                  first: vi.fn().mockResolvedValue(
                    key === "departureCutoff"
                      ? { key: "departureCutoff", value: "2026-09-01" }
                      : null
                  ),
                };
              },
            };
          }

          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: applicationId,
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                }),
              }),
            };
          }

          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: insertSpy,
      },
    };

    const handler = getHandler(submitInvite);
    await handler(ctx, {
      newbieFirstName: "Sam",
      newbieLastName: "Patel",
      newbieEmail: "Sam@example.com",
      newbiePhone: "+15551231234",
      whyTheyBelong: "Great camp contributor.",
      preparednessAcknowledged: true,
      estimatedArrival: "2026-08-24",
      estimatedDeparture: "2026-08-31",
      earlyDepartureReason: "They can only get time off through Sunday.",
    });

    expect(insertSpy).toHaveBeenNthCalledWith(
      1,
      "newbie_invites",
      expect.objectContaining({
        earlyDepartureReason: "They can only get time off through Sunday.",
      })
    );
  });

  it("rejects an invite when the newbie was already sponsored by a non-denied invite", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "second@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }

          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "Jordan",
                  lastName: "Lee",
                  email: "second@example.com",
                  status: "confirmed",
                }),
              }),
            };
          }

          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([
                  {
                    _id: "invite_existing",
                    sponsorName: "Alex Rivera",
                    newbieEmail: "sam@example.com",
                    status: "accepted",
                  },
                ]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn(),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Already sponsored.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
      })
    ).rejects.toThrow("sam@example.com has already been sponsored by Alex Rivera.");
  });

  it("allows re-sponsoring an email that was previously denied", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const inviteId = "invite_2" as Id<"newbie_invites">;

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "sponsor@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }
          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                  memberType: "alumni",
                }),
              }),
            };
          }
          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([
                  {
                    _id: "invite_old",
                    newbieEmail: "sam@example.com",
                    sponsorName: "Alex Rivera",
                    status: "denied",
                  },
                ]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn().mockResolvedValueOnce(inviteId).mockResolvedValueOnce("event_1"),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great fit.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
      })
    ).resolves.toEqual({
      inviteId,
      inviteEmail: "sam@example.com",
      sponsorName: "Alex Rivera",
    });
  });

  it("rejects a new invite when a newer pending invite exists after an older denial", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "sponsor@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }
          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                  memberType: "alumni",
                }),
              }),
            };
          }
          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([
                  {
                    _id: "invite_old",
                    newbieEmail: "sam@example.com",
                    sponsorName: "Old Sponsor",
                    status: "denied",
                  },
                  {
                    _id: "invite_new",
                    newbieEmail: "sam@example.com",
                    sponsorName: "Current Sponsor",
                    status: "pending",
                  },
                ]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn(),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great fit.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
      })
    ).rejects.toThrow("sam@example.com has already been sponsored by Current Sponsor.");
  });

  it("rejects a new invite when a newer accepted invite exists after an older denial", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "sponsor@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }
          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                  memberType: "alumni",
                }),
              }),
            };
          }
          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                collect: vi.fn().mockResolvedValue([
                  {
                    _id: "invite_old",
                    newbieEmail: "sam@example.com",
                    sponsorName: "Old Sponsor",
                    status: "denied",
                  },
                  {
                    _id: "invite_new",
                    newbieEmail: "sam@example.com",
                    sponsorName: "Current Sponsor",
                    status: "accepted",
                  },
                ]),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn(),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great fit.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
      })
    ).rejects.toThrow("sam@example.com has already been sponsored by Current Sponsor.");
  });

  it("rejects an invite from a confirmed newbie sponsor", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "newbie@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }

          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "New",
                  lastName: "Member",
                  email: "newbie@example.com",
                  status: "confirmed",
                  memberType: "newbie",
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn(),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Already sponsored.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
      })
    ).rejects.toThrow("Only confirmed alumni members can sponsor newbies");
  });

  it("rejects invites when newbie invites are disabled", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({ _id: "user_1", email: "sponsor@example.com" }),
        query: vi.fn((table: string) => {
          if (table === "config") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  key: "newbieInvitesEnabled",
                  value: "false",
                }),
              }),
            };
          }
          if (table === "applications") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "app_1",
                  userId: "user_1",
                  firstName: "Alex",
                  lastName: "Rivera",
                  email: "sponsor@example.com",
                  status: "confirmed",
                  memberType: "alumni",
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn(),
      },
    };

    const handler = getHandler(submitInvite);

    await expect(
      handler(ctx, {
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great fit.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-07",
      })
    ).rejects.toThrow("Newbie invites are currently disabled.");
  });
});

describe("newbieInvites.listMine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPS_PWD = "secret";
  });

  it("derives invite progress from the linked application", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const applicationId = "app_1" as Id<"applications">;

    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                order: () => ({
                  collect: vi.fn().mockResolvedValue([
                    {
                      _id: "invite_1",
                      sponsorUserId: "user_1",
                      newbieName: "Sam Patel",
                      newbieEmail: "sam@example.com",
                      applicationId,
                      status: "accepted",
                      createdAt: 1000,
                    },
                    {
                      _id: "invite_2",
                      sponsorUserId: "user_1",
                      newbieName: "Taylor Kim",
                      newbieEmail: "taylor@example.com",
                      status: "pending",
                      createdAt: 900,
                    },
                  ]),
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        get: vi.fn().mockImplementation(async (id: string) => {
          if (id === applicationId) {
            return {
              _id: applicationId,
              status: "confirmed",
            };
          }
          return null;
        }),
      },
    };

    const handler = getHandler(listMine);
    const result = await handler(ctx, {});

    expect(result).toEqual([
      expect.objectContaining({
        newbieEmail: "sam@example.com",
        derivedStatus: "confirmed",
      }),
      expect.objectContaining({
        newbieEmail: "taylor@example.com",
        derivedStatus: "invited",
      }),
    ]);
  });
});

describe("newbieInvites.listForOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPS_PWD = "secret";
  });

  it("includes pending invite review status for ops", async () => {
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          if (table === "newbie_invites") {
            return {
              withIndex: () => ({
                order: () => ({
                  collect: vi.fn().mockResolvedValue([
                    {
                      _id: "invite_1",
                      newbieEmail: "sam@example.com",
                      newbieName: "Sam Patel",
                      status: "pending",
                      createdAt: 1000,
                    },
                  ]),
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        }),
        get: vi.fn().mockResolvedValue(null),
      },
    };

    const handler = getHandler(listForOps);
    const result = await handler(ctx, { opsPassword: "secret" });

    expect(result).toEqual([
      expect.objectContaining({
        newbieEmail: "sam@example.com",
        status: "pending",
        derivedStatus: "invited",
      }),
    ]);
  });
});

describe("newbieInvites.setInviteDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPS_PWD = "secret";
  });

  it("accepts a pending invite, adds allowlist access, and marks approval email pending", async () => {
    const inviteId = "invite_1" as Id<"newbie_invites">;
    const allowlistId = "allow_1" as Id<"email_allowlist">;
    const patchSpy = vi.fn();
    const insertSpy = vi.fn().mockResolvedValueOnce(allowlistId).mockResolvedValueOnce("event_1");

    const ctx = {
      db: {
        get: vi.fn().mockImplementation(async (id: string) => {
          if (id === inviteId) {
            return {
              _id: inviteId,
              sponsorApplicationId: "app_1",
              sponsorEmail: "sponsor@example.com",
              sponsorName: "Alex Rivera",
              sponsorUserId: "user_1",
              newbieEmail: "sam@example.com",
              newbieName: "Sam Patel",
              status: "pending",
              createdAt: 100,
            };
          }
          return null;
        }),
        query: vi.fn((table: string) => {
          if (table === "email_allowlist") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        insert: insertSpy,
        patch: patchSpy,
      },
    };

    const handler = getHandler(setInviteDecision);
    const result = await handler(ctx, { inviteId, accepted: true, opsPassword: "secret" });

    expect(result).toEqual({ success: true, status: "accepted", shouldSendApprovalEmail: true });
    expect(insertSpy).toHaveBeenNthCalledWith(
      1,
      "email_allowlist",
      expect.objectContaining({
        email: "sam@example.com",
        memberType: "newbie",
        source: "sponsor_invite",
        sponsorEmail: "sponsor@example.com",
      })
    );
    expect(patchSpy).toHaveBeenCalledWith(
      inviteId,
      expect.objectContaining({
        status: "accepted",
        allowlistEmailId: allowlistId,
      })
    );
  });

  it("does not resend the approval email when re-accepting an invite", async () => {
    const inviteId = "invite_1" as Id<"newbie_invites">;

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: inviteId,
          sponsorApplicationId: "app_1",
          sponsorEmail: "sponsor@example.com",
          sponsorName: "Alex Rivera",
          sponsorUserId: "user_1",
          newbieEmail: "sam@example.com",
          newbieName: "Sam Patel",
          status: "denied",
          allowlistEmailId: "allow_1",
          approvalEmailSentAt: 123,
          createdAt: 100,
        }),
        query: vi.fn((table: string) => {
          if (table === "email_allowlist") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "allow_1",
                  email: "sam@example.com",
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn().mockResolvedValue("event_1"),
        patch: vi.fn(),
      },
    };

    const handler = getHandler(setInviteDecision);
    const result = await handler(ctx, { inviteId, accepted: true, opsPassword: "secret" });

    expect(result).toEqual({ success: true, status: "accepted", shouldSendApprovalEmail: false });
  });

  it("sends the approval email when only the legacy invite email was sent", async () => {
    const inviteId = "invite_1" as Id<"newbie_invites">;

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: inviteId,
          sponsorApplicationId: "app_1",
          sponsorEmail: "sponsor@example.com",
          sponsorName: "Alex Rivera",
          sponsorUserId: "user_1",
          newbieEmail: "sam@example.com",
          newbieName: "Sam Patel",
          status: "pending",
          allowlistEmailId: "allow_1",
          inviteEmailSentAt: 123,
          createdAt: 100,
        }),
        query: vi.fn((table: string) => {
          if (table === "email_allowlist") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "allow_1",
                  email: "sam@example.com",
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn().mockResolvedValue("event_1"),
        patch: vi.fn(),
      },
    };

    const handler = getHandler(setInviteDecision);
    const result = await handler(ctx, { inviteId, accepted: true, opsPassword: "secret" });

    expect(result).toEqual({ success: true, status: "accepted", shouldSendApprovalEmail: true });
  });

  it("does not delete a preexisting allowlist row when denying an accepted invite", async () => {
    const inviteId = "invite_1" as Id<"newbie_invites">;
    const deleteSpy = vi.fn();
    const patchSpy = vi.fn();
    const opsAllowlistEntry = {
      _id: "allow_ops",
      email: "sam@example.com",
      source: "ops",
      memberType: "alumni",
    };

    const ctx = {
      db: {
        get: vi.fn().mockImplementation(async (id: string) => {
          if (id === inviteId) {
            return {
              _id: inviteId,
              sponsorApplicationId: "app_1",
              sponsorEmail: "sponsor@example.com",
              sponsorName: "Alex Rivera",
              sponsorUserId: "user_1",
              newbieEmail: "sam@example.com",
              newbieName: "Sam Patel",
              status: "accepted",
              createdAt: 100,
            };
          }

          if (id === "allow_ops") {
            return {
              _id: "allow_ops",
              email: "sam@example.com",
              source: "ops",
              memberType: "alumni",
            };
          }

          return null;
        }),
        query: vi.fn((table: string) => {
          if (table === "email_allowlist") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue(opsAllowlistEntry),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        }),
        insert: vi.fn().mockResolvedValue("event_1"),
        patch: patchSpy,
        delete: deleteSpy,
      },
    };

    const handler = getHandler(setInviteDecision);

    const acceptResult = await handler(ctx, { inviteId, accepted: true, opsPassword: "secret" });
    expect(acceptResult).toEqual({
      success: true,
      status: "accepted",
      shouldSendApprovalEmail: true,
    });
    expect(patchSpy).toHaveBeenCalledWith(
      inviteId,
      expect.objectContaining({
        status: "accepted",
        allowlistEmailId: undefined,
      })
    );

    const denyResult = await handler(
      {
        db: {
          ...ctx.db,
          get: vi.fn().mockImplementation(async (id: string) => {
            if (id === inviteId) {
              return {
                _id: inviteId,
                sponsorApplicationId: "app_1",
                sponsorEmail: "sponsor@example.com",
                sponsorName: "Alex Rivera",
                sponsorUserId: "user_1",
                newbieEmail: "sam@example.com",
                newbieName: "Sam Patel",
                status: "accepted",
                allowlistEmailId: undefined,
                createdAt: 100,
              };
            }
            if (id === "allow_ops") {
              return opsAllowlistEntry;
            }
            return null;
          }),
          patch: patchSpy,
          delete: deleteSpy,
        },
      },
      { inviteId, accepted: false, opsPassword: "secret" }
    );

    expect(denyResult).toEqual({
      success: true,
      status: "denied",
      shouldSendApprovalEmail: false,
    });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("blocks denying an invite after the newbie has applied", async () => {
    const inviteId = "invite_1" as Id<"newbie_invites">;

    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          _id: inviteId,
          sponsorApplicationId: "app_1",
          sponsorEmail: "sponsor@example.com",
          sponsorName: "Alex Rivera",
          sponsorUserId: "user_1",
          newbieEmail: "sam@example.com",
          newbieName: "Sam Patel",
          status: "accepted",
          applicationId: "app_newbie",
          createdAt: 100,
        }),
      },
    };

    const handler = getHandler(setInviteDecision);

    await expect(handler(ctx, { inviteId, accepted: false, opsPassword: "secret" })).rejects.toThrow(
      "Cannot deny an invite after the newbie has applied."
    );
  });
});
