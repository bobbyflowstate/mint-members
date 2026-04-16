import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewbieInvitesTable } from "./NewbieInvitesTable";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseAction = vi.fn();
const mockSetInviteDecision = vi.fn();
const mockSendApprovalEmail = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useAction: (...args: unknown[]) => mockUseAction(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    config: {
      getConfig: "config:getConfig",
    },
    newbieInvites: {
      listForOps: "newbieInvites:listForOps",
      setInviteDecision: "newbieInvites:setInviteDecision",
    },
    newbieInvitesActions: {
      sendInviteApprovedEmail: "newbieInvitesActions:sendInviteApprovedEmail",
    },
  },
}));

describe("NewbieInvitesTable", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseAction.mockReset();
    mockSetInviteDecision.mockReset();
    mockSendApprovalEmail.mockReset();
    sessionStorage.setItem("ops_password", "secret");

    mockUseQuery.mockImplementation((query: string) => {
      if (query === "config:getConfig") {
        return {
          departureCutoff: "2026-09-03",
        };
      }

      if (query === "newbieInvites:listForOps") {
        return [
          {
            _id: "invite_1",
            sponsorName: "Alex Rivera",
            sponsorEmail: "alex@example.com",
            newbieName: "Sam Patel",
            newbieEmail: "sam@example.com",
            newbiePhone: "+15551231234",
            whyTheyBelong: "Great fit",
            earlyDepartureReason: "Needs to leave for work.",
            preparednessAcknowledged: true,
            estimatedArrival: "2026-08-24",
            estimatedDeparture: "2026-09-02",
            createdAt: 1710000000000,
            status: "pending",
          },
          {
            _id: "invite_2",
            sponsorName: "Jordan Lee",
            sponsorEmail: "jordan@example.com",
            newbieName: "Taylor Kim",
            newbieEmail: "taylor@example.com",
            newbiePhone: "+15557654321",
            whyTheyBelong: "Applied already",
            preparednessAcknowledged: true,
            estimatedArrival: "2026-08-25",
            estimatedDeparture: "2026-09-03",
            createdAt: 1710000001000,
            status: "accepted",
            applicationId: "app_1",
          },
        ];
      }

      return undefined;
    });

    mockUseMutation.mockImplementation((mutation: string) => {
      if (mutation === "newbieInvites:setInviteDecision") {
        return mockSetInviteDecision;
      }

      throw new Error(`Unexpected mutation ${mutation}`);
    });

    mockUseAction.mockImplementation((action: string) => {
      if (action === "newbieInvitesActions:sendInviteApprovedEmail") {
        return mockSendApprovalEmail;
      }

      throw new Error(`Unexpected action ${action}`);
    });
  });

  it("shows direct Accept and Deny actions only for pending invites", () => {
    render(<NewbieInvitesTable />);

    expect(screen.getAllByText("Invite details")).toHaveLength(2);
    expect(screen.getAllByText("Why they belong")).toHaveLength(2);
    expect(screen.getAllByText("Early departure reason")).toHaveLength(2);
    expect(screen.getAllByText("Preparedness acknowledged")).toHaveLength(2);
    expect(screen.getByText("Needs to leave for work.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Accept" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Deny" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("highlights invites with an estimated departure before the departure cutoff", () => {
    render(<NewbieInvitesTable />);

    expect(screen.queryByText("Early")).not.toBeInTheDocument();
    const earlyDepartureSections = screen.getAllByText("Early departure reason");
    const estimatedDepartureValues = screen.getAllByText(/2026-09-0[23]/);

    expect(earlyDepartureSections[0].closest("section")).toHaveClass("bg-amber-500/10");
    expect(earlyDepartureSections[1].closest("section")).not.toHaveClass("bg-amber-500/10");
    expect(estimatedDepartureValues[0]).toHaveClass("text-amber-200");
    expect(estimatedDepartureValues[1]).not.toHaveClass("text-amber-200");
  });

  it("confirms before accepting and sends the approval email when needed", async () => {
    mockSetInviteDecision.mockResolvedValue({
      success: true,
      status: "accepted",
      shouldSendApprovalEmail: true,
    });
    mockSendApprovalEmail.mockResolvedValue({ success: true });

    render(<NewbieInvitesTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]);

    expect(
      screen.getByText(
        "Are you sure? This will send the newbie an email letting them know they can apply."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes" }));

    await waitFor(() => {
      expect(mockSetInviteDecision).toHaveBeenCalledWith({
        inviteId: "invite_1",
        accepted: true,
        opsPassword: "secret",
      });
    });

    await waitFor(() => {
      expect(mockSendApprovalEmail).toHaveBeenCalledWith({
        inviteId: "invite_1",
        newbieEmail: "sam@example.com",
        sponsorName: "Alex Rivera",
      });
    });
  });

  it("reveals change actions for already decided invites", () => {
    render(<NewbieInvitesTable />);

    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    const acceptButtons = screen.getAllByRole("button", { name: "Accept" });
    const denyButtons = screen.getAllByRole("button", { name: "Deny" });

    expect(acceptButtons).toHaveLength(2);
    expect(denyButtons).toHaveLength(2);
    expect(denyButtons[1]).toBeDisabled();
  });
});
