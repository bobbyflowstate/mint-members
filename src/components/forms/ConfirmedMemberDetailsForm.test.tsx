import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmedMemberDetailsForm } from "./ConfirmedMemberDetailsForm";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseAction = vi.fn();
const mockUpsertDetails = vi.fn();
const mockSubmitInvite = vi.fn();
const mockSendInviteSubmittedEmail = vi.fn();

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
    confirmedMembers: {
      getMine: "confirmedMembers:getMine",
      upsertMine: "confirmedMembers:upsertMine",
    },
    newbieInvites: {
      listMine: "newbieInvites:listMine",
      submitInvite: "newbieInvites:submitInvite",
    },
    newbieInvitesActions: {
      sendInviteSubmittedEmail: "newbieInvitesActions:sendInviteSubmittedEmail",
    },
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("ConfirmedMemberDetailsForm", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseAction.mockReset();
    mockUpsertDetails.mockReset();
    mockSubmitInvite.mockReset();
    mockSendInviteSubmittedEmail.mockReset();

    mockUseQuery.mockImplementation((query: string) => {
      if (query === "confirmedMembers:getMine") {
        return {
          hasBurningManTicket: true,
          hasVehiclePass: false,
          requests: "Ride share welcome",
          memberType: "alumni",
        };
      }

      if (query === "config:getConfig") {
        return {
          newbieInvitesEnabled: "true",
          campName: "DeMentha",
          year: "2026",
          burningManStartDate: "2026-08-31",
          burningManEndDate: "2026-09-06",
          earliestArrival: "2026-08-26",
          latestDeparture: "2026-09-09",
          departureCutoff: "2026-09-01",
          reservationFeeCents: "35000",
          maxMembers: "0",
          applicationsOpen: "true",
          paymentsEnabled: "true",
        };
      }

      if (query === "newbieInvites:listMine") {
        return [];
      }

      return undefined;
    });

    mockUseMutation.mockImplementation((mutation: string) => {
      if (mutation === "confirmedMembers:upsertMine") {
        return mockUpsertDetails;
      }

      if (mutation === "newbieInvites:submitInvite") {
        return mockSubmitInvite;
      }

      throw new Error(`Unexpected mutation ${mutation}`);
    });

    mockUseAction.mockImplementation((action: string) => {
      if (action === "newbieInvitesActions:sendInviteSubmittedEmail") {
        return mockSendInviteSubmittedEmail;
      }

      throw new Error(`Unexpected action ${action}`);
    });
  });

  it("submits a newbie invite with estimated dates and sends the under-review email", async () => {
    mockSubmitInvite.mockResolvedValue({
      inviteId: "invite_1",
      inviteEmail: "newbie@example.com",
      sponsorName: "Alex Rivera",
    });
    mockSendInviteSubmittedEmail.mockResolvedValue({ success: true });

    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Patel" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+1 (555) 123-1234" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Estimated Arrival Date"), {
      target: { value: "2026-08-24" },
    });
    fireEvent.change(screen.getByLabelText("Estimated Departure Date"), {
      target: { value: "2026-09-02" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[2]);

    fireEvent.click(screen.getByRole("button", { name: "Submit Invite for Review" }));

    await waitFor(() => {
      expect(mockSubmitInvite).toHaveBeenCalledWith({
        newbieFirstName: "Sam",
        newbieLastName: "Patel",
        newbiePhone: "+15551231234",
        newbieEmail: "newbie@example.com",
        whyTheyBelong: "Strong contributor and aligned with camp values.",
        preparednessAcknowledged: true,
        estimatedArrival: "2026-08-24",
        estimatedDeparture: "2026-09-02",
      });
    });

    await waitFor(() => {
      expect(mockSendInviteSubmittedEmail).toHaveBeenCalledWith({
        inviteId: "invite_1",
        newbieEmail: "newbie@example.com",
        sponsorName: "Alex Rivera",
      });
    });

    expect(screen.getByText("Invite submitted for review.")).toBeInTheDocument();
  });

  it("requires an estimated arrival date", async () => {
    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Patel" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+1 (555) 123-1234" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Estimated Departure Date"), {
      target: { value: "2026-09-02" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });
    fireEvent.click(screen.getAllByRole("checkbox")[2]);

    fireEvent.click(screen.getByRole("button", { name: "Submit Invite for Review" }));

    await waitFor(() => {
      expect(screen.getByText("Estimated arrival date is required.")).toBeInTheDocument();
    });

    expect(mockSubmitInvite).not.toHaveBeenCalled();
  });

  it("uses the same allowed date range as the apply form", () => {
    render(<ConfirmedMemberDetailsForm />);

    expect(screen.getByLabelText("Estimated Arrival Date")).toHaveAttribute("min", "2026-08-26");
    expect(screen.getByLabelText("Estimated Arrival Date")).toHaveAttribute("max", "2026-09-09");
    expect(screen.getByLabelText("Estimated Departure Date")).toHaveAttribute("min", "2026-08-26");
    expect(screen.getByLabelText("Estimated Departure Date")).toHaveAttribute("max", "2026-09-09");
  });

  it("links the sponsorship acknowledgement to the culture page", () => {
    render(<ConfirmedMemberDetailsForm />);

    expect(
      screen.getByRole("link", { name: "DeMentha Culture & Commitments page" })
    ).toHaveAttribute("href", "/culture");
    expect(
      screen.getByRole("link", { name: "DeMentha Culture & Commitments page" })
    ).toHaveAttribute("target", "_blank");
  });

  it("shows the real review status for sponsored newbies", () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "confirmedMembers:getMine") {
        return {
          hasBurningManTicket: true,
          hasVehiclePass: false,
          requests: "Ride share welcome",
          memberType: "alumni",
        };
      }

      if (query === "config:getConfig") {
        return {
          newbieInvitesEnabled: "true",
          campName: "DeMentha",
          year: "2026",
          burningManStartDate: "2026-08-31",
          burningManEndDate: "2026-09-06",
          earliestArrival: "2026-08-26",
          latestDeparture: "2026-09-09",
          departureCutoff: "2026-09-01",
          reservationFeeCents: "35000",
          maxMembers: "0",
          applicationsOpen: "true",
          paymentsEnabled: "true",
        };
      }

      if (query === "newbieInvites:listMine") {
        return [
          {
            _id: "invite_1",
            newbieName: "Sam Patel",
            newbieEmail: "sam@example.com",
            status: "denied",
            derivedStatus: "invited",
          },
        ];
      }

      return undefined;
    });

    render(<ConfirmedMemberDetailsForm />);

    expect(screen.getByText("denied")).toHaveClass("text-red-300");
    expect(screen.queryByText("invited")).not.toBeInTheDocument();
  });

  it("shows a friendly validation message when sponsorship acknowledgement is unchecked", async () => {
    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Sam" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Patel" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+1 (555) 123-1234" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Estimated Arrival Date"), {
      target: { value: "2026-08-24" },
    });
    fireEvent.change(screen.getByLabelText("Estimated Departure Date"), {
      target: { value: "2026-09-02" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Invite for Review" }));

    await waitFor(() => {
      expect(
        screen.getByText("You must acknowledge sponsorship responsibilities.")
      ).toBeInTheDocument();
    });

    expect(mockSubmitInvite).not.toHaveBeenCalled();
    expect(mockSendInviteSubmittedEmail).not.toHaveBeenCalled();
  });

  it("does not render the sponsor section for confirmed newbies", () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "confirmedMembers:getMine") {
        return {
          hasBurningManTicket: true,
          hasVehiclePass: false,
          requests: "",
          memberType: "newbie",
        };
      }

      if (query === "newbieInvites:listMine") {
        return [];
      }

      if (query === "config:getConfig") {
        return {
          newbieInvitesEnabled: "true",
          campName: "DeMentha",
          year: "2026",
          burningManStartDate: "2026-08-31",
          burningManEndDate: "2026-09-06",
          earliestArrival: "2026-08-26",
          latestDeparture: "2026-09-09",
          departureCutoff: "2026-09-01",
          reservationFeeCents: "35000",
          maxMembers: "0",
          applicationsOpen: "true",
          paymentsEnabled: "true",
        };
      }

      return undefined;
    });

    render(<ConfirmedMemberDetailsForm />);

    expect(screen.queryByText("Sponsor a Newbie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Invite for Review" })).not.toBeInTheDocument();
  });

  it("does not render the sponsor section when newbie invites are disabled", () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "confirmedMembers:getMine") {
        return {
          hasBurningManTicket: true,
          hasVehiclePass: false,
          requests: "",
          memberType: "alumni",
        };
      }

      if (query === "newbieInvites:listMine") {
        return [];
      }

      if (query === "config:getConfig") {
        return {
          newbieInvitesEnabled: "false",
          campName: "DeMentha",
          year: "2026",
          burningManStartDate: "2026-08-31",
          burningManEndDate: "2026-09-06",
          earliestArrival: "2026-08-26",
          latestDeparture: "2026-09-09",
          departureCutoff: "2026-09-01",
          reservationFeeCents: "35000",
          maxMembers: "0",
          applicationsOpen: "true",
          paymentsEnabled: "true",
        };
      }

      return undefined;
    });

    render(<ConfirmedMemberDetailsForm />);

    expect(screen.queryByText("Sponsor a Newbie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit Invite for Review" })).not.toBeInTheDocument();
  });
});
