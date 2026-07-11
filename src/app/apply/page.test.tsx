import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApplicationFormWithCheck } from "./page";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockClaim = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  Authenticated: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Unauthenticated: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AuthLoading: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    applications: {
      getMyApplication: "applications:getMyApplication",
      getCapacityStatus: "applications:getCapacityStatus",
    },
    opsManualInvites: {
      getMyPendingInvite: "opsManualInvites:getMyPendingInvite",
      claim: "opsManualInvites:claim",
    },
    config: {
      getConfig: "config:getConfig",
    },
    users: {
      currentUser: "users:currentUser",
    },
    allowlist: {
      isEmailAllowed: "allowlist:isEmailAllowed",
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

vi.mock("@/components/forms", () => ({
  ApplicationForm: () => <div>Application form</div>,
}));

vi.mock("@/components/forms/SponsorNewbieForm", () => ({
  SponsorNewbieForm: () => <div>Sponsor newbie form</div>,
}));

const content = {
  campName: "DeMentha",
  reservationFeeFormatted: "$350",
};

describe("ApplicationFormWithCheck", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockClaim.mockReset();
    mockUseMutation.mockReturnValue(mockClaim);
  });

  it("shows cancelled state instead of confirmed details for cancelled confirmed applications", () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "applications:getMyApplication") {
        return {
          _id: "app_cancelled",
          firstName: "Casey",
          lastName: "Cancelled",
          email: "casey@example.com",
          status: "confirmed",
          paymentAllowed: true,
          cancelled: true,
          arrival: "2026-08-31",
          departure: "2026-09-06",
        };
      }

      if (query === "opsManualInvites:getMyPendingInvite") {
        return null;
      }

      if (query === "config:getConfig") {
        return { allowlistEnabled: "true" };
      }

      if (query === "users:currentUser") {
        return { email: "casey@example.com" };
      }

      if (query === "applications:getCapacityStatus") {
        return { isFull: false, maxMembers: 100 };
      }

      if (query === "allowlist:isEmailAllowed") {
        return true;
      }

      return undefined;
    });

    render(
      <ApplicationFormWithCheck
        content={content as Parameters<typeof ApplicationFormWithCheck>[0]["content"]}
        paymentsEnabled={true}
      />
    );

    expect(screen.getByRole("heading", { name: "Application Cancelled" })).toBeInTheDocument();
    expect(screen.queryByText(/Your reservation is confirmed/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Confirmed member details form")).not.toBeInTheDocument();
  });
});
