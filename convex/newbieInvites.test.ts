import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";

const { getAuthUserId } = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId,
}));

import { listMine, submitInvite } from "./newbieInvites";

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
  });

  it("creates a newbie invite and allowlist entry for a confirmed sponsor", async () => {
    getAuthUserId.mockResolvedValue("user_1");

    const applicationId = "app_1" as Id<"applications">;
    const allowlistId = "allow_1" as Id<"email_allowlist">;
    const inviteId = "invite_1" as Id<"newbie_invites">;

    const insertSpy = vi
      .fn()
      .mockResolvedValueOnce(allowlistId)
      .mockResolvedValueOnce(inviteId)
      .mockResolvedValueOnce("event_1");

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
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }

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
      },
    };

    const handler = getHandler(submitInvite);
    const result = await handler(ctx, {
      newbieName: "Sam Patel",
      newbieEmail: "Sam@example.com",
      newbiePhone: "+15551231234",
      whyTheyBelong: "Great camp contributor.",
      preparednessAcknowledged: true,
    });

    expect(result).toEqual({
      inviteId,
      inviteEmail: "sam@example.com",
      sponsorName: "Alex Rivera",
    });

    expect(insertSpy).toHaveBeenNthCalledWith(
      1,
      "email_allowlist",
      expect.objectContaining({
        email: "sam@example.com",
        memberType: "newbie",
        source: "sponsor_invite",
        sponsorEmail: "sponsor@example.com",
        sponsorName: "Alex Rivera",
      })
    );

    expect(insertSpy).toHaveBeenNthCalledWith(
      2,
      "newbie_invites",
      expect.objectContaining({
        sponsorUserId: "user_1",
        sponsorApplicationId: applicationId,
        sponsorEmail: "sponsor@example.com",
        sponsorName: "Alex Rivera",
        newbieName: "Sam Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great camp contributor.",
        preparednessAcknowledged: true,
        allowlistEmailId: allowlistId,
      })
    );
  });

  it("rejects an invite when the newbie was already sponsored", async () => {
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
                first: vi.fn().mockResolvedValue({
                  _id: "invite_existing",
                  sponsorName: "Alex Rivera",
                  newbieEmail: "sam@example.com",
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
        newbieName: "Sam Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Already sponsored.",
        preparednessAcknowledged: true,
      })
    ).rejects.toThrow("Sam Patel has already been sponsored by Alex Rivera.");
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
        newbieName: "Sam Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Already sponsored.",
        preparednessAcknowledged: true,
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
        newbieName: "Sam Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great fit.",
        preparednessAcknowledged: true,
      })
    ).rejects.toThrow("Newbie invites are currently disabled.");
  });

  it("rejects an invite when the email is already on the allowlist", async () => {
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
                first: vi.fn().mockResolvedValue(null),
              }),
            };
          }
          if (table === "email_allowlist") {
            return {
              withIndex: () => ({
                first: vi.fn().mockResolvedValue({
                  _id: "allow_1",
                  email: "sam@example.com",
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
        newbieName: "Sam Patel",
        newbieEmail: "sam@example.com",
        newbiePhone: "+15551231234",
        whyTheyBelong: "Great fit.",
        preparednessAcknowledged: true,
      })
    ).rejects.toThrow("This person is already invited.");
  });
});

describe("newbieInvites.listMine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
                      createdAt: 1000,
                    },
                    {
                      _id: "invite_2",
                      sponsorUserId: "user_1",
                      newbieName: "Taylor Kim",
                      newbieEmail: "taylor@example.com",
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
