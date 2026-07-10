import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentPageContent } from "./page";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    applications: {
      getById: "applications:getById",
      getCapacityStatus: "applications:getCapacityStatus",
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
  PaymentCTA: () => <div>Payment CTA</div>,
}));

const content = {
  campName: "DeMentha",
  reservationFeeFormatted: "$350",
};

describe("PaymentPageContent", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("shows cancelled state instead of already confirmed for cancelled confirmed applications", () => {
    mockUseQuery.mockImplementation((query: string) => {
      if (query === "applications:getById") {
        return {
          _id: "app_cancelled",
          firstName: "Casey",
          lastName: "Cancelled",
          email: "casey@example.com",
          status: "confirmed",
          paymentAllowed: true,
          cancelled: true,
        };
      }

      if (query === "applications:getCapacityStatus") {
        return { isFull: false, maxMembers: 100 };
      }

      return undefined;
    });

    render(
      <PaymentPageContent
        applicationId={"app_cancelled" as Parameters<typeof PaymentPageContent>[0]["applicationId"]}
        content={content as Parameters<typeof PaymentPageContent>[0]["content"]}
        paymentsEnabled={true}
      />
    );

    expect(screen.getByRole("heading", { name: "Application Cancelled" })).toBeInTheDocument();
    expect(screen.queryByText("Already Confirmed!")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment CTA")).not.toBeInTheDocument();
  });
});
