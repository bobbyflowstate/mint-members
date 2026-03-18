import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ConfirmedMembersTableView } from "./ConfirmedMembersTable";

describe("ConfirmedMembersTableView", () => {
  it("renders columns in the expected order", () => {
    render(<ConfirmedMembersTableView rows={[]} />);

    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
    expect(headers).toEqual([
      "Full Name",
      "Email",
      "Phone #",
      "Member Type",
      "Sponsor",
      "Requests",
      "Arrival / Departure",
      "Has Burning Man Ticket",
      "Has Vehicle Pass",
    ]);
  });

  it("highlights non-empty requests and leaves empty requests unhighlighted", () => {
    render(
      <ConfirmedMembersTableView
        rows={[
          {
            _id: "1",
            fullName: "Alex Rivera",
            email: "alex@example.com",
            phone: "+1 555-111-2222",
            memberType: "newbie",
            sponsorName: "Taylor Host",
            requests: "Needs ride share from Reno",
            attendance: "Mon, Aug 31, 2026 (11.01 am to 6.00 pm) -> Sun, Sep 6, 2026 (6.01 pm to 12.00 am)",
            hasBurningManTicket: true,
            hasVehiclePass: false,
          },
          {
            _id: "2",
            fullName: "Jordan Lee",
            email: "jordan@example.com",
            phone: "+1 555-222-3333",
            memberType: "alumni",
            sponsorName: undefined,
            requests: "",
            attendance: "Tue, Sep 1, 2026 (12:01 am to 11.00 am) -> Sun, Sep 6, 2026 (6.01 pm to 12.00 am)",
            hasBurningManTicket: false,
            hasVehiclePass: false,
          },
        ]}
      />
    );

    const alexRow = screen.getByRole("row", { name: /Alex Rivera/i });
    expect(within(alexRow).getByText("Newbie")).toBeInTheDocument();
    expect(within(alexRow).getByText("Taylor Host")).toBeInTheDocument();
    const alexRequestsCell = within(alexRow).getByText("Needs ride share from Reno");
    expect(alexRequestsCell).toHaveClass("bg-amber-500/20");

    const jordanRow = screen.getByRole("row", { name: /Jordan Lee/i });
    expect(within(jordanRow).getByText("Alumni")).toBeInTheDocument();
    expect(within(jordanRow).getByText("—")).toBeInTheDocument();
    const jordanRequestsCell = within(jordanRow).getByText("None");
    expect(jordanRequestsCell).not.toHaveClass("bg-amber-500/20");
  });
});
