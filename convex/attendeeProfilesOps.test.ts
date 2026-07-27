import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Id } from "./_generated/dataModel";
import {
  listEditOptionsForOps,
  listForOps,
  opsSaveBurnsEmergency,
  opsSaveCamp,
  opsSaveMeals,
  opsSaveSleeping,
  opsSaveStatus,
  opsSaveTransport,
} from "./attendeeProfiles";
import { upsertOpsSignupRow } from "./opsSignupRows";
import { logEvent } from "./lib/events";

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: vi.fn(),
}));

vi.mock("./opsSignupRows", () => ({
  upsertOpsSignupRow: vi.fn().mockResolvedValue({ operation: "updated", rowId: "row_1" }),
}));

vi.mock("./lib/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/events")>();
  return {
    ...actual,
    logEvent: vi.fn().mockResolvedValue(undefined),
  };
});

type TableName =
  | "applications"
  | "attendee_profiles"
  | "confirmed_members"
  | "config"
  | "vehicles"
  | "sleeping_groups";

type Row = Record<string, unknown> & { _id: string };
type Tables = Record<TableName, Row[]>;
type Handler = (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;

function getHandler(fn: unknown): Handler {
  const h =
    (fn as { handler?: unknown }).handler ??
    (fn as { _handler?: unknown })._handler;
  if (typeof h !== "function") throw new Error("Handler not found");
  return h as Handler;
}

const OPS_PWD = "test-password";
const USER_ID = "user_1" as Id<"users">;
const APPLICATION_ID = "app_1" as Id<"applications">;
const PROFILE_ID = "profile_1" as Id<"attendee_profiles">;

function application(overrides: Record<string, unknown> = {}): Row {
  return {
    _id: APPLICATION_ID,
    userId: USER_ID,
    firstName: "Mina",
    lastName: "Member",
    email: "mina@example.com",
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
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function profile(overrides: Record<string, unknown> = {}): Row {
  return {
    _id: PROFILE_ID,
    userId: USER_ID,
    applicationId: APPLICATION_ID,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeCtx(initialTables: Partial<Tables>) {
  const tables: Tables = {
    applications: [],
    attendee_profiles: [],
    confirmed_members: [],
    config: [],
    vehicles: [],
    sleeping_groups: [],
    ...initialTables,
  };

  const patch = vi.fn(async (id: string, values: Record<string, unknown>) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, values);
        return;
      }
    }
    throw new Error(`No row for id ${id}`);
  });

  const insert = vi.fn(async (table: TableName, values: Record<string, unknown>) => {
    const id = `${table}_${tables[table].length + 1}`;
    tables[table].push({ _id: id, ...values });
    return id;
  });

  const get = vi.fn(async (id: string) => {
    for (const rows of Object.values(tables)) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) return row;
    }
    return null;
  });

  const query = vi.fn((table: TableName) => ({
    collect: async () => tables[table],
    withIndex: (_name: string, cb?: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
      const filters: Array<{ field: string; value: unknown }> = [];
      cb?.({
        eq: (field: string, value: unknown) => {
          filters.push({ field, value });
          return {};
        },
      });

      const matching = () =>
        tables[table].filter((row) =>
          filters.every((filter) => row[filter.field] === filter.value)
        );

      return {
        first: async () => matching()[0] ?? null,
        order: () => ({ collect: async () => matching() }),
      };
    },
    order: () => ({ collect: async () => tables[table] }),
  }));

  return {
    tables,
    ctx: {
      db: {
        get,
        insert,
        patch,
        query,
      },
      storage: {
        getUrl: async (storageId: string) => `https://files.example/${storageId}`,
      },
    },
    spies: { get, insert, patch, query },
  };
}

