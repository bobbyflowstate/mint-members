import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery }));
vi.mock("../../../convex/_generated/api", () => ({ api: { training: { listMine: "training:listMine" } } }));

import { TrainingDashboardCard } from "./TrainingDashboardCard";

describe("TrainingDashboardCard", () => {
  it("names every outstanding module when nothing has been started", () => {
    useQuery.mockReturnValue([]);
    render(<TrainingDashboardCard />);

    expect(screen.getByText("Required training")).toBeInTheDocument();
    expect(screen.getByText("You still need to do Leave No Trace and How to be a Dementhian.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /All training/ })).toHaveAttribute("href", "/training");
    expect(screen.getAllByText("Not started")).toHaveLength(2);
  });

  it("names only the module still outstanding", () => {
    useQuery.mockReturnValue([{ moduleSlug: "lnt", moduleVersion: "2026.1", completedAt: 100 }]);
    render(<TrainingDashboardCard />);

    expect(screen.getByText("You still need to do How to be a Dementhian.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How to be a Dementhian/ }))
      .toHaveAttribute("href", "/training/general");
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("asks a member to finish a module they have already opened", () => {
    useQuery.mockReturnValue([
      { moduleSlug: "lnt", moduleVersion: "2026.2", completedAt: 100 },
      { moduleSlug: "general", moduleVersion: "2026.2" },
    ]);
    render(<TrainingDashboardCard />);

    expect(screen.getByText("Finish How to be a Dementhian.")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("recognizes completion of every required module", () => {
    useQuery.mockReturnValue([
      { moduleSlug: "lnt", moduleVersion: "2026.1", completedAt: 100 },
      { moduleSlug: "general", moduleVersion: "2026.2", completedAt: 100 },
    ]);
    render(<TrainingDashboardCard />);

    expect(screen.getByText("Training complete")).toBeInTheDocument();
    expect(screen.getByText("You're trained up.")).toBeInTheDocument();
    expect(screen.getAllByText("Complete")).toHaveLength(2);
  });
});
