import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainingTable } from "./TrainingTable";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    training: {
      listForOps: "training:listForOps",
    },
  },
}));

const rows = [
  {
    applicationId: "app_1",
    fullName: "Nia Newbie",
    email: "nia@example.com",
    memberType: "newbie",
    status: "confirmed",
    cells: [
      { slug: "lnt", title: "Leave No Trace", status: "in_progress", updatedAt: 1_700_000_000_000, staleCompletion: false },
      { slug: "general", title: "How to be a Dementhian", status: "not_started", staleCompletion: true, previousCompletedAt: 1_660_000_000_000 },
    ],
    completeCount: 0,
    totalCount: 2,
    allComplete: false,
    lastActivityAt: 1_700_000_000_000,
  },
  {
    applicationId: "app_2",
    fullName: "Mina Member",
    email: "mina@example.com",
    memberType: "alumni",
    status: "confirmed",
    cells: [
      { slug: "lnt", title: "Leave No Trace", status: "complete", completedAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, staleCompletion: false },
      { slug: "general", title: "How to be a Dementhian", status: "complete", completedAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, staleCompletion: false },
    ],
    completeCount: 2,
    totalCount: 2,
    allComplete: true,
    lastActivityAt: 1_700_000_000_000,
  },
];

describe("TrainingTable", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    sessionStorage.setItem("ops_password", "secret");
    mockUseQuery.mockImplementation((query: string) =>
      query === "training:listForOps" ? rows : undefined
    );
  });

  it("shows each member's per-module status, including a retake", () => {
    render(<TrainingTable />);

    expect(screen.getByText("Nia Newbie")).toBeInTheDocument();
    expect(screen.getByText("Retake needed")).toBeInTheDocument();
    expect(screen.getByText(/last done/)).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getAllByText("Complete")).toHaveLength(2);
    expect(screen.getByText("0/2")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("filters to the members who still owe training", () => {
    render(<TrainingTable />);

    fireEvent.click(screen.getByRole("button", { name: "Outstanding (1)" }));

    expect(screen.getByText("Nia Newbie")).toBeInTheDocument();
    expect(screen.queryByText("Mina Member")).not.toBeInTheDocument();
  });

  it("searches by name and email", () => {
    render(<TrainingTable />);

    fireEvent.change(screen.getByPlaceholderText("Search name or email…"), {
      target: { value: "mina@" },
    });

    expect(screen.getByText("Mina Member")).toBeInTheDocument();
    expect(screen.queryByText("Nia Newbie")).not.toBeInTheDocument();
  });

  it("asks for the ops password before querying", () => {
    sessionStorage.removeItem("ops_password");

    render(<TrainingTable />);

    expect(
      screen.getByText("Enter the ops password to view training status.")
    ).toBeInTheDocument();
    expect(mockUseQuery).toHaveBeenCalledWith("training:listForOps", "skip");
  });
});
