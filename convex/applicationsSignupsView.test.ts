import { afterEach, describe, expect, it, vi } from "vitest";
import { listSignupsForOpsView } from "./applications";

type ConvexHandler = (ctx: unknown, args: unknown) => Promise<unknown>;
interface SignupsViewQueryResult {
  totalBeforeFilter: number;
  totalAfterFilter: number;
  truncated: boolean;
  rows: Array<{ email: string }>;
}

function getHandler(queryObject: unknown): ConvexHandler {
  const maybeHandler = (queryObject as { handler?: unknown; _handler?: unknown }).handler;
  if (typeof maybeHandler === "function") {
    return maybeHandler as ConvexHandler;
  }

  const maybeInternalHandler = (queryObject as { _handler?: unknown })._handler;
  if (typeof maybeInternalHandler === "function") {
    return maybeInternalHandler as ConvexHandler;
  }

  throw new Error("Unable to locate Convex query handler");
}

describe("applications.listSignupsForOpsView auth", () => {
  const originalOpsPwd = process.env.OPS_PWD;

  afterEach(() => {
    if (originalOpsPwd === undefined) {
      delete process.env.OPS_PWD;
    } else {
      process.env.OPS_PWD = originalOpsPwd;
    }
    vi.restoreAllMocks();
  });

  it("throws when ops password is invalid", async () => {
    process.env.OPS_PWD = "correct-password";
    const handler = getHandler(listSignupsForOpsView);
    const querySpy = vi.fn();
    const ctx = { db: { query: querySpy } };

    await expect(
      handler(ctx, {
        opsPassword: "wrong-password",
        viewState: {},
      })
    ).rejects.toThrow("Unauthorized: Invalid ops password");
    expect(querySpy).not.toHaveBeenCalled();
  });
});

describe("applications.listSignupsForOpsView filtering/sorting", () => {
  const originalOpsPwd = process.env.OPS_PWD;

  afterEach(() => {
    if (originalOpsPwd === undefined) {
      delete process.env.OPS_PWD;
    } else {
      process.env.OPS_PWD = originalOpsPwd;
    }
    vi.restoreAllMocks();
  });

  it("filters and sorts ops projection rows using view state", async () => {
    process.env.OPS_PWD = "correct-password";
    const handler = getHandler(listSignupsForOpsView);

    const rows = [
      {
        _id: "row_1",
        email: "alex@example.com",
        fullName: "Alex Rivera",
        arrival: "2026-08-29",
        status: "confirmed",
        applicationCreatedAt: 100,
      },
      {
        _id: "row_2",
        email: "jordan@example.com",
        fullName: "Jordan Lee",
        arrival: "2026-08-31",
        status: "pending_payment",
        applicationCreatedAt: 300,
      },
      {
        _id: "row_3",
        email: "sam@example.com",
        fullName: "Sam Patel",
        arrival: "2026-08-28",
        status: "confirmed",
        applicationCreatedAt: 200,
      },
    ];

    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              take: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      },
    };

    const result = (await handler(ctx, {
      opsPassword: "correct-password",
      viewState: {
        filters: [
          { field: "status", operator: "eq", value: "confirmed" },
          { field: "arrival", operator: "on_or_before", value: "2026-08-29" },
        ],
        sort: { field: "arrival", direction: "asc" },
      },
      limit: 5000,
    })) as SignupsViewQueryResult;

    expect(result.totalBeforeFilter).toBe(3);
    expect(result.totalAfterFilter).toBe(2);
    expect(result.truncated).toBe(false);
    expect(result.rows.map((row) => row.email)).toEqual([
      "sam@example.com",
      "alex@example.com",
    ]);
  });

  it("marks truncated only when rows exceed limit", async () => {
    process.env.OPS_PWD = "correct-password";
    const handler = getHandler(listSignupsForOpsView);

    const rows = [
      {
        _id: "row_1",
        email: "a@example.com",
        fullName: "A One",
        arrival: "2026-08-29",
        status: "confirmed",
        applicationCreatedAt: 100,
      },
      {
        _id: "row_2",
        email: "b@example.com",
        fullName: "B Two",
        arrival: "2026-08-30",
        status: "confirmed",
        applicationCreatedAt: 200,
      },
      {
        _id: "row_3",
        email: "c@example.com",
        fullName: "C Three",
        arrival: "2026-08-31",
        status: "confirmed",
        applicationCreatedAt: 300,
      },
    ];

    const takeSpy = vi.fn().mockResolvedValue(rows);
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              take: takeSpy,
            }),
          }),
        }),
      },
    };

    const result = (await handler(ctx, {
      opsPassword: "correct-password",
      viewState: {
        filters: [],
        sort: { field: "createdAt", direction: "desc" },
      },
      limit: 2,
    })) as SignupsViewQueryResult;

    expect(takeSpy).toHaveBeenCalledWith(3);
    expect(result.rows).toHaveLength(2);
    expect(result.totalBeforeFilter).toBe(2);
    expect(result.truncated).toBe(true);
  });
});
