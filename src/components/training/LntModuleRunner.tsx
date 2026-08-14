"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { lntModule } from "@/lib/training/lnt";
import { withIndexMarked } from "@/lib/training/progress";
import type { TrainingProgressState, TrainingRole, WasteStreamId } from "@/lib/training/types";

const TOTAL_STEPS = 13;
const QUIZ_CHOICES: WasteStreamId[] = ["KC", "BC", "AL", "MR", "PC", "GL", "TR", "GW"];

type Props = {
  memberName: string;
  initialState: TrainingProgressState;
  completedAt?: number;
  onSave: (state: TrainingProgressState) => Promise<unknown>;
  onComplete: (state: TrainingProgressState) => Promise<unknown>;
  onDone: () => void;
};

function StreamBadge({ id, compact = false }: { id: WasteStreamId; compact?: boolean }) {
  const stream = lntModule.content.streams.find((item) => item.id === id)!;
  return (
    <span
      className={`${compact ? "h-9 w-9 text-[11px]" : "h-12 w-12 text-xs"} inline-flex shrink-0 items-center justify-center rounded-xl font-black text-slate-950`}
      style={{ backgroundColor: stream.color }}
      aria-hidden="true"
    >
      {id}
    </span>
  );
}

function Tips({ items }: { items: Array<{ icon: string; text: React.ReactNode }> }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
          <span className="text-xl" aria-hidden="true">{item.icon}</span>
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

function previousStep(state: TrainingProgressState): number | undefined {
  if (state.step <= 0 || state.step >= 13) return undefined;
  if (state.step === 12) {
    return state.role === "lead" ? 11 : state.role === "crew" ? 10 : 9;
  }
  return state.step - 1;
}

export function LntModuleRunner({ memberName, initialState, completedAt, onSave, onComplete, onDone }: Props) {
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState<number[]>([]);
  const [selectedStream, setSelectedStream] = useState<WasteStreamId>();
  const [selectedPackReason, setSelectedPackReason] = useState<number>();
  const [answer, setAnswer] = useState<{ picked: WasteStreamId; correct: boolean }>();
  const [completionStatus, setCompletionStatus] = useState<"idle" | "saving" | "error">("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  function persist(next: TrainingProgressState) {
    setState(next);
    void onSave(next);
  }

  function goTo(step: number) {
    setHistory((current) => [...current, state.step]);
    setAnswer(undefined);
    setSelectedStream(undefined);
    persist({ ...state, step });
  }

  function goBack() {
    const previous = history.at(-1) ?? previousStep(state);
    if (previous === undefined) return;
    if (history.length > 0) setHistory((current) => current.slice(0, -1));
    setAnswer(undefined);
    persist({ ...state, step: previous });
  }

  function chooseRole(role: TrainingRole) {
    persist({ ...state, role });
  }

  function togglePack(index: number) {
    const packed = state.packed.includes(index)
      ? state.packed.filter((item) => item !== index)
      : [...state.packed, index];
    persist({ ...state, packed });
  }

  function openStream(index: number) {
    setSelectedStream(lntModule.content.streams[index].id);
    const streamsRead = withIndexMarked(state.streamsRead, index);
    // Local only: the next navigation persist (goTo/goBack) saves it, instead of one mutation per card.
    if (streamsRead !== state.streamsRead) setState({ ...state, streamsRead });
  }

  function chooseQuizAnswer(picked: WasteStreamId) {
    const index = state.quizQueue[0];
    const correct = lntModule.content.quizItems[index].answer === picked;
    setAnswer({ picked, correct });
    persist({
      ...state,
      quizMarks: { ...state.quizMarks, [index]: correct },
    });
  }

  function continueQuiz() {
    if (!answer) return;
    const [current, ...rest] = state.quizQueue;
    persist({
      ...state,
      quizQueue: answer.correct ? rest : [...rest, current],
    });
    setAnswer(undefined);
  }

  async function finishCompletion() {
    const next = { ...state, step: 13 };
    setCompletionStatus("saving");
    try {
      await onComplete(next);
      setState(next);
      setCompletionStatus("idle");
    } catch {
      setCompletionStatus("error");
    }
  }

  function startPledge() {
    if (holdTimer.current) return;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      void finishCompletion();
    }, 800);
  }

  function cancelPledge() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  const card = "rounded-2xl border border-white/10 bg-white/5 p-4";
  let content: React.ReactNode;
  let action: React.ReactNode = null;

  if (state.step === 0) {
    content = <div className="flex min-h-[520px] flex-col justify-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl">🌿</div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">DeMentha · Module 1</p>
      <h1 aria-label="Leave No Trace" className="mt-3 text-5xl font-bold leading-none tracking-tight text-white">Leave<br />No Trace</h1>
      <p className="mt-5 text-lg leading-7 text-slate-300">Ten minutes, once. Pack right, sort right, and don&apos;t leave the camp eating your mistake.</p>
      <p className="mt-5 text-sm text-slate-500">Required before you camp with us in 2026.</p>
    </div>;
    action = <button className="training-cta" onClick={() => goTo(1)}>Start</button>;
  } else if (state.step === 1) {
    content = <>
      <h2 className="text-3xl font-bold text-white">Who&apos;s this for?</h2>
      <p className="mt-3 text-slate-400">Training completion will be recorded for <strong className="text-white">{memberName}</strong>.</p>
      <p className="mt-7 text-slate-300">How are you coming this year?</p>
      <div className="mt-3 space-y-3">
        {([
          ["camp", "Just camping", "The short version—about 10 minutes"],
          ["crew", "I’m on an LNT shift", "Adds your shift checklist"],
          ["lead", "I’m an LNT Lead", "Adds the shift and lead responsibilities"],
        ] as const).map(([role, label, detail]) => <button key={role} onClick={() => chooseRole(role)} aria-pressed={state.role === role} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left aria-pressed:border-emerald-400 aria-pressed:bg-emerald-400/10">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-white/20 text-xs">{state.role === role ? "✓" : ""}</span>
          <span><strong className="block text-white">{label}</strong><small className="text-slate-500">{detail}</small></span>
        </button>)}
      </div>
    </>;
    action = <button className="training-cta" disabled={!state.role} onClick={() => goTo(2)}>Continue</button>;
  } else if (state.step === 2) {
    content = <div className="flex min-h-[480px] flex-col justify-center">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Why this matters</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">There is no <span className="text-emerald-300">“someone.”</span></h2>
      <p className="mt-5 text-2xl leading-9 text-slate-300">There is the camp, and we are all responsible for leaving no trace.</p>
      <p className="mt-7 text-sm leading-6 text-slate-500">The experience only works because the function does.</p>
    </div>;
    action = <button className="training-cta" onClick={() => goTo(3)}>Okay</button>;
  } else if (state.step === 3) {
    const stakes = [
      ["1", "You pay for it", "Your unlabelled cup ends up in lost and found."],
      ["2", "The camp pays for it", "One paper towel can cause a compost batch to be rejected."],
      ["3", "Somebody gets hurt", "Loose broken glass or irresponsible disposal has real consequences."],
    ];
    content = <><h2 className="text-3xl font-bold text-white">Three sizes of mistake</h2><p className="mt-3 text-slate-400">Everything after this is designed to prevent all three.</p><div className="mt-6 space-y-3">{stakes.map(([n, title, body]) => <div className={card} key={n}><div className="flex gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-600 font-bold">{n}</span><div><strong className="text-white">{title}</strong><p className="mt-1 text-sm leading-6 text-slate-400">{body}</p></div></div></div>)}</div></>;
    action = <button className="training-cta" onClick={() => goTo(4)}>Got it</button>;
  } else if (state.step === 4) {
    content = <><h2 className="text-3xl font-bold text-white">Pack it right once</h2><p className="mt-3 text-slate-400">Check all six commitments. Use “Why?” for the reason.</p><div className="mt-6 space-y-3">{lntModule.content.packItems.map((item, index) => { const inputId = `lnt-pack-${index}`; return <div className={card} key={item.title}><div className="flex items-start gap-3"><input id={inputId} className="mt-1 h-6 w-6 accent-emerald-400" type="checkbox" checked={state.packed.includes(index)} onChange={() => togglePack(index)} aria-label={item.title} /><label htmlFor={inputId} className="flex-1 cursor-pointer"><strong className="block text-white">{item.title}</strong><span className="text-sm text-slate-500">{item.summary}</span></label><button className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400" onClick={() => setSelectedPackReason(index)}>Why?</button></div></div>; })}</div></>;
    action = <button className="training-cta" disabled={state.packed.length !== 6} onClick={() => goTo(5)}>{state.packed.length === 6 ? "Packed" : `${state.packed.length} of 6`}</button>;
  } else if (state.step === 5) {
    const streamCount = lntModule.content.streams.length;
    const readCount = state.streamsRead.length;
    content = <><h2 className="text-3xl font-bold text-white">Twelve places anything can go</h2><p className="mt-3 text-slate-400">Open all twelve. Each one takes a few seconds, and every one is a decision you&apos;ll have to make out there.</p><div className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-300"><span>{readCount} of {streamCount} read</span><ProgressBar value={readCount} max={streamCount} className="h-1 flex-1" /></div><div className="mt-4 grid grid-cols-3 gap-2">{lntModule.content.streams.map((stream, index) => { const read = state.streamsRead.includes(index); return <button key={stream.id} onClick={() => openStream(index)} className={`relative flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center ${read ? "border-emerald-400/45 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>{read && <span className="absolute right-2 top-1.5 text-[11px] font-black text-emerald-300" aria-hidden="true">✓</span>}<StreamBadge id={stream.id} compact /><span className="text-[11px] leading-tight text-slate-300">{stream.name}</span></button>; })}</div></>;
    action = <button className="training-cta" disabled={readCount !== streamCount} onClick={() => goTo(6)}>{readCount === streamCount ? "Practise" : `${readCount} of ${streamCount}`}</button>;
  } else if (state.step === 6) {
    if (state.quizQueue.length === 0) {
      content = <div className="flex min-h-[480px] flex-col justify-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Eight of eight</p><h2 className="mt-4 text-5xl font-bold text-white">Nice.</h2><p className="mt-5 text-lg leading-7 text-slate-300">Anything you got wrong came back until you got it right—which is the point.</p></div>;
      action = <button className="training-cta" onClick={() => goTo(7)}>Next</button>;
    } else {
      const quiz = lntModule.content.quizItems[state.quizQueue[0]];
      content = <><div className="mb-5 flex gap-2">{lntModule.content.quizItems.map((_, index) => <span key={index} className={`h-2 w-2 rounded-full ${state.quizMarks[index] === true ? "bg-emerald-400" : state.quizMarks[index] === false ? "bg-red-400" : "bg-white/15"}`} />)}</div><div className={`${card} py-7 text-center`}><div className="text-5xl">{quiz.icon}</div><h2 className="mt-3 text-2xl font-bold text-white">{quiz.name}</h2><p className="mt-2 text-sm text-slate-500">{quiz.scenario}</p></div>{answer ? <div className={`mt-4 rounded-2xl border p-4 ${answer.correct ? "border-emerald-400/40 bg-emerald-400/10" : "border-red-400/40 bg-red-400/10"}`}><h3 className="text-xl font-bold text-white">{answer.correct ? "Yep" : "Not that one"}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{quiz.explanation}</p><p className="mt-2 text-xs text-slate-500">{quiz.source}</p></div> : <div className="mt-4 grid grid-cols-2 gap-2">{QUIZ_CHOICES.map((id) => { const stream = lntModule.content.streams.find((item) => item.id === id)!; return <button key={id} onClick={() => chooseQuizAnswer(id)} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left"><StreamBadge id={id} compact /><span className="text-[13px] font-semibold leading-tight text-slate-200">{stream.name}</span></button>; })}</div>}</>;
      action = answer ? <button className="training-cta" onClick={continueQuiz}>{answer.correct ? "Next" : "Got it—this one comes back"}</button> : null;
    }
  } else if (state.step === 7) {
    content = <><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">DeMentha rule</span><h2 className="mt-5 text-3xl font-bold text-white">Bar compost never touches kitchen compost</h2><div className="mt-7 grid grid-cols-2 gap-3 text-center"><div className={card}><StreamBadge id="KC" /><strong className="mt-3 block text-white">Kitchen</strong><p className="mt-1 text-xs text-slate-500">Food scraps. Mostly dry.</p></div><div className={card}><StreamBadge id="BC" /><strong className="mt-3 block text-white">Bar</strong><p className="mt-1 text-xs text-slate-500">Mint and lime. Wet.</p></div></div><p className="mt-6 leading-7 text-slate-300">Mixing them creates sludge that cannot dry and may send the whole batch to landfill. Two streams, always.</p></>;
    action = <button className="training-cta" onClick={() => goTo(8)}>Understood</button>;
  } else if (state.step === 8) {
    content = <><div className="text-center"><strong className="text-8xl font-black text-white">4</strong><p className="mt-2 text-lg text-slate-300">gallons of gray water per person.<br /><strong className="text-white">For the entire week.</strong></p></div><p className="my-6 text-center text-slate-400">One 250-gallon tank for the whole camp. That&apos;s a ceiling, not an allowance.</p><Tips items={[{icon:"🍽",text:<><strong>Finish your drink and food.</strong> Reduce gray water and compost.</>},{icon:"🧴",text:<><strong>Use a spray bottle, not a running tap.</strong></>},{icon:"🚿",text:<><strong>Take two or three showers, military style.</strong> Wet, soap off, rinse, out.</>},{icon:"🪣",text:<><strong>Nothing solid in the bucket.</strong> Strain first—particulate to compost, liquid to the tank.</>}]} /></>;
    action = <button className="training-cta" onClick={() => goTo(9)}>Next</button>;
  } else if (state.step === 9) {
    content = <><h2 className="text-3xl font-bold text-white">It all leaves with you</h2><p className="mt-3 text-slate-400">Strike is where a good week gets undone.</p><div className="mt-6"><Tips items={[{icon:"📦",text:<><strong>Stage labelled bins by the truck before leaving.</strong></>},{icon:"🍾",text:<><strong>Glass you brought goes home in your vehicle.</strong></>},{icon:"🚫",text:<><strong>Use authorised disposal only.</strong> Never a rest stop.</>},{icon:"🧊",text:<><strong>Wet cooler food never enters kitchen compost.</strong></>}]} /></div></>;
    action = <button className="training-cta" onClick={() => goTo(state.role === "camp" ? 12 : 10)}>Next</button>;
  } else if (state.step === 10) {
    content = <><h2 className="text-3xl font-bold text-white">You&apos;re on a shift</h2><p className="mt-3 text-slate-400">Follow the printed shift card and leave the station reset for the next crew.</p><div className="mt-6"><Tips items={[{icon:"🌅",text:<><strong>Kitchen AM:</strong> sweep, sort, dry compost, handle gray water and drop-offs.</>},{icon:"🍳",text:<><strong>Kitchen PM:</strong> reset the kitchen before dinner.</>},{icon:"🌃",text:<><strong>Bar sweep:</strong> MOOP, trash, and separate bar compost after close.</>},{icon:"💧",text:<><strong>Fresh water below 50% or gray water above 75%?</strong> Tell the Water Captain.</>}]} /></div></>;
    action = <button className="training-cta" onClick={() => goTo(state.role === "lead" ? 11 : 12)}>Next</button>;
  } else if (state.step === 11) {
    content = <><h2 className="text-3xl font-bold text-white">What you own</h2><p className="mt-3 text-slate-400">As lead, you own the guide being followed—not only attendance.</p><div className="mt-6"><Tips items={[{icon:"🍋",text:<><strong>Personally verify compost separation.</strong></>},{icon:"💧",text:<><strong>Ensure gray water is strained and capacity is safe.</strong></>},{icon:"🚌",text:<><strong>Stock Burner Bus boxes and brief departing riders.</strong></>},{icon:"🔎",text:<><strong>Check and consolidate both lost-and-found areas.</strong></>}]} /></div><div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">Compost drop-off logistics can change. Confirm the current location, hours, moisture standard, and who owns the drop-off run with Ops before playa.</div></>;
    action = <button className="training-cta" onClick={() => goTo(12)}>Next</button>;
  } else if (state.step === 12) {
    content = <><h2 className="text-3xl font-bold text-white">Sign it</h2><p className="mt-3 text-slate-400">This makes the module a commitment, not a page you scrolled.</p><div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5 text-lg leading-8 text-white"><p>I&apos;ve read this, and I&apos;ll follow it.</p><p className="mt-4">If I&apos;m unsure where something goes, <strong>I&apos;ll ask before I guess</strong>.</p><p className="mt-5 text-sm text-slate-400">— {memberName}, {new Date().toLocaleDateString()}</p></div><p className="mt-4 text-sm text-slate-500">Press and hold the button to sign.</p>{completionStatus === "error" && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">We couldn&apos;t save your completion. Check your connection and try again.</p>}</>;
    action = completionStatus === "saving"
      ? <button className="training-cta" disabled>Saving…</button>
      : completionStatus === "error"
        ? <button className="training-cta" onClick={() => void finishCompletion()}>Retry completion</button>
        : <button className="training-cta select-none" onPointerDown={startPledge} onPointerUp={cancelPledge} onPointerLeave={cancelPledge} onPointerCancel={cancelPledge}>Hold to sign</button>;
  } else {
    const roleLabel = state.role === "lead" ? "LNT Lead" : state.role === "crew" ? "LNT Shift Crew" : "Camp Member";
    content = <><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Complete</p><h2 className="mt-3 text-4xl font-bold text-white">You&apos;re in.</h2><div className="mt-6 rounded-2xl bg-emerald-300 p-6 text-emerald-950"><div className="flex justify-between text-xs font-black uppercase tracking-widest"><span>DeMentha · LNT 2026</span><span>🌿</span></div><p className="mt-8 text-2xl font-black">{memberName}</p><p className="font-semibold opacity-75">{roleLabel}</p><div className="mt-8 flex justify-between text-xs font-bold"><span>3:00 & ARARA</span><span>{completedAt ? new Date(completedAt).toLocaleDateString() : "Completed today"}</span></div></div><Tips items={[{icon:"✅",text:<><strong>Completion saved.</strong> This exact module version is on file.</>},{icon:"📱",text:<><strong>Review anytime.</strong> Return here before playa for a refresher.</>}]} /></>;
    action = <button className="training-cta" onClick={onDone}>Done</button>;
  }

  const stream = selectedStream ? lntModule.content.streams.find((item) => item.id === selectedStream) : undefined;
  const packReason = selectedPackReason !== undefined ? lntModule.content.packItems[selectedPackReason] : undefined;
  const canGoBack = history.length > 0 || previousStep(state) !== undefined;

  return <div className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#121310] shadow-2xl">
    <div className="flex min-h-[720px] flex-col">
      <header className="relative flex h-14 items-center px-4">
        <button onClick={goBack} disabled={!canGoBack} aria-label="Back" className="h-10 w-10 text-2xl text-emerald-300 disabled:invisible">‹</button>
        <ProgressBar value={state.step} max={TOTAL_STEPS} className="absolute inset-x-5 bottom-0 h-1" />
      </header>
      <section className="flex-1 overflow-y-auto px-6 pb-8 pt-5">{content}</section>
      {action && <footer className="sticky bottom-0 bg-gradient-to-t from-[#121310] via-[#121310] to-transparent px-6 pb-6 pt-5">{action}</footer>}
    </div>
    {(stream || packReason) && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => { setSelectedStream(undefined); setSelectedPackReason(undefined); }}><div role="dialog" aria-modal="true" aria-label={stream?.name ?? packReason?.title} className="w-full max-w-md rounded-t-3xl border border-white/10 bg-slate-900 p-6 sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>{stream ? <><div className="flex items-center gap-3"><StreamBadge id={stream.id} /><div><h3 className="text-xl font-bold text-white">{stream.name}</h3><p className="text-xs font-bold text-slate-500">{stream.id}</p></div></div><h4 className="mt-6 text-xs font-bold uppercase tracking-widest text-emerald-300">Goes in</h4><p className="mt-2 text-sm leading-6 text-slate-300">{stream.goesIn}</p><h4 className="mt-5 text-xs font-bold uppercase tracking-widest text-red-300">Never</h4><p className="mt-2 text-sm leading-6 text-slate-300">{stream.never}</p></> : <><h3 className="text-xl font-bold text-white">{packReason?.title}</h3><p className="mt-4 leading-7 text-slate-300">{packReason?.reason}</p></>}<button className="mt-6 w-full rounded-xl bg-white/10 py-3 font-semibold text-white" onClick={() => { setSelectedStream(undefined); setSelectedPackReason(undefined); }}>Close</button></div></div>}
  </div>;
}
