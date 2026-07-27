import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileEditDialog } from "./ProfileEditDialog";

const mockUseMutation = vi.fn();
const mockUseQuery = vi.fn();
const mockSaveStatus = vi.fn();
const mockSaveBurnsEmergency = vi.fn();
const mockSaveMeals = vi.fn();
const mockSaveTransport = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    attendeeProfiles: {
      opsSaveStatus: "attendeeProfiles:opsSaveStatus",
      opsSaveBurnsEmergency: "attendeeProfiles:opsSaveBurnsEmergency",
      opsSaveTransport: "attendeeProfiles:opsSaveTransport",
      opsSaveSleeping: "attendeeProfiles:opsSaveSleeping",
      opsSaveMeals: "attendeeProfiles:opsSaveMeals",
      opsSaveCamp: "attendeeProfiles:opsSaveCamp",
      listEditOptionsForOps: "attendeeProfiles:listEditOptionsForOps",
    },
    config: {
      getConfig: "config:getConfig",
    },
    vehicles: {
      list: "vehicles:list",
    },
    sleepingGroups: {
      list: "sleepingGroups:list",
    },
  },
}));

const row = {
  applicationId: "app_1",
  profileId: "profile_1",
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
  numBurnsAttended: 2,
  emergencyContactName: "Old Contact",
  emergencyContactPhone: "+15550000000",
  emergencyContactEmail: "old@example.com",
  dietaryPreference: "omnivore",
  allergyFlag: false,
  playaName: "Minty",
  requests: "Quiet spot",
  completeCount: 3,
  totalCount: 7,
  missingSections: [],
};

describe("ProfileEditDialog", () => {
  beforeEach(() => {
    mockUseMutation.mockReset();
    mockUseQuery.mockReset();
    mockSaveStatus.mockReset();
    mockSaveBurnsEmergency.mockReset();
    mockSaveMeals.mockReset();
    mockSaveTransport.mockReset();

    mockUseMutation.mockImplementation((mutation: string) => {
      if (mutation === "attendeeProfiles:opsSaveStatus") {
        return mockSaveStatus;
      }
      if (mutation === "attendeeProfiles:opsSaveBurnsEmergency") {
        return mockSaveBurnsEmergency;
      }
      if (mutation === "attendeeProfiles:opsSaveMeals") {
        return mockSaveMeals;
      }
      if (mutation === "attendeeProfiles:opsSaveTransport") {
        return mockSaveTransport;
      }
      return vi.fn().mockResolvedValue(undefined);
    });

    mockUseQuery.mockImplementation((query: string) => {
      if (query === "vehicles:list" || query === "sleepingGroups:list") {
        return [];
      }
      if (query === "attendeeProfiles:listEditOptionsForOps") {
        return {
          vehicles: [
            {
              _id: "veh_1",
              name: "Truck",
              vehicleType: "vehicle_no_trailer",
              lengthFt: 20,
              description: "Blue truck",
              riderCount: 0,
              sleeperCount: 0,
              createdByMe: false,
            },
          ],
          sleepingGroups: [{ _id: "group_1", name: "Pod A", sleeperCount: 0, createdByMe: false }],
        };
      }
      if (query === "config:getConfig") {
        return {
          campName: "DeMentha",
          year: "2026",
          burningManStartDate: "2026-08-31",
          burningManEndDate: "2026-09-06",
          earliestArrival: "2026-08-24",
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
  });

  it("renders the selected member identity", () => {
    render(
      <ProfileEditDialog
        row={row as never}
        opsPassword="secret"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Edit Mina Member" })).toBeInTheDocument();
    expect(screen.getByText("mina@example.com")).toBeInTheDocument();
  });

  it("saves burns and emergency contact through the ops mutation", async () => {
    mockSaveBurnsEmergency.mockResolvedValue(undefined);
    render(
      <ProfileEditDialog
        row={row as never}
        opsPassword="secret"
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/How many burns have they been to/), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByLabelText(/Emergency contact full name/), {
      target: { value: "New Contact" },
    });
    fireEvent.change(screen.getByLabelText(/Emergency contact phone/), {
      target: { value: "+1 555 111 2222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Burns & Emergency" }));

    await waitFor(() => {
      expect(mockSaveBurnsEmergency).toHaveBeenCalledWith({
        opsPassword: "secret",
        applicationId: "app_1",
        numBurnsAttended: 4,
        emergencyContactName: "New Contact",
        emergencyContactPhone: "+15551112222",
        emergencyContactEmail: "old@example.com",
      });
    });
  });

  it("saves meals through the ops mutation", async () => {
    mockSaveMeals.mockResolvedValue(undefined);
    render(
      <ProfileEditDialog
        row={row as never}
        opsPassword="secret"
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Dietary preference/), {
      target: { value: "vegan" },
    });
    fireEvent.change(screen.getByLabelText(/Food allergies/), {
      target: { value: "yes" },
    });
    fireEvent.change(screen.getByLabelText(/Allergy details/), {
      target: { value: "Peanuts" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Meals" }));

    await waitFor(() => {
      expect(mockSaveMeals).toHaveBeenCalledWith({
        opsPassword: "secret",
        applicationId: "app_1",
        dietaryPreference: "vegan",
        allergyFlag: true,
        allergyNotes: "Peanuts",
      });
    });
  });

  it("shows when a status save restores payment", async () => {
    mockSaveStatus.mockResolvedValue({
      requiresOpsReview: false,
      paymentRestored: true,
    });
    render(
      <ProfileEditDialog
        row={{ ...row, status: "needs_ops_review", departure: "2026-09-08" } as never}
        opsPassword="secret"
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Status" }));

    await waitFor(() => {
      expect(mockSaveStatus).toHaveBeenCalled();
    });
    expect(
      await screen.findByText("This edit restored payment for the member.")
    ).toBeInTheDocument();
  });

  it("uses ops edit options for vehicle picks instead of member-gated lists", async () => {
    mockSaveTransport.mockResolvedValue(undefined);
    render(
      <ProfileEditDialog
        row={row as never}
        opsPassword="secret"
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/Arrival mode/), {
      target: { value: "driving_own_vehicle" },
    });
    fireEvent.change(screen.getByLabelText(/Departure mode/), {
      target: { value: "riding_with_attendee" },
    });
    await waitFor(() => {
      expect(screen.queryAllByLabelText(/Vehicle/).length).toBeGreaterThan(1);
    });
    fireEvent.change(screen.getAllByLabelText(/Vehicle/)[0], {
      target: { value: "veh_1" },
    });
    fireEvent.change(screen.getByLabelText(/Vehicle pass/), {
      target: { value: "have" },
    });
    fireEvent.change(screen.getByLabelText(/Bike/), {
      target: { value: "bringing_own" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Transport" }));

    await waitFor(() => {
      expect(mockSaveTransport).toHaveBeenCalledWith({
        opsPassword: "secret",
        applicationId: "app_1",
        arrivalMode: "driving_own_vehicle",
        departureMode: "riding_with_attendee",
        vehicleId: "veh_1",
        vehiclePassStatus: "have",
        bikeStatus: "bringing_own",
      });
    });
  });

  it("shows mutation errors without closing the dialog", async () => {
    const onClose = vi.fn();
    mockSaveMeals.mockRejectedValue(new Error("Please describe your food allergies"));
    render(
      <ProfileEditDialog
        row={row as never}
        opsPassword="secret"
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByLabelText(/Food allergies/), {
      target: { value: "yes" },
    });
    fireEvent.change(screen.getByLabelText(/Allergy details/), {
      target: { value: "Peanuts" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Meals" }));

    expect(await screen.findByText("Please describe your food allergies")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
