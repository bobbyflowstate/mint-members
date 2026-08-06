import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery }));
vi.mock("../../../convex/_generated/api", () => ({ api: { training: { listMine: "training:listMine" } } }));

import { TrainingDashboardCard } from "./TrainingDashboardCard";

describe("TrainingDashboardCard", () => {
  it("prompts members to complete required training", () => {
    useQuery.mockReturnValue([]);
    render(<TrainingDashboardCard />);

    expect(screen.getByRole("link", { name: /Start training/ })).toHaveAttribute("href", "/training");
    expect(screen.getByText("Required training")).toBeInTheDocument();
  });

  it("recognizes completion of an accepted version", () => {
    useQuery.mockReturnValue([{ moduleSlug: "lnt", moduleVersion: "2026.1", completedAt: 100 }]);
    render(<TrainingDashboardCard />);

    expect(screen.getByText("Training complete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review training/ })).toBeInTheDocument();
  });
});
