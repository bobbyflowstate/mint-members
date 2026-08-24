import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftsTable } from "./ShiftsTable";
import type { ShiftRow } from "@/lib/shifts/types";

let observerCallback: IntersectionObserverCallback | undefined;

const rows: ShiftRow[] = [
  { date: "2026-08-29", task: "Water", startTime: "9:00 am", endTime: "12:00 pm", firstName: "Zoe", lastName: "Able" },
  { date: "2026-08-28", task: "Meals", startTime: "10:00 am", endTime: "12:00 pm", firstName: "Alex", lastName: "Zulu" },
  { date: "2026-08-28", task: "Meals", startTime: "10:00 am", endTime: "12:00 pm", firstName: "Jami", lastName: "Grich" },
  { date: "2026-08-28", task: "Water", startTime: "1:00 pm", endTime: "2:00 pm", firstName: "", lastName: "" },
];

describe("ShiftsTable", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    window.print = vi.fn();
    observerCallback = undefined;
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    });
  });

  it("renders a day-based chronological agenda with grouped roles", () => {
    render(<ShiftsTable rows={rows} />);

    expect(screen.getByRole("navigation", { name: "Schedule days" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getByText("9:00 am–12:00 pm")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("filters by task family", () => {
    render(<ShiftsTable rows={rows} />);
    fireEvent.change(screen.getByLabelText("Filter by task"), {
      target: { value: "Meals" },
    });
    expect(screen.getByText("Alex Zulu")).toBeInTheDocument();
    expect(screen.queryByText("Zoe Able")).not.toBeInTheDocument();
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });

  it("searches people and clears all filters", () => {
    render(<ShiftsTable rows={rows} />);
    fireEvent.change(screen.getByLabelText("Find a person"), {
      target: { value: "alex zu" },
    });
    expect(screen.getByText("Alex Zulu")).toBeInTheDocument();
    expect(screen.getByText("Jami Grich")).toBeInTheDocument();
    expect(screen.queryByText("Zoe Able")).not.toBeInTheDocument();
    expect(screen.getByText("Alex Zulu").closest("mark")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Zoe Able")).toBeInTheDocument();
  });

  it("highlights an accented name searched without accents", () => {
    // Own fixture so the shared row counts other tests assert on stay put.
    const accented: ShiftRow[] = [
      { date: "2026-08-28", task: "Meals", startTime: "10:00 am", endTime: "12:00 pm", firstName: "José", lastName: "Dupré" },
      { date: "2026-08-28", task: "Meals", startTime: "10:00 am", endTime: "12:00 pm", firstName: "Alex", lastName: "Zulu" },
    ];
    render(<ShiftsTable rows={accented} />);

    fireEvent.change(screen.getByLabelText("Find a person"), {
      target: { value: "jose dupre" },
    });

    const name = screen.getByText("José Dupré");
    expect(name).toBeInTheDocument();
    // The filter already matched before this fix; the highlight did not.
    expect(name.closest("mark")).toBeInTheDocument();
    // Shiftmates stay visible so you can see who someone is on with, but
    // only the match is highlighted.
    expect(screen.getByText("Alex Zulu").closest("mark")).toBeNull();
  });

  it("highlights an unaccented name searched with accents", () => {
    const plain: ShiftRow[] = [
      { date: "2026-08-28", task: "Meals", startTime: "10:00 am", endTime: "12:00 pm", firstName: "Jose", lastName: "Dupre" },
    ];
    render(<ShiftsTable rows={plain} />);

    fireEvent.change(screen.getByLabelText("Find a person"), {
      target: { value: "José" },
    });

    expect(screen.getByText("Jose Dupre").closest("mark")).toBeInTheDocument();
  });

  it("can show only unassigned shifts", () => {
    render(<ShiftsTable rows={rows} />);
    fireEvent.click(screen.getByLabelText("Unassigned only"));
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    expect(screen.queryByText("Zoe Able")).not.toBeInTheDocument();
  });

  it("uses date buttons as navigation without filtering other days", () => {
    render(<ShiftsTable rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /show.*august 28/i }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByText("Zoe Able")).toBeInTheDocument();
    expect(screen.getByText("Alex Zulu")).toBeInTheDocument();
  });

  it("selects the visible day button while the user scrolls", () => {
    render(<ShiftsTable rows={rows} />);
    const section = document.getElementById("day-2026-08-29");
    expect(section).not.toBeNull();

    act(() => {
      observerCallback?.(
        [{
          isIntersecting: true,
          target: section,
          boundingClientRect: { top: 140 },
        } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(screen.getByRole("button", { name: /show.*august 29/i }))
      .toHaveAttribute("aria-pressed", "true");
  });

  it("shows global occupancy metrics that do not change with filters", () => {
    render(<ShiftsTable rows={rows} />);
    expect(screen.getByText("1", { selector: "[data-metric='unassigned']" })).toBeInTheDocument();
    expect(screen.getByText("75%", { selector: "[data-metric='filled-percent']" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by task"), {
      target: { value: "Meals" },
    });
    expect(screen.getByText("1", { selector: "[data-metric='unassigned']" })).toBeInTheDocument();
    expect(screen.getByText("75%", { selector: "[data-metric='filled-percent']" })).toBeInTheDocument();
  });

  it("prints the filtered week when no day is active", () => {
    render(<ShiftsTable rows={rows} />);
    fireEvent.change(screen.getByLabelText("Filter by task"), {
      target: { value: "Meals" },
    });

    expect(screen.getByTestId("print-summary")).toHaveTextContent("Task: Meals");
    fireEvent.click(screen.getByRole("button", { name: "Print filtered week" }));

    expect(window.print).toHaveBeenCalledOnce();
    expect(screen.getByTestId("print-root")).toHaveAttribute("data-print-scope", "week");
  });

  it("prints only the active day while retaining current filters", () => {
    render(<ShiftsTable rows={rows} />);
    const section = document.getElementById("day-2026-08-29");
    act(() => {
      observerCallback?.(
        [{
          isIntersecting: true,
          target: section,
          boundingClientRect: { top: 140 },
        } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(document.getElementById("day-2026-08-28"))
      .toHaveAttribute("data-print-hidden", "true");
    fireEvent.change(screen.getByLabelText("Find a person"), {
      target: { value: "zoe" },
    });

    expect(screen.getByRole("button", { name: "Print Saturday, August 29" }))
      .toBeInTheDocument();
    expect(screen.getByTestId("print-summary")).toHaveTextContent("Person: zoe");

    fireEvent.click(screen.getByRole("button", { name: "Print Saturday, August 29" }));
    expect(window.print).toHaveBeenCalledOnce();
    expect(screen.getByTestId("print-root")).toHaveAttribute("data-print-scope", "day");
  });

  it("falls back to filtered-week printing when filters remove the active day", () => {
    render(<ShiftsTable rows={rows} />);
    const section = document.getElementById("day-2026-08-29");
    act(() => {
      observerCallback?.(
        [{
          isIntersecting: true,
          target: section,
          boundingClientRect: { top: 140 },
        } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    fireEvent.change(screen.getByLabelText("Filter by task"), {
      target: { value: "Meals" },
    });

    expect(screen.getByRole("button", { name: "Print filtered week" }))
      .toBeInTheDocument();
  });

  it("keeps the print action inside the sticky schedule controls", () => {
    render(<ShiftsTable rows={rows} />);

    expect(
      within(screen.getByTestId("sticky-schedule-controls"))
        .getByRole("button", { name: "Print filtered week" })
    ).toBeInTheDocument();
  });
});
