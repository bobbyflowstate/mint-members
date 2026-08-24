import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemberNameLink } from "./MemberNameLink";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { attendeeProfiles: { getForOps: "attendeeProfiles:getForOps" } },
}));

describe("MemberNameLink", () => {
  beforeEach(() => {
    sessionStorage.setItem("ops_password", "secret");
  });

  it("opens the profile dialog when an application id is known", () => {
    render(<MemberNameLink applicationId="app_1" name="Alex Rivera" />);

    fireEvent.click(screen.getByRole("button", { name: "Alex Rivera" }));

    expect(
      screen.getByRole("dialog", { name: "Profile: Alex Rivera" })
    ).toBeInTheDocument();
  });

  it("renders plain text when there is no profile behind the name", () => {
    render(<MemberNameLink name="Robin Nguyen" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Robin Nguyen")).toBeInTheDocument();
  });

  it("renders plain text when ops is not authenticated", () => {
    sessionStorage.removeItem("ops_password");

    render(<MemberNameLink applicationId="app_1" name="Alex Rivera" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
