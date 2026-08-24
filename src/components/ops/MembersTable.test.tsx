import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembersTable } from "./MembersTable";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSetConfirmedFullPayment = vi.fn();
const mockSetInviteFullPayment = vi.fn();
const mockSetConfirmedCancelled = vi.fn();
const mockSetInviteCancelled = vi.fn();

let rows: Array<Record<string, unknown>>;
let profileForOps: Record<string, unknown> | null | undefined;
let invites: Array<Record<string, unknown>>;

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    applications: {
      listSignupsForOpsView: "applications:listSignupsForOpsView",
    },
    attendeeProfiles: {
      getForOps: "attendeeProfiles:getForOps",
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

beforeEach(() => {
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
  mockSetConfirmedFullPayment.mockReset();
  mockSetInviteFullPayment.mockReset();
  mockSetConfirmedCancelled.mockReset();
  mockSetInviteCancelled.mockReset();
  sessionStorage.setItem("ops_password", "secret");
  invites = [];
  profileForOps = {
    applicationId: "app_1",
    fullName: "Alex Rivera",
    playaName: "Sparkle",
    photoUrl: "https://files.example/headshot.jpg",
    completeCount: 5,
    totalCount: 6,
    missingSections: ["Sleeping"],
    dietaryPreference: "omnivore",
    allergyFlag: false,
    numBurnsAttended: 2,
    vehicleName: "Truck",
    emergencyContactName: "Sam Rivera",
    emergencyContactPhone: "+15559876543",
    earlyDepartureRequested: false,
    requests: "",
  };
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

  mockUseQuery.mockImplementation((query: string, args: unknown) => {
    // Match convex/react: "skip" means the query never runs.
    if (args === "skip") {
      return undefined;
    }

    if (query === "applications:listSignupsForOpsView") {
      return {
        rows,
        totalBeforeFilter: 1,
        totalAfterFilter: 1,
        truncated: false,
      };
    }

    if (query === "opsManualInvites:listUnclaimedForOps") {
      return invites;
    }

    if (query === "attendeeProfiles:getForOps") {
      return profileForOps;
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

describe("MembersTable cancellation", () => {

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

describe("MembersTable search", () => {
  it("finds an accented name typed without accents, and vice versa", async () => {
    rows = [
      { ...rows[0], _id: "row_2", applicationId: "app_2", fullName: "José Nguyễn", email: "jose@example.com" },
    ];

    render(<MembersTable />);

    const search = screen.getByPlaceholderText("Search by name or email...");

    fireEvent.change(search, { target: { value: "jose nguyen" } });
    expect(screen.getAllByRole("button", { name: "José Nguyễn" }).length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: "JOSÉ" } });
    expect(screen.getAllByRole("button", { name: "José Nguyễn" }).length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: "smith" } });
    expect(screen.queryByRole("button", { name: "José Nguyễn" })).not.toBeInTheDocument();
  });
});

describe("MembersTable profile view", () => {
  it("opens the full profile with the headshot when a member name is clicked", async () => {
    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Alex Rivera" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Profile: Alex Rivera" });
    expect(dialog).toBeInTheDocument();

    const photo = screen.getByAltText("Alex Rivera's photo");
    expect(photo).toHaveAttribute("src", "https://files.example/headshot.jpg");
    expect(screen.getByText("Profile 5/6")).toBeInTheDocument();
    expect(screen.getByText("Sam Rivera")).toBeInTheDocument();
  });

  it("enlarges the headshot when it is clicked in the profile view", async () => {
    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Alex Rivera" })[0]);
    fireEvent.click(
      await screen.findByRole("button", { name: "Enlarge Alex Rivera's photo" })
    );

    expect(
      screen.getByRole("dialog", { name: "Alex Rivera's photo" })
    ).toBeInTheDocument();
  });

  it("shows unknown rather than No for an invite with nothing filled in yet", async () => {
    invites = [
      {
        _id: "inv_1",
        firstName: "Robin",
        lastName: "Nguyen",
        email: "robin@example.com",
        phone: "+15550001111",
        arrival: "2026-08-30",
        arrivalTime: "11.01 am to 6.00 pm",
        departure: "2026-09-05",
        departureTime: "6.01 pm to 12.00 am",
        createdAt: 200,
        hasFullPayment: false,
        memberType: "newbie",
        cancelled: false,
      },
    ];

    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Robin Nguyen" })[0]);

    const dialog = await screen.findByRole("dialog", { name: "Profile: Robin Nguyen" });

    // An unclaimed invite has answered nothing, so these must not read as "No".
    const ticket = within(dialog).getByText("Has ticket").parentElement!;
    expect(ticket).toHaveTextContent("\u2014");
    expect(ticket).not.toHaveTextContent("No");

    const pass = within(dialog).getByText("Vehicle pass").parentElement!;
    expect(pass).toHaveTextContent("\u2014");
    expect(pass).not.toHaveTextContent("No");
  });

  it("keeps the profile open when a drag-select is released on the backdrop", async () => {
    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Alex Rivera" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Profile: Alex Rivera" });

    // Press inside the panel, release outside it: the browser fires the click
    // on their common ancestor, the backdrop.
    fireEvent.mouseDown(within(dialog).getByText("Sam Rivera"));
    fireEvent.click(dialog);

    expect(
      screen.getByRole("dialog", { name: "Profile: Alex Rivera" })
    ).toBeInTheDocument();

    // A press that starts and ends on the backdrop still closes it.
    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Profile: Alex Rivera" })
      ).not.toBeInTheDocument();
    });
  });

  it("closes only the lightbox when its backdrop is clicked, not the profile", async () => {
    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Alex Rivera" })[0]);
    fireEvent.click(
      await screen.findByRole("button", { name: "Enlarge Alex Rivera's photo" })
    );

    const lightbox = screen.getByRole("dialog", { name: "Alex Rivera's photo" });
    fireEvent.mouseDown(lightbox);
    fireEvent.click(lightbox);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Alex Rivera's photo" })
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByRole("dialog", { name: "Profile: Alex Rivera" })
    ).toBeInTheDocument();
  });

  it("closes the profile view on Escape", async () => {
    render(<MembersTable />);

    fireEvent.click(screen.getAllByRole("button", { name: "Alex Rivera" })[0]);
    await screen.findByRole("dialog", { name: "Profile: Alex Rivera" });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Profile: Alex Rivera" })
      ).not.toBeInTheDocument();
    });
  });
});
