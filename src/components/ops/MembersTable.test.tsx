import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembersTable } from "./MembersTable";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSetConfirmedFullPayment = vi.fn();
const mockSetInviteFullPayment = vi.fn();
const mockSetConfirmedCancelled = vi.fn();
const mockSetInviteCancelled = vi.fn();

let rows: Array<Record<string, unknown>>;

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    applications: {
      listSignupsForOpsView: "applications:listSignupsForOpsView",
    },
    confirmedMembers: {
      setFullPayment: "confirmedMembers:setFullPayment",
      setCancelledForOps: "confirmedMembers:setCancelledForOps",
    },
    opsManualInvites: {
      listUnclaimedForOps: "opsManualInvites:listUnclaimedForOps",
      setFullPayment: "opsManualInvites:setFullPayment",
      setCancelledForOps: "opsManualInvites:setCancelledForOps",
      addForOps: "opsManualInvites:addForOps",
    },
  },
}));

vi.mock("./AddManualMemberModal", () => ({
  AddManualMemberModal: () => null,
}));

describe("MembersTable cancellation", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockSetConfirmedFullPayment.mockReset();
    mockSetInviteFullPayment.mockReset();
    mockSetConfirmedCancelled.mockReset();
    mockSetInviteCancelled.mockReset();
    sessionStorage.setItem("ops_password", "secret");
    rows = [
      {
        _id: "row_1",
        _source: "signup",
        applicationId: "app_1",
        firstName: "Alex",
        lastName: "Rivera",
        fullName: "Alex Rivera",
        email: "alex@example.com",
        phone: "+15551231234",
        arrival: "2026-08-29",
        arrivalTime: "11.01 am to 6.00 pm",
        departure: "2026-09-06",
        departureTime: "6.01 pm to 12.00 am",
        status: "confirmed",
        applicationCreatedAt: 100,
        createdAt: 100,
        paymentAllowed: true,
        hasFullPayment: true,
        hasBurningManTicket: true,
        hasVehiclePass: false,
        requests: "",
        memberType: "alumni",
      },
    ];

    mockUseQuery.mockImplementation((query: string) => {
      if (query === "applications:listSignupsForOpsView") {
        return {
          rows,
          totalBeforeFilter: 1,
          totalAfterFilter: 1,
          truncated: false,
        };
      }

      if (query === "opsManualInvites:listUnclaimedForOps") {
        return [];
      }

      return undefined;
    });

    mockUseMutation.mockImplementation((mutation: string) => {
      if (mutation === "confirmedMembers:setFullPayment") return mockSetConfirmedFullPayment;
      if (mutation === "opsManualInvites:setFullPayment") return mockSetInviteFullPayment;
      if (mutation === "confirmedMembers:setCancelledForOps") return mockSetConfirmedCancelled;
      if (mutation === "opsManualInvites:setCancelledForOps") return mockSetInviteCancelled;
      throw new Error(`Unexpected mutation ${mutation}`);
    });
  });

  it("does not cancel a member when the confirmation is declined", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      "Cancel Alex Rivera? This will block their member access and payment flow."
    );
    await waitFor(() => {
      expect(mockSetConfirmedCancelled).not.toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it("undoes a reinstate without asking for cancel confirmation again", async () => {
    rows = [{ ...rows[0], cancelled: true }];
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockSetConfirmedCancelled.mockResolvedValue({ success: true });

    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Reinstate" })[0]);

    await waitFor(() => {
      expect(mockSetConfirmedCancelled).toHaveBeenCalledWith({
        opsPassword: "secret",
        applicationId: "app_1",
        cancelled: false,
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(mockSetConfirmedCancelled).toHaveBeenCalledWith({
        opsPassword: "secret",
        applicationId: "app_1",
        cancelled: true,
      });
    });
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
