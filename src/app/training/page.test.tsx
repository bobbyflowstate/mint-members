import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock("convex/react", () => ({
  useQuery,
  Authenticated: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AuthLoading: () => null,
  Unauthenticated: () => null,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { training: { listMine: "training:listMine" } },
}));

vi.mock("@/components/auth", () => ({
  UserButton: () => <button>User menu</button>,
  AuthModal: () => null,
}));

import TrainingPage from "./page";

describe("TrainingPage", () => {
  beforeEach(() => useQuery.mockReturnValue([]));

  it("lists both required modules", () => {
    render(<TrainingPage />);

    expect(screen.getByRole("heading", { name: "Training" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pack right/ })).toHaveAttribute("href", "/training/lnt");
    expect(screen.getByRole("link", { name: /How to be a Dementhian/ })).toHaveAttribute("href", "/training/general");
    expect(screen.getAllByText("Not started")).toHaveLength(2);
  });

  it("recognizes accepted completed versions per module", () => {
    useQuery.mockReturnValue([{ moduleSlug: "lnt", moduleVersion: "2026.1", completedAt: 123 }]);
    render(<TrainingPage />);

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("does not treat progress from an obsolete version as current progress", () => {
    useQuery.mockReturnValue([{ moduleSlug: "lnt", moduleVersion: "2025.1", updatedAt: 123 }]);
    render(<TrainingPage />);

    expect(screen.getAllByText("Not started")).toHaveLength(2);
  });
});
