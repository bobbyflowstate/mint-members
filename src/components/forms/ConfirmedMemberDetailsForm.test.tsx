import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmedMemberDetailsForm } from "./ConfirmedMemberDetailsForm";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseAction = vi.fn();
const mockUpsertDetails = vi.fn();
const mockSubmitInvite = vi.fn();
const mockSendInviteEmail = vi.fn();

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
      sendInviteEmail: "newbieInvitesActions:sendInviteEmail",
    },
  },
}));

describe("ConfirmedMemberDetailsForm", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseAction.mockReset();
    mockUpsertDetails.mockReset();
    mockSubmitInvite.mockReset();
    mockSendInviteEmail.mockReset();

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
      if (action === "newbieInvitesActions:sendInviteEmail") {
        return mockSendInviteEmail;
      }

      throw new Error(`Unexpected action ${action}`);
    });
  });

  it("submits a newbie invite and sends the invite email", async () => {
    mockSubmitInvite.mockResolvedValue({
      inviteId: "invite_1",
      inviteEmail: "newbie@example.com",
      sponsorName: "Alex Rivera",
    });
    mockSendInviteEmail.mockResolvedValue({ success: true });

    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Sam Patel" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+1 (555) 123-1234" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });
    fireEvent.click(
      screen.getByLabelText(
        "I have consciously sponsored this person and will properly prepare them."
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));

    await waitFor(() => {
      expect(mockSubmitInvite).toHaveBeenCalledWith({
        newbieName: "Sam Patel",
        newbiePhone: "+15551231234",
        newbieEmail: "newbie@example.com",
        whyTheyBelong: "Strong contributor and aligned with camp values.",
        preparednessAcknowledged: true,
      });
    });

    await waitFor(() => {
      expect(mockSendInviteEmail).toHaveBeenCalledWith({
        inviteId: "invite_1",
        newbieEmail: "newbie@example.com",
        sponsorName: "Alex Rivera",
      });
    });

    expect(screen.getByText("Invite sent.")).toBeInTheDocument();
  });

  it("shows a friendly validation message when sponsorship acknowledgement is unchecked", async () => {
    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Sam Patel" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+1 (555) 123-1234" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));

    await waitFor(() => {
      expect(
        screen.getByText("You must acknowledge sponsorship responsibilities.")
      ).toBeInTheDocument();
    });

    expect(mockSubmitInvite).not.toHaveBeenCalled();
    expect(mockSendInviteEmail).not.toHaveBeenCalled();
  });

  it("shows a friendly required message when newbie phone is missing", async () => {
    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Sam Patel" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });
    fireEvent.click(
      screen.getByLabelText(
        "I have consciously sponsored this person and will properly prepare them."
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));

    await waitFor(() => {
      expect(screen.getByText("Newbie phone number is required.")).toBeInTheDocument();
    });

    expect(mockSubmitInvite).not.toHaveBeenCalled();
  });

  it("shows a friendly validation message when newbie phone is incomplete", async () => {
    render(<ConfirmedMemberDetailsForm />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Sam Patel" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number"), {
      target: { value: "+1 555" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newbie@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Why would they be a good addition?"), {
      target: { value: "Strong contributor and aligned with camp values." },
    });
    fireEvent.click(
      screen.getByLabelText(
        "I have consciously sponsored this person and will properly prepare them."
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a complete phone number including country code.")
      ).toBeInTheDocument();
    });

    expect(mockSubmitInvite).not.toHaveBeenCalled();
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
        };
      }

      return undefined;
    });

    render(<ConfirmedMemberDetailsForm />);

    expect(screen.queryByText("Sponsor a Newbie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Invite" })).not.toBeInTheDocument();
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
        };
      }

      return undefined;
    });

    render(<ConfirmedMemberDetailsForm />);

    expect(screen.queryByText("Sponsor a Newbie")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send Invite" })).not.toBeInTheDocument();
  });
});
