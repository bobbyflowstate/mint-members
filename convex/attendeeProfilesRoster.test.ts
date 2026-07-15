import { afterEach, describe, expect, it, vi } from "vitest";
import { listRoster } from "./attendeeProfiles";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("./opsSignupRows", () => ({
  upsertOpsSignupRow: vi.fn().mockResolvedValue({ operation: "updated", rowId: "row_1" }),
}));

import { getAuthUserId } from "@convex-dev/auth/server";

type RosterResult = {
  members: Array<Record<string, unknown> & { fullName: string; isViewer: boolean }>;
  stats: Record<string, unknown>;
} | null;

type RosterHandler = (ctx: unknown, args: Record<string, never>) => Promise<RosterResult>;

function getQueryHandler(queryObject: unknown): RosterHandler {
  const maybeHandler = (queryObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler as RosterHandler;
  }

  const maybeInternalHandler = (queryObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler as RosterHandler;
  }

  throw new Error("Unable to locate Convex query handler");
}

type Tables = {
  applications: Record<string, unknown>[];
  attendee_profiles: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
  sleeping_groups: Record<string, unknown>[];
};

/**
 * Minimal ctx.db supporting the two access patterns listRoster uses:
 * query(table).collect() and query("applications").withIndex("by_userId").first().
 */
function makeCtx(tables: Tables, viewerUserId: string) {
  return {
    db: {
      query: (table: keyof Tables) => ({
        collect: async () => tables[table] ?? [],
        withIndex: () => ({
          first: async () =>
            (tables[table] ?? []).find((row) => row.userId === viewerUserId) ?? null,
        }),
      }),
    },
  };
}

function application(overrides: Record<string, unknown>) {
  return {
    _id: `app_${overrides.userId}`,
    firstName: "First",
    lastName: "Last",
    email: "member@example.com",
    phone: "+15551234567",
    arrival: "2026-08-25",
    arrivalTime: "11.01 am to 6.00 pm",
    departure: "2026-09-01",
    departureTime: "11.01 am to 6.00 pm",
    status: "confirmed",
    dietaryPreference: "omnivore",
    allergyFlag: false,
    earlyDepartureRequested: false,
    paymentAllowed: true,
    ...overrides,
  };
}

describe("attendeeProfiles.listRoster", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const handler = getQueryHandler(listRoster);

  it("returns null when not signed in", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue(null);
    const ctx = makeCtx(
      { applications: [], attendee_profiles: [], vehicles: [], sleeping_groups: [] },
      "user_none"
    );

    expect(await handler(ctx, {})).toBeNull();
  });

  it("returns null when the viewer's application is cancelled", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user_viewer" as never);
    const ctx = makeCtx(
      {
        applications: [application({ userId: "user_viewer", cancelled: true })],
        attendee_profiles: [],
        vehicles: [],
        sleeping_groups: [],
      },
      "user_viewer"
    );

    expect(await handler(ctx, {})).toBeNull();
  });

  it("lists confirmed members only, with member-safe fields", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user_viewer" as never);
    const tables: Tables = {
      applications: [
        // Viewer: active but not confirmed — can view, must not appear.
        application({
          userId: "user_viewer",
          firstName: "Vera",
          lastName: "Viewer",
          status: "pending_payment",
        }),
        application({
          userId: "user_zed",
          firstName: "Zed",
          lastName: "Zulu",
          arrival: "2026-08-24",
          dietaryPreference: "vegan",
          allergyFlag: true,
          memberType: "newbie",
        }),
        application({
          userId: "user_amy",
          firstName: "Amy",
          lastName: "Alpha",
          arrival: "2026-08-24",
        }),
        application({ userId: "user_gone", cancelled: true }),
        application({ userId: "user_rejected", status: "rejected" }),
      ],
      attendee_profiles: [
        {
          userId: "user_zed",
          applicationId: "app_user_zed",
          playaName: "Sparkle",
          arrivalMode: "driving_own_vehicle",
          vehicleId: "veh_1",
          sleepingType: "own_shiftpod_or_tent",
          sleepingGroupId: "grp_1",
          numBurnsAttended: 0,
          emergencyContactName: "Should Not Leak",
          emergencyContactPhone: "+15550000000",
        },
      ],
      vehicles: [{ _id: "veh_1", name: "Big Blue RV" }],
      sleeping_groups: [{ _id: "grp_1", name: "Pod Row A" }],
    };
    const ctx = makeCtx(tables, "user_viewer");

    const result = await handler(ctx, {});
    if (!result) {
      throw new Error("Expected a roster for an active member");
    }

    expect(result.members.map((m) => m.fullName)).toEqual([
      "Amy Alpha",
      "Zed Zulu",
    ]);

    const zed = result.members[1];
    expect(zed).toMatchObject({
      playaName: "Sparkle",
      memberType: "newbie",
      isViewer: false,
      arrival: "2026-08-24",
      arrivalMode: "driving_own_vehicle",
      vehicleName: "Big Blue RV",
      sleepingType: "own_shiftpod_or_tent",
      sleepingPlace: "Pod Row A",
      numBurnsAttended: 0,
    });

    // Ops-only fields must never reach the member roster.
    for (const member of result.members) {
      expect(member).not.toHaveProperty("email");
      expect(member).not.toHaveProperty("phone");
      expect(member).not.toHaveProperty("emergencyContactName");
      expect(member).not.toHaveProperty("emergencyContactPhone");
      expect(member).not.toHaveProperty("dietaryPreference");
      expect(member).not.toHaveProperty("allergyNotes");
      expect(member).not.toHaveProperty("requests");
      expect(member).not.toHaveProperty("earlyDepartureReason");
    }

    expect(result.stats).toEqual({
      confirmedCount: 2,
      alumniCount: 1,
      newbieCount: 1,
      dietaryCounts: { omnivore: 1, vegan: 1 },
      allergyCount: 1,
    });
  });

  it("marks the viewer's own confirmed row", async () => {
    vi.mocked(getAuthUserId).mockResolvedValue("user_viewer" as never);
    const ctx = makeCtx(
      {
        applications: [application({ userId: "user_viewer" })],
        attendee_profiles: [],
        vehicles: [],
        sleeping_groups: [],
      },
      "user_viewer"
    );

    const result = await handler(ctx, {});
    if (!result) {
      throw new Error("Expected a roster for an active member");
    }
    expect(result.members).toHaveLength(1);
    expect(result.members[0].isViewer).toBe(true);
  });
});