describe("attendeeProfiles ops saves", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  it("rejects invalid ops passwords", async () => {
    const handler = getHandler(opsSaveBurnsEmergency);
    const { ctx, spies } = makeCtx({ applications: [application()] });

    await expect(
      handler(ctx, {
        opsPassword: "wrong",
        applicationId: APPLICATION_ID,
        numBurnsAttended: 3,
        emergencyContactName: "Emergency Person",
        emergencyContactPhone: "+15550000000",
      })
    ).rejects.toThrow("Unauthorized");

    expect(spies.get).not.toHaveBeenCalled();
    expect(spies.patch).not.toHaveBeenCalled();
  });

  it("rejects missing or inactive applications", async () => {
    const handler = getHandler(opsSaveBurnsEmergency);
    const { ctx, spies } = makeCtx({
      applications: [application({ status: "rejected" })],
    });

    await expect(
      handler(ctx, {
        opsPassword: OPS_PWD,
        applicationId: APPLICATION_ID,
        numBurnsAttended: 3,
        emergencyContactName: "Emergency Person",
        emergencyContactPhone: "+15550000000",
      })
    ).rejects.toThrow("Active application not found");

    expect(spies.patch).not.toHaveBeenCalled();
  });

  it("lets ops save burns and emergency contact for another member", async () => {
    const handler = getHandler(opsSaveBurnsEmergency);
    const { ctx, tables, spies } = makeCtx({
      applications: [application()],
      attendee_profiles: [profile()],
    });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      numBurnsAttended: 4,
      emergencyContactName: "Emergency Person",
      emergencyContactPhone: "+15550000000",
      emergencyContactEmail: "emergency@example.com",
    });

    expect(tables.attendee_profiles[0]).toMatchObject({
      numBurnsAttended: 4,
      emergencyContactName: "Emergency Person",
      emergencyContactPhone: "+15550000000",
      emergencyContactEmail: "emergency@example.com",
    });
    expect(spies.patch).toHaveBeenCalledWith(
      PROFILE_ID,
      expect.objectContaining({ updatedAt: expect.any(Number) })
    );
  });

  it("lets ops save meals on the application and creates a profile if missing", async () => {
    const handler = getHandler(opsSaveMeals);
    const { ctx, tables } = makeCtx({ applications: [application()] });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      dietaryPreference: "vegan",
      allergyFlag: true,
      allergyNotes: "Peanuts",
    });

    expect(tables.applications[0]).toMatchObject({
      dietaryPreference: "vegan",
      allergyFlag: true,
      allergyNotes: "Peanuts",
    });
    expect(tables.attendee_profiles).toHaveLength(1);
    expect(tables.attendee_profiles[0]).toMatchObject({
      userId: USER_ID,
      applicationId: APPLICATION_ID,
    });
  });

  it("logs attendee_profile_updated with an ops actor", async () => {
    const handler = getHandler(opsSaveBurnsEmergency);
    const { ctx } = makeCtx({
      applications: [application()],
      attendee_profiles: [profile()],
    });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      numBurnsAttended: 2,
      emergencyContactName: "Emergency Person",
      emergencyContactPhone: "+15550000000",
    });

    expect(logEvent).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        applicationId: APPLICATION_ID,
        eventType: "attendee_profile_updated",
        actor: "ops",
        payload: expect.objectContaining({
          email: "mina@example.com",
          section: "burnsEmergency",
        }),
      })
    );
  });

  it("refreshes the ops signup row after a save", async () => {
    const handler = getHandler(opsSaveBurnsEmergency);
    const { ctx } = makeCtx({
      applications: [application()],
      attendee_profiles: [profile()],
    });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      numBurnsAttended: 2,
      emergencyContactName: "Emergency Person",
      emergencyContactPhone: "+15550000000",
    });

    expect(upsertOpsSignupRow).toHaveBeenCalledWith(ctx, APPLICATION_ID);
  });

  it("unsticks needs-review applications when ops fixes the departure so review is no longer required", async () => {
    const handler = getHandler(opsSaveStatus);
    const { ctx, tables } = makeCtx({
      applications: [
        application({
          status: "needs_ops_review",
          paymentAllowed: false,
          earlyDepartureRequested: true,
          departure: "2026-08-31",
        }),
      ],
      attendee_profiles: [profile()],
    });

    const result = await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      hasTicket: true,
      arrival: "2026-08-25",
      arrivalTime: "11.01 am to 6.00 pm",
      departure: "2026-09-08",
      departureTime: "11.01 am to 6.00 pm",
    });

    expect(tables.applications[0]).toMatchObject({
      status: "pending_payment",
      paymentAllowed: true,
      earlyDepartureRequested: false,
      earlyDepartureReason: undefined,
    });
    expect(result).toEqual({ requiresOpsReview: false, paymentRestored: true });
  });

  it("preserves approved early departures when ops resaves status", async () => {
    const handler = getHandler(opsSaveStatus);
    const { ctx, tables } = makeCtx({
      applications: [
        application({
          status: "pending_payment",
          paymentAllowed: true,
          earlyDepartureRequested: true,
          earlyDepartureReason: "Already approved",
          departure: "2026-08-31",
        }),
      ],
      attendee_profiles: [profile()],
    });

    const result = await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      hasTicket: true,
      arrival: "2026-08-25",
      arrivalTime: "11.01 am to 6.00 pm",
      departure: "2026-08-31",
      departureTime: "11.01 am to 6.00 pm",
      earlyDepartureReason: "Already approved",
    });

    expect(tables.applications[0]).toMatchObject({
      status: "pending_payment",
      paymentAllowed: true,
      earlyDepartureRequested: true,
      earlyDepartureReason: "Already approved",
    });
    expect(result).toEqual({ requiresOpsReview: false, paymentRestored: false });
  });

  it("moves changed approved early departures back into ops review", async () => {
    const handler = getHandler(opsSaveStatus);
    const { ctx, tables } = makeCtx({
      applications: [
        application({
          status: "pending_payment",
          paymentAllowed: true,
          earlyDepartureRequested: true,
          earlyDepartureReason: "Already approved",
          departure: "2026-08-31",
          departureTime: "11.01 am to 6.00 pm",
        }),
      ],
      attendee_profiles: [profile()],
    });

    const result = await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      hasTicket: true,
      arrival: "2026-08-25",
      arrivalTime: "11.01 am to 6.00 pm",
      departure: "2026-08-25",
      departureTime: "11.01 am to 6.00 pm",
      earlyDepartureReason: "Leaving even earlier",
    });

    expect(tables.applications[0]).toMatchObject({
      status: "needs_ops_review",
      paymentAllowed: false,
      earlyDepartureRequested: true,
      earlyDepartureReason: "Leaving even earlier",
    });
    expect(result).toEqual({ requiresOpsReview: true, paymentRestored: false });
  });

  it("lets ops resave ticket status for confirmed members with already-approved early departures", async () => {
    const handler = getHandler(opsSaveStatus);
    const { ctx, tables } = makeCtx({
      applications: [
        application({
          status: "confirmed",
          paymentAllowed: true,
          earlyDepartureRequested: true,
          earlyDepartureReason: "Already approved",
          departure: "2026-08-31",
          departureTime: "11.01 am to 6.00 pm",
        }),
      ],
      attendee_profiles: [profile({ hasTicket: false })],
    });

    const result = await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      hasTicket: true,
      arrival: "2026-08-25",
      arrivalTime: "11.01 am to 6.00 pm",
      departure: "2026-08-31",
      departureTime: "11.01 am to 6.00 pm",
      earlyDepartureReason: "Already approved",
    });

    expect(tables.applications[0]).toMatchObject({
      status: "confirmed",
      paymentAllowed: true,
      earlyDepartureRequested: true,
      earlyDepartureReason: "Already approved",
    });
    expect(tables.attendee_profiles[0]).toMatchObject({ hasTicket: true });
    expect(result).toEqual({ requiresOpsReview: false, paymentRestored: false });
  });

  it("rejects ops status edits that create early departure for confirmed members", async () => {
    const handler = getHandler(opsSaveStatus);
    const { ctx, spies } = makeCtx({
      applications: [application({ status: "confirmed" })],
      attendee_profiles: [profile()],
    });

    await expect(
      handler(ctx, {
        opsPassword: OPS_PWD,
        applicationId: APPLICATION_ID,
        hasTicket: true,
        arrival: "2026-08-25",
        arrivalTime: "11.01 am to 6.00 pm",
        departure: "2026-08-31",
        departureTime: "11.01 am to 6.00 pm",
        earlyDepartureReason: "Leaving early",
      })
    ).rejects.toThrow("Confirmed members cannot be moved into early departure review");

    expect(spies.patch).not.toHaveBeenCalled();
  });

  it("lets ops save transport with an existing vehicle", async () => {
    const handler = getHandler(opsSaveTransport);
    const vehicleId = "veh_1" as Id<"vehicles">;
    const { ctx, tables } = makeCtx({
      applications: [application()],
      attendee_profiles: [profile()],
      vehicles: [{ _id: vehicleId, name: "Truck" }],
    });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      arrivalMode: "driving_own_vehicle",
      departureMode: "riding_with_attendee",
      vehicleId,
      vehiclePassStatus: "have",
      bikeStatus: "bringing_own",
    });

    expect(tables.attendee_profiles[0]).toMatchObject({
      arrivalMode: "driving_own_vehicle",
      departureMode: "riding_with_attendee",
      vehicleId,
      vehiclePassStatus: "have",
      bikeStatus: "bringing_own",
    });
  });

  it("lets ops save sleeping with an existing sleeping group", async () => {
    const handler = getHandler(opsSaveSleeping);
    const sleepingGroupId = "group_1" as Id<"sleeping_groups">;
    const { ctx, tables } = makeCtx({
      applications: [application()],
      attendee_profiles: [profile()],
      sleeping_groups: [{ _id: sleepingGroupId, name: "Pod A" }],
    });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      sleepingType: "own_shiftpod_or_tent",
      sleepingGroupId,
    });

    expect(tables.attendee_profiles[0]).toMatchObject({
      sleepingType: "own_shiftpod_or_tent",
      sleepingGroupId,
      sleepingVehicleId: undefined,
    });
  });

  it("lets ops save camp fields", async () => {
    const handler = getHandler(opsSaveCamp);
    const { ctx, tables } = makeCtx({
      applications: [application()],
      attendee_profiles: [profile()],
    });

    await handler(ctx, {
      opsPassword: OPS_PWD,
      applicationId: APPLICATION_ID,
      playaName: "Minty",
      requests: "Near shade",
    });

    expect(tables.attendee_profiles[0]).toMatchObject({
      playaName: "Minty",
      requests: "Near shade",
    });
  });
});

