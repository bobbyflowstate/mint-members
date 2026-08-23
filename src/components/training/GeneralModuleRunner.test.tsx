import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneralModuleRunner } from "./GeneralModuleRunner";
import { createDefaultGeneralProgress } from "@/lib/training/progress";
import type { GeneralProgressState } from "@/lib/training/types";

const baseState: GeneralProgressState = createDefaultGeneralProgress();

const signableState: GeneralProgressState = {
  ...baseState,
  step: 29,
  kind: "first",
  videos: [0, 1],
  bikes: [3, 4, 5],
  law: [0, 1, 2, 3],
  bar: [0, 1, 2, 3],
  mojito: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  cultureQuiz: { queue: [], marks: { 0: true, 1: true, 2: true, 3: true } },
  barQuiz: { queue: [], marks: { 0: true, 1: true, 2: true } },
};

afterEach(() => vi.useRealTimers());

function renderRunner(
  initialState = baseState,
  overrides: {
    onComplete?: (state: GeneralProgressState) => Promise<unknown>;
    onSave?: (state: GeneralProgressState) => Promise<unknown>;
  } = {}
) {
  const onSave = vi.fn(overrides.onSave ?? (() => Promise.resolve()));
  const onComplete = vi.fn(overrides.onComplete ?? (() => Promise.resolve()));
  const onDone = vi.fn();
  render(
    <GeneralModuleRunner
      memberName="Ash Example"
      initialState={initialState}
      onSave={onSave}
      onComplete={onComplete}
      onDone={onDone}
    />
  );
  return { onSave, onComplete, onDone };
}

describe("GeneralModuleRunner", () => {
  it("requires an attendance kind before continuing and uses the signed-in member name", async () => {
    const user = userEvent.setup();
    renderRunner();

    expect(screen.getByRole("heading", { name: "How to be a Dementhian" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Ash Example")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /First year with DeMentha/ }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("warns the member when a background save fails", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 3, kind: "first" }, {
      onSave: () => Promise.reject(new Error("Unknown training module version")),
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Play: Ratchet strap" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /We're not saving your progress right now/
    );
  });

  it("clears the warning once a save succeeds again", async () => {
    const user = userEvent.setup();
    let fail = true;
    renderRunner({ ...baseState, step: 3, kind: "first" }, {
      onSave: () => (fail ? Promise.reject(new Error("offline")) : Promise.resolve()),
    });

    await user.click(screen.getByRole("button", { name: "Play: Ratchet strap" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole("button", { name: "Play: Making a mojito" }));
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("requires both videos to be played", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 3, kind: "first" });

    expect(screen.getByRole("button", { name: "0 of 2" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Play: Ratchet strap" }));
    expect(screen.getByRole("button", { name: "1 of 2" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Play: Making a mojito" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("requires finding all three misplaced bikes", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 6, kind: "first" });

    expect(screen.getByRole("button", { name: "Find all three (0/3)" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Bike 1" }));
    expect(screen.getByText("That one’s fine")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));

    for (const bike of ["Bike 4", "Bike 5", "Bike 6"]) {
      await user.click(screen.getByRole("button", { name: bike }));
      await user.click(screen.getByRole("button", { name: "Close" }));
    }
    expect(screen.getByText("All three.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("requeues a critical quiz question until it is answered correctly", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 16, kind: "first", cultureQuiz: { queue: [1], marks: {} } });

    await user.click(screen.getByRole("button", { name: /Captain and they sort it out/ }));
    expect(screen.getByText("Not that one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /comes back/ }));
    await user.click(screen.getByRole("button", { name: "You find your own replacement" }));
    expect(screen.getByText("Right")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Good.")).toBeInTheDocument();
  });

  it("lets a non-critical quiz question pass with a wrong answer", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 16, kind: "first", cultureQuiz: { queue: [2], marks: {} } });

    await user.click(screen.getByRole("button", { name: "8–10 hours" }));
    expect(screen.getByText("Not that one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Good.")).toBeInTheDocument();
  });

  it("shows completion only after the pledge has been persisted", async () => {
    vi.useFakeTimers();
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    const { onComplete } = renderRunner(signableState, { onComplete: () => completion });

    const pledge = screen.getByRole("button", { name: "Hold to sign" });
    fireEvent.pointerDown(pledge);
    act(() => vi.advanceTimersByTime(900));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ step: 30 }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "You're in." })).not.toBeInTheDocument();

    await act(async () => resolveCompletion());
    expect(screen.getByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("shows a retry action when completion persistence fails", async () => {
    vi.useFakeTimers();
    const complete = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    renderRunner(signableState, { onComplete: complete });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Hold to sign" }));
    await act(async () => vi.advanceTimersByTime(900));

    expect(screen.getByRole("alert")).toHaveTextContent("couldn't save");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry completion" })));
    expect(screen.getByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("provides a Done button that returns to the training list", async () => {
    const user = userEvent.setup();
    const { onDone } = renderRunner({ ...signableState, step: 30 });

    expect(screen.getByText("First Year")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledOnce();
  });
});
