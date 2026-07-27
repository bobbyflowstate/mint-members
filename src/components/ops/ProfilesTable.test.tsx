import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilesTable } from "./ProfilesTable";

const mockUseQuery = vi.fn();
const mockDialog = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    attendeeProfiles: {
      listForOps: "attendeeProfiles:listForOps",
    },
  },
}));

vi.mock("./ProfileEditDialog", () => ({
  ProfileEditDialog: (props: { row: { fullName: string } | null }) => {
    mockDialog(props);
    return props.row ? <div>Edit dialog for {props.row.fullName}</div> : null;
  },
}));

const rows = [
  {
    applicationId: "app_1",
    fullName: "Mina Member",
    email: "mina@example.com",
    phone: "+15551234567",
    memberType: "alumni",
    status: "confirmed",
    arrival: "2026-08-25",
    arrivalTime: "11.01 am to 6.00 pm",
    departure: "2026-09-01",
    departureTime: "11.01 am to 6.00 pm",
    earlyDepartureRequested: false,
    hasTicket: true,
    dietaryPreference: "omnivore",
    allergyFlag: false,
    completeCount: 3,
    totalCount: 7,
    missingSections: ["Transport"],
  },
];

describe("ProfilesTable editing", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockDialog.mockReset();
    sessionStorage.setItem("ops_password", "secret");
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "attendeeProfiles:listForOps") {
        return rows;
      }
      return undefined;
    });
  });

  it("opens the profile edit dialog for a selected row", () => {
    render(<ProfilesTable />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Mina Member" }));

    expect(screen.getByText("Edit dialog for Mina Member")).toBeInTheDocument();
    expect(mockDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        opsPassword: "secret",
        row: expect.objectContaining({ applicationId: "app_1" }),
      })
    );
  });
});