describe("attendeeProfiles.listEditOptionsForOps", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  it("requires the ops password before returning vehicle and sleeping options", async () => {
    const handler = getHandler(listEditOptionsForOps);
    const { ctx, spies } = makeCtx({ vehicles: [{ _id: "veh_1", name: "Truck" }] });

    await expect(handler(ctx, { opsPassword: "wrong" })).rejects.toThrow("Unauthorized");

    expect(spies.query).not.toHaveBeenCalled();
  });

  it("returns vehicles and sleeping groups with active occupancy counts for ops", async () => {
    const handler = getHandler(listEditOptionsForOps);
    const vehicleId = "veh_1" as Id<"vehicles">;
    const sleepingGroupId = "group_1" as Id<"sleeping_groups">;
    const { ctx } = makeCtx({
      applications: [
        application(),
        application({ _id: "app_2", userId: "user_2" }),
        application({ _id: "app_cancelled", userId: "user_cancelled", cancelled: true }),
      ],
      attendee_profiles: [
        profile({ vehicleId, sleepingGroupId }),
        profile({ _id: "profile_2", userId: "user_2", applicationId: "app_2", vehicleId }),
        profile({
          _id: "profile_cancelled",
          userId: "user_cancelled",
          applicationId: "app_cancelled",
          vehicleId,
          sleepingGroupId,
        }),
      ],
      vehicles: [
        {
          _id: vehicleId,
          name: "Truck",
          vehicleType: "vehicle_no_trailer",
          lengthFt: 20,
          description: "Blue",
        },
      ],
      sleeping_groups: [{ _id: sleepingGroupId, name: "Pod A" }],
    });

    const result = (await handler(ctx, { opsPassword: OPS_PWD })) as {
      vehicles: Row[];
      sleepingGroups: Row[];
    };

    expect(result.vehicles[0]).toMatchObject({
      _id: vehicleId,
      name: "Truck",
      riderCount: 2,
      sleeperCount: 0,
      createdByMe: false,
    });
    expect(result.sleepingGroups[0]).toMatchObject({
      _id: sleepingGroupId,
      name: "Pod A",
      sleeperCount: 1,
      createdByMe: false,
    });
  });
});

