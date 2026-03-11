import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ExportSignupsTable } from "./ExportSignupsTable";
import { EXPORT_SIGNUPS_VIEW_STORAGE_KEY } from "../../lib/opsSignupsView/storage";

const mockUseQuery = vi.fn();
const mockBuildSignupCsv = vi.fn();
const mockDownloadCsv = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    applications: {
      listSignupsForOpsView: "applications:listSignupsForOpsView",
    },
  },
}));

vi.mock("../../lib/opsSignupsView/csv", () => ({
  buildSignupCsv: (...args: unknown[]) => mockBuildSignupCsv(...args),
  downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));

describe("ExportSignupsTable view controls", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockBuildSignupCsv.mockReset();
    mockDownloadCsv.mockReset();
    mockBuildSignupCsv.mockReturnValue("csv-content");
    localStorage.clear();
    sessionStorage.setItem("ops_password", "test-ops-password");
    mockUseQuery.mockReturnValue({
      rows: [
        {
          _id: "row_1",
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
          hasBurningManTicket: true,
          hasVehiclePass: false,
          requests: "",
        },
        {
          _id: "row_2",
          firstName: "Jordan",
          lastName: "Lee",
          fullName: "Jordan Lee",
          email: "jordan@example.com",
          phone: "+15552342345",
          arrival: "2026-08-31",
          arrivalTime: "12:01 am to 11.00 am",
          departure: "2026-09-03",
          departureTime: "11.01 am to 6.00 pm",
          status: "pending_payment",
          applicationCreatedAt: 300,
          createdAt: 300,
          hasBurningManTicket: false,
          hasVehiclePass: true,
          requests: "",
        },
      ],
      totalBeforeFilter: 2,
      totalAfterFilter: 2,
      truncated: false,
    });
  });

  it("hides a column when checkbox is toggled off", () => {
    render(<ExportSignupsTable />);

    expect(screen.getByRole("columnheader", { name: "Email" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Show Email"));

    expect(screen.queryByRole("columnheader", { name: "Email" })).not.toBeInTheDocument();
  });

  it("updates query view state when arrival on_or_before filter is applied", () => {
    render(<ExportSignupsTable />);

    fireEvent.change(screen.getByLabelText("Arrival Operator"), {
      target: { value: "on_or_before" },
    });
    fireEvent.change(screen.getByLabelText("Arrival Date"), {
      target: { value: "2026-08-30" },
    });

    const callWithArrivalFilter = mockUseQuery.mock.calls.find((call) => {
      const args = call[1] as {
        viewState?: { filters?: Array<{ field: string; operator: string; value?: string }> };
      };
      return args?.viewState?.filters?.some(
        (filter) =>
          filter.field === "arrival" &&
          filter.operator === "on_or_before" &&
          filter.value === "2026-08-30"
      );
    });
    const args = callWithArrivalFilter?.[1] as {
      viewState?: { filters?: Array<{ field: string; operator: string; value?: string }> };
    };

    expect(args.viewState?.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "arrival",
          operator: "on_or_before",
          value: "2026-08-30",
        }),
      ])
    );
  });

  it("updates query view state when sort controls change", () => {
    render(<ExportSignupsTable />);

    fireEvent.change(screen.getByLabelText("Sort Field"), {
      target: { value: "arrival" },
    });
    fireEvent.change(screen.getByLabelText("Sort Direction"), {
      target: { value: "asc" },
    });

    const callWithArrivalSort = mockUseQuery.mock.calls.find((call) => {
      const args = call[1] as { viewState?: { sort?: { field: string; direction: string } } };
      return (
        args?.viewState?.sort?.field === "arrival" &&
        args?.viewState?.sort?.direction === "asc"
      );
    });
    const args = callWithArrivalSort?.[1] as {
      viewState?: { sort?: { field: string; direction: string } };
    };

    expect(args.viewState?.sort).toEqual({
      field: "arrival",
      direction: "asc",
    });
  });

  it("limits date pickers to min/max arrival and departure bounds", () => {
    render(<ExportSignupsTable />);

    const arrivalInput = screen.getByLabelText("Arrival Date");
    const departureInput = screen.getByLabelText("Departure Date");

    expect(arrivalInput).toHaveAttribute("min", "2026-08-29");
    expect(arrivalInput).toHaveAttribute("max", "2026-09-06");
    expect(departureInput).toHaveAttribute("min", "2026-08-29");
    expect(departureInput).toHaveAttribute("max", "2026-09-06");
  });

  it("exports current view with currently visible columns", () => {
    render(<ExportSignupsTable />);

    fireEvent.click(screen.getByLabelText("Show Email"));
    fireEvent.click(screen.getByRole("button", { name: "Export current view" }));

    expect(mockBuildSignupCsv).toHaveBeenCalledTimes(1);
    const [, columns] = mockBuildSignupCsv.mock.calls[0] as [
      unknown[],
      Array<{ header: string }>
    ];
    const headers = columns.map((column) => column.header);

    expect(headers).not.toContain("Email");
    expect(headers).toEqual(
      expect.arrayContaining(["First Name", "Last Name", "Phone", "Status", "Arrival", "Departure"])
    );

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    expect(mockDownloadCsv.mock.calls[0][0]).toMatch(/^signups-export-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mockDownloadCsv.mock.calls[0][1]).toBe("csv-content");
  });

  it("restores persisted view state from localStorage", () => {
    localStorage.setItem(
      EXPORT_SIGNUPS_VIEW_STORAGE_KEY,
      JSON.stringify({
        visibleColumns: ["firstName", "phone"],
        arrivalOperator: "after",
        arrivalDate: "2026-08-30",
        departureOperator: "before",
        departureDate: "2026-09-05",
        statusFilter: "confirmed",
        searchField: "email",
        searchValue: "alex@",
        sortField: "arrival",
        sortDirection: "asc",
      })
    );

    render(<ExportSignupsTable />);

    expect(screen.queryByRole("columnheader", { name: "Email" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Arrival Operator")).toHaveValue("after");
    expect(screen.getByLabelText("Arrival Date")).toHaveValue("2026-08-30");
    expect(screen.getByLabelText("Sort Field")).toHaveValue("arrival");
    expect(screen.getByLabelText("Sort Direction")).toHaveValue("asc");
    expect(screen.getByLabelText("Search Field")).toHaveValue("email");
    expect(screen.getByLabelText("Search")).toHaveValue("alex@");
  });
});
