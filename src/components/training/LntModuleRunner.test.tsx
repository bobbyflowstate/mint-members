import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LntModuleRunner } from "./LntModuleRunner";
import { lntModule } from "@/lib/training/lnt";
import type { TrainingProgressState } from "@/lib/training/types";

const baseState: TrainingProgressState = {
  step: 0,
  packed: [],
  streamsRead: [],
  quizQueue: [0, 1, 2, 3, 4, 5, 6, 7],
  quizMarks: {},
};

afterEach(() => vi.useRealTimers());

function renderRunner(
  initialState = baseState,
  overrides: { onComplete?: (state: TrainingProgressState) => Promise<unknown> } = {}
) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onComplete = vi.fn(overrides.onComplete ?? (() => Promise.resolve()));
  const onDone = vi.fn();
  render(
    <LntModuleRunner
      memberName="Ash Example"
      initialState={initialState}
      onSave={onSave}
      onComplete={onComplete}
      onDone={onDone}
    />
  );
  return { onSave, onComplete, onDone };
}

describe("LntModuleRunner", () => {
  it("requires a role before continuing and uses the signed-in member name", async () => {
    const user = userEvent.setup();
    renderRunner();

    expect(screen.getByRole("heading", { name: "Leave No Trace" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Ash Example")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Just camping/ }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("requires every packing commitment", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 4, role: "camp" });

    const continueButton = screen.getByRole("button", { name: "0 of 6" });
    expect(continueButton).toBeDisabled();
    for (const item of screen.getAllByRole("checkbox")) await user.click(item);
    expect(screen.getByRole("button", { name: "Packed" })).toBeEnabled();
  });

  it("toggles a packing commitment when its visible label is clicked", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 4, role: "camp" });

    await user.click(screen.getByText("Strip the packaging"));

    expect(screen.getByRole("checkbox", { name: "Strip the packaging" })).toBeChecked();
  });

  it("requires opening every stream card before practising", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 5, role: "camp" });

    expect(screen.getByText("0 of 12 read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "0 of 12" })).toBeDisabled();

    for (const stream of lntModule.content.streams) {
      await user.click(screen.getByRole("button", { name: stream.name }));
      await user.click(screen.getByRole("button", { name: "Close" }));
    }

    expect(screen.getByText("12 of 12 read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Practise" })).toBeEnabled();
  });

  it("requeues a wrong quiz answer until it is answered correctly", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 6, role: "camp", quizQueue: [0] });

    await user.click(screen.getByRole("button", { name: /Trash/ }));
    expect(screen.getByText("Not that one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /comes back/ }));
    await user.click(screen.getByRole("button", { name: /Kitchen compost/ }));
    expect(screen.getByText("Yep")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Nice.")).toBeInTheDocument();
  });

  it("skips shift instructions for campers", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 9, role: "camp", quizQueue: [] });

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Sign it" })).toBeInTheDocument();
  });

  it("can navigate backward immediately after restoring saved progress", async () => {
    const user = userEvent.setup();
    renderRunner({ ...baseState, step: 4, role: "camp" });

    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toBeEnabled();
    await user.click(back);

    expect(screen.getByRole("heading", { name: "Three sizes of mistake" })).toBeInTheDocument();
  });

  it("shows completion only after the pledge has been persisted", async () => {
    vi.useFakeTimers();
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => { resolveCompletion = resolve; });
    const { onComplete } = renderRunner(
      { ...baseState, step: 12, role: "lead", quizQueue: [] },
      { onComplete: () => completion }
    );

    const pledge = screen.getByRole("button", { name: "Hold to sign" });
    fireEvent.pointerDown(pledge);
    act(() => vi.advanceTimersByTime(900));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ step: 13 }));
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
    renderRunner(
      { ...baseState, step: 12, role: "camp", packed: [0, 1, 2, 3, 4, 5], quizQueue: [] },
      { onComplete: complete }
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Hold to sign" }));
    await act(async () => vi.advanceTimersByTime(900));

    expect(screen.getByRole("alert")).toHaveTextContent("couldn't save");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry completion" })));
    expect(screen.getByRole("heading", { name: "You're in." })).toBeInTheDocument();
  });

  it("provides a Done button that returns to the training list", async () => {
    const user = userEvent.setup();
    const { onDone } = renderRunner({ ...baseState, step: 13, role: "camp", quizQueue: [] });

    await user.click(screen.getByRole("button", { name: "Done" }));

    expect(onDone).toHaveBeenCalledOnce();
  });
});