describe("attendeeProfiles.listForOps editable IDs", () => {
  const originalPwd = process.env.OPS_PWD;

  beforeEach(() => {
    process.env.OPS_PWD = OPS_PWD;
  });

  afterEach(() => {
    if (originalPwd === undefined) delete process.env.OPS_PWD;
    else process.env.OPS_PWD = originalPwd;
    vi.clearAllMocks();
  });

  it("returns profile and relationship IDs needed by the ops edit form", async () => {
    const handler = getHandler(listForOps);
    const vehicleId = "veh_1" as Id<"vehicles">;
    const sleepingGroupId = "group_1" as Id<"sleeping_groups">;
    const { ctx } = makeCtx({
      applications: [application()],
      attendee_profiles: [
        profile({
          vehicleId,
          sleepingType: "own_shiftpod_or_tent",
          sleepingGroupId,
        }),
      ],
      vehicles: [{ _id: vehicleId, name: "Truck", lengthFt: 20 }],
      sleeping_groups: [{ _id: sleepingGroupId, name: "Pod A" }],
    });

    const rows = (await handler(ctx, { opsPassword: OPS_PWD })) as Row[];

    expect(rows[0]).toMatchObject({
      applicationId: APPLICATION_ID,
      profileId: PROFILE_ID,
      vehicleId,
      sleepingGroupId,
    });
  });
});
