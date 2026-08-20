"use client";

import { useEffect, useRef, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { generalModule } from "@/lib/training/general";
import { GENERAL_FINAL_STEP, withIndexMarked } from "@/lib/training/progress";
import type { GeneralKind, GeneralProgressState } from "@/lib/training/types";

const TOTAL_STEPS = GENERAL_FINAL_STEP;
const content = generalModule.content;

type QuizKey = "cultureQuiz" | "barQuiz";

type Props = {
  memberName: string;
  initialState: GeneralProgressState;
  completedAt?: number;
  onSave: (state: GeneralProgressState) => Promise<unknown>;
  onComplete: (state: GeneralProgressState) => Promise<unknown>;
  onDone: () => void;
};

type SheetContent = {
  badge?: { label: string; tone: "camp" | "external" | "unsourced" };
  title: string;
  body: React.ReactNode;
};

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

function Hero({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[480px] flex-col justify-center">{children}</div>;
}

function SheetBadge({ badge }: { badge: NonNullable<SheetContent["badge"]> }) {
  const tone = badge.tone === "external"
    ? "bg-sky-400/10 text-sky-300"
    : badge.tone === "unsourced"
      ? "border border-dashed border-orange-400/70 text-orange-300"
      : "bg-amber-400/10 text-amber-300";
  return <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${tone}`}>{badge.label}</span>;
}

function previousStep(state: GeneralProgressState): number | undefined {
  if (state.step <= 0 || state.step >= TOTAL_STEPS) return undefined;
  return state.step - 1;
}

export function GeneralModuleRunner({ memberName, initialState, completedAt, onSave, onComplete, onDone }: Props) {
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState<number[]>([]);
  const [sheet, setSheet] = useState<SheetContent>();
  const [playing, setPlaying] = useState<number[]>([]);
  const [answer, setAnswer] = useState<{ picked: number; correct: boolean }>();
  const [completionStatus, setCompletionStatus] = useState<"idle" | "saving" | "error">("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  function persist(next: GeneralProgressState) {
    setState(next);
    void onSave(next);
  }

  function goTo(step: number) {
    setHistory((current) => [...current, state.step]);
    setAnswer(undefined);
    setSheet(undefined);
    persist({ ...state, step });
  }

  function goBack() {
    const previous = history.at(-1) ?? previousStep(state);
    if (previous === undefined) return;
    if (history.length > 0) setHistory((current) => current.slice(0, -1));
    setAnswer(undefined);
    setSheet(undefined);
    persist({ ...state, step: previous });
  }

  function markSeen(key: "videos" | "law" | "bar", index: number) {
    const marked = withIndexMarked(state[key], index);
    if (marked !== state[key]) persist({ ...state, [key]: marked });
  }

  function tapBike(index: number) {
    const bike = content.bikes[index];
    const marked = withIndexMarked(state.bikes, index);
    if (marked !== state.bikes) persist({ ...state, bikes: marked });
    setSheet({
      title: bike.bad ? "Yes — that one’s a problem" : "That one’s fine",
      body: <p className="mt-4 leading-7 text-slate-300">{bike.why}</p>,
    });
  }

  function chooseQuizAnswer(key: QuizKey, picked: number) {
    const bank = content[key];
    const index = state[key].queue[0];
    const correct = bank[index].answer === picked;
    setAnswer({ picked, correct });
    persist({ ...state, [key]: { ...state[key], marks: { ...state[key].marks, [index]: correct } } });
  }

  function continueQuiz(key: QuizKey) {
    if (!answer) return;
    const bank = content[key];
    const [current, ...rest] = state[key].queue;
    const mustRetry = !answer.correct && bank[current].critical;
    const marks = { ...state[key].marks };
    if (mustRetry) delete marks[current];
    persist({ ...state, [key]: { queue: mustRetry ? [...rest, current] : rest, marks } });
    setAnswer(undefined);
  }

  async function finishCompletion() {
    const next = { ...state, step: TOTAL_STEPS };
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

  function seenList(
    key: "law" | "bar",
    items: ReadonlyArray<{ icon: string; title: string }>,
    subtitle: (index: number) => string,
    open: (index: number) => void
  ) {
    return <div className="space-y-2.5">
      {items.map((item, index) => {
        const seen = state[key].includes(index);
        return <button key={item.title} onClick={() => { markSeen(key, index); open(index); }} className={`flex w-full items-center gap-3 rounded-2xl border bg-white/5 p-4 text-left ${seen ? "border-emerald-400/40" : "border-white/10"}`}>
          <span className="w-7 shrink-0 text-center text-xl" aria-hidden="true">{item.icon}</span>
          <span className="flex-1"><strong className="block text-white">{item.title}</strong><small className="text-slate-500">{subtitle(index)}</small></span>
          <span className={seen ? "text-emerald-300" : "text-slate-500"} aria-hidden="true">{seen ? "✓" : "›"}</span>
        </button>;
      })}
    </div>;
  }

  function quizScreen(key: QuizKey, blurb: string, nextStep: number) {
    const bank = content[key];
    const quiz = state[key];
    if (quiz.queue.length === 0) {
      return {
        content: <Hero>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">{bank.length} of {bank.length}</p>
          <h2 className="mt-4 text-5xl font-bold text-white">Good.</h2>
          <p className="mt-5 text-lg leading-7 text-slate-300">Anything you got wrong came back around until you got it right. That’s on purpose.</p>
        </Hero>,
        action: <button className="training-cta" onClick={() => goTo(nextStep)}>Continue</button>,
      };
    }
    const index = quiz.queue[0];
    const question = bank[index];
    const mustRetry = answer && !answer.correct && question.critical;
    return {
      content: <>
        <div className="mb-5 flex gap-2">{bank.map((_, dot) => <span key={dot} className={`h-2 w-2 rounded-full ${quiz.marks[dot] === true ? "bg-emerald-400" : quiz.marks[dot] === false ? "bg-red-400" : "bg-white/15"}`} />)}</div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Question {bank.length - quiz.queue.length + 1} of {bank.length}</span>
          {question.critical && <span className="rounded-md border border-red-400/70 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-red-300">Must get right</span>}
        </div>
        <p className="mb-4 mt-2 text-xs text-slate-500">{blurb}</p>
        <p className="text-xl font-semibold leading-7 text-white">{question.question}</p>
        {answer
          ? <div className={`mt-4 rounded-2xl border p-4 ${answer.correct ? "border-emerald-400/40 bg-emerald-400/10" : "border-red-400/40 bg-red-400/10"}`}>
              <h3 className="text-xl font-bold text-white">{answer.correct ? "Right" : "Not that one"}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>
              <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">{question.source}</p>
            </div>
          : <div className="mt-5 space-y-2.5">{question.options.map((option, optionIndex) => <button key={option} onClick={() => chooseQuizAnswer(key, optionIndex)} className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left font-semibold text-white">{option}</button>)}</div>}
      </>,
      action: answer ? <button className="training-cta" onClick={() => continueQuiz(key)}>{mustRetry ? "Got it — this one comes back" : "Next"}</button> : null,
    };
  }

  const card = "rounded-2xl border border-white/10 bg-white/5 p-4";
  let screen: React.ReactNode;
  let action: React.ReactNode = null;

  if (state.step === 0) {
    screen = <Hero>
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5 text-3xl">🌿</div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">DeMentha · Module 2 of 12</p>
      <h1 aria-label="How to be a Dementhian" className="mt-3 text-5xl font-bold leading-none tracking-tight text-white">How to be a<br />Dementhian</h1>
      <p className="mt-5 text-lg leading-7 text-slate-300">Everything that isn&apos;t Leave No Trace: the gear, the safety, the culture, the law, and the bar. About <strong className="text-white">28 minutes</strong>, once.</p>
      <p className="mt-5 text-sm text-slate-500">Required before you camp with us in 2026 — alongside the LNT module, which is separate and also required.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(1)}>Start</button>;
  } else if (state.step === 1) {
    screen = <>
      <h2 className="text-3xl font-bold text-white">Who&apos;s this for?</h2>
      <p className="mt-3 text-slate-400">Training completion will be recorded for <strong className="text-white">{memberName}</strong>.</p>
      <p className="mt-7 text-slate-300">Which is you this year?</p>
      <div className="mt-3 space-y-3">
        {([
          ["first", "First year with DeMentha", "Welcome. Read it twice."],
          ["return", "Coming back", "Camp changes every year. Some of this is new."],
          ["lead", "Captain or Manager", "You own a function — people will ask you these things."],
        ] as const).map(([kind, label, detail]) => <button key={kind} onClick={() => persist({ ...state, kind: kind as GeneralKind })} aria-pressed={state.kind === kind} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left aria-pressed:border-emerald-400 aria-pressed:bg-emerald-400/10">
          <span className="grid h-6 w-6 place-items-center rounded-full border border-white/20 text-xs">{state.kind === kind ? "✓" : ""}</span>
          <span><strong className="block text-white">{label}</strong><small className="text-slate-500">{detail}</small></span>
        </button>)}
      </div>
      <p className="mt-5 text-sm text-slate-500">Everyone sees the same module. This only changes what your card says.</p>
    </>;
    action = <button className="training-cta" disabled={!state.kind} onClick={() => goTo(2)}>Continue</button>;
  } else if (state.step === 2) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Before anything else</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">You are <span className="text-emerald-300">that person.</span></h2>
      <p className="mt-5 text-2xl leading-9 text-slate-300">“See a gap? Fill it. Spot an opportunity? Take it on next year. There’s no single person to hand it off to.”</p>
      <p className="mt-7 text-sm leading-6 text-slate-500">— The Book of Mint. We wrote that about keeping our own manual alive. It turned out to be the whole camp in three sentences, so we put it first.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(3)}>Okay</button>;
  } else if (state.step === 3) {
    const watched = state.videos.length;
    screen = <>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Technical · 1 of 2</p>
      <h2 className="mt-3 text-3xl font-bold text-white">Two videos, before you go</h2>
      <p className="mt-3 text-slate-400">You&apos;ll be handed both of these, probably by someone who assumes you already know how. A couple of minutes each.</p>
      <div className="mt-6 space-y-3">
        {content.videos.map((video, index) => {
          const seen = state.videos.includes(index);
          return <div key={video.title} className={`rounded-2xl border p-2.5 pb-3.5 ${seen ? "border-emerald-400/40 bg-emerald-400/5" : "border-white/10 bg-white/5"}`}>
            {playing.includes(index)
              ? <div className="aspect-video overflow-hidden rounded-xl"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`} title={video.title} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
              : <button aria-label={`Play: ${video.title}`} onClick={() => { setPlaying((current) => [...current, index]); markSeen("videos", index); }} className="grid aspect-video w-full place-items-center rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg)` }}>
                  <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-white/90 bg-black/70 pl-1 text-lg text-white">▶</span>
                </button>}
            <strong className="ml-1 mt-3 block text-white">{video.title}{video.ours && <span className="ml-2 rounded-full bg-amber-400/10 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-widest text-amber-300">Ours</span>}</strong>
            <span className="ml-1 text-xs text-slate-500">{seen ? "✓ watched · " : ""}{video.credit}</span>
          </div>;
        })}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">Ball bungees and conduit you&apos;ll learn on build, from whoever&apos;s next to you. That&apos;s how most of this camp gets learned — ask early and ask often, nobody has ever thought less of someone for it.</p>
    </>;
    action = <button className="training-cta" disabled={watched !== content.videos.length} onClick={() => goTo(4)}>{watched === content.videos.length ? "Continue" : `${watched} of ${content.videos.length}`}</button>;
  } else if (state.step === 4) {
    screen = <div className="pt-10 text-center">
      <strong className="text-8xl font-black text-emerald-300">0</strong>
      <p className="mt-3 text-lg text-slate-300">places to charge anything.<br /><strong className="text-white">Not one. Anywhere. All week.</strong></p>
      <p className="mt-8 leading-7 text-slate-300">There is no camp power for personal devices. Plan for a week without an outlet — battery banks, charged before you leave, and a phone you can afford to have die.</p>
      <p className="mt-5 text-sm text-slate-500">No video needed for this one. It&apos;s also the thing first-timers most often get wrong.</p>
    </div>;
    action = <button className="training-cta" onClick={() => goTo(5)}>Next</button>;
  } else if (state.step === 5) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">Safety</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">This is the section where getting it wrong <span className="text-red-300">hurts somebody.</span></h2>
      <p className="mt-5 leading-7 text-slate-300">Three rules. One is imposed on us from outside and the camp can be cited for it. Two are ours. None of them take long.</p>
      <p className="mt-5 text-sm text-slate-500">And if you don&apos;t know how to do something on a build, ask before you do it. Nobody here has ever thought less of someone for asking.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(6)}>Understood</button>;
  } else if (state.step === 6) {
    const found = state.bikes.filter((index) => content.bikes[index].bad).length;
    const badCount = content.bikes.filter((bike) => bike.bad).length;
    screen = <>
      <h2 className="text-3xl font-bold text-white">Three of these are a problem</h2>
      <p className="mt-3 text-slate-400">Camp frontage, looking down. Tap every bike that shouldn&apos;t be there.</p>
      <div className="mt-4 flex items-center gap-2.5">
        {Array.from({ length: badCount }, (_, dot) => <span key={dot} className={`h-2.5 w-2.5 rounded-full ${dot < found ? "bg-red-400" : "bg-white/15"}`} />)}
        <span className="ml-1 text-sm text-slate-500">{found} of {badCount} found</span>
      </div>
      <div className="relative mt-3 h-[280px] overflow-hidden rounded-2xl border border-white/10 bg-[#20231C]">
        <div className="absolute inset-x-3 top-3 grid h-[74px] place-items-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold tracking-wider text-slate-300">DEMENTHA · PARTY ENTRANCE</div>
        <div className="absolute left-4 top-[26.5%] text-[10px] font-black uppercase tracking-widest text-slate-500">Bike racks</div>
        <div className="absolute inset-x-3 top-[32.5%] h-[11px] rounded border border-white/10 bg-white/10" />
        <div className="absolute inset-x-0 top-[46%] h-[20%] bg-[repeating-linear-gradient(45deg,rgba(248,113,113,.12)_0_9px,transparent_9px_18px)]" />
        <div className="absolute left-3 top-[calc(46%+6px)] text-[10px] font-black uppercase tracking-widest text-red-300">Emergency lane — keep clear</div>
        <div className="absolute inset-x-0 bottom-0 grid h-[34%] place-items-center bg-black/25 text-[10px] font-black uppercase tracking-widest text-slate-500">The street</div>
        {content.bikes.map((bike, index) => {
          const tapped = state.bikes.includes(index);
          const ring = tapped ? (bike.bad ? "border-red-400 bg-red-400/20" : "border-emerald-400") : "border-white/20 bg-white/10";
          return <button key={index} onClick={() => tapBike(index)} aria-label={`Bike ${index + 1}`} className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 ${ring}`} style={{ left: `${bike.x}%`, top: `${bike.y}%` }}>🚲</button>;
        })}
      </div>
      {found === badCount
        ? <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4"><h3 className="text-lg font-bold text-white">All three.</h3><p className="mt-2 text-sm leading-6 text-slate-300">The emergency lane runs from our party entrance out to the road, and it stays clear. Bikes park <strong className="text-white">between the tent and the road, at the racks</strong> — never in the lane, never on the street.</p><p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">This one isn&apos;t ours. BRC and BLM require the lane stays clear, and it&apos;s the camp that gets cited — not the person who parked. Which makes it everyone&apos;s job: if you see a bike in the lane, move it or tell whoever left it.</p></div>
        : <p className="mt-3 text-sm text-slate-500">Tap a bike to check it.</p>}
      <span className="mt-5 inline-block rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-300">BRC / BLM requirement</span>
      <p className="mt-3 text-sm leading-6 text-slate-500">Park between the tent and the road, at the racks. Tell anyone you see getting it wrong — we would rather you did that than assume somebody else will.</p>
    </>;
    action = <button className="training-cta" disabled={found !== badCount} onClick={() => goTo(7)}>{found === badCount ? "Next" : `Find all three (${found}/${badCount})`}</button>;
  } else if (state.step === 7) {
    const rules = [
      ["Storing fuel", <>Fuel is stored <strong className="text-white">in shade</strong>, in the <strong className="text-white">designated fuel storage containment area</strong>. Not next to your tent, not in a hot vehicle, not wherever it was easiest to put down.</>, <>Any question about fuel — any of them — goes to <strong className="text-slate-300">Kevin Rinderle, Fuel Captain</strong>.</>],
      ["Topping stakes", <>Top every stake with a <strong className="text-white">tennis ball</strong>. Never leave one exposed.</>, <>An untopped stake at shin height in the dark is how people get hurt, and it&apos;s rarely the person who drove it.</>],
    ] as const;
    screen = <>
      <h2 className="text-3xl font-bold text-white">Two more rules</h2>
      <p className="mt-3 text-slate-400">Both short, both ours, both easy to get wrong if nobody tells you.</p>
      <div className="mt-6 space-y-3">{rules.map(([title, body, note]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <span className="inline-block rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">DeMentha rule</span>
        <p className="mt-2.5 text-lg font-bold text-white">{title}</p>
        <p className="mt-2.5 leading-7 text-slate-300">{body}</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">{note}</p>
      </div>)}</div>
    </>;
    action = <button className="training-cta" onClick={() => goTo(8)}>Next</button>;
  } else if (state.step === 8) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Camp culture</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">We are a <span className="text-emerald-300">work camp.</span></h2>
      <p className="mt-5 text-2xl leading-9 text-slate-300">Our work gives the experience meaning. The experience only works because the function does.</p>
      <p className="mt-7 text-sm leading-6 text-slate-500">“DeMentha is a collection of infrastructure and people whose output is greater than the sum of its parts. You decide what it means to you.” — The General</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(9)}>Next</button>;
  } else if (state.step === 9) {
    screen = <>
      <h2 className="text-3xl font-bold text-white">Camp before individuals</h2>
      <p className="mt-3 text-slate-400">Two ideas, straight out of our Culture &amp; Commitments. Neither one is a slogan.</p>
      <div className="mt-6"><Tips items={[
        { icon: "🏕", text: <><strong>Shared spaces come first.</strong> Shade, kitchen, bar, sound — the heartbeat of camp. We prioritise them over individual comfort or convenience. When we take care of the whole, the whole takes care of us.</> },
        { icon: "🔧", text: <><strong>Participant, not passenger.</strong> We don&apos;t have staff, a concierge, or a cleaning crew. A busted generator, a rogue piece of MOOP, an empty propane tank — you don&apos;t walk past it.</> },
      ]} /></div>
      <div className="mt-6 border-l-2 border-amber-400 pl-4 leading-7 text-slate-300">You acknowledge it, take proactive ownership, and either step in to help or find a Camp Lead or Captain and ask how you can support the fix.</div>
      <span className="mt-4 inline-block rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">DeMentha rule</span>
      <p className="mt-3 text-sm text-slate-500">That&apos;s from our Culture &amp; Commitments, word for word. If you&apos;ve never opened it, open it — it&apos;s the best thing we&apos;ve written.</p>
    </>;
    action = <button className="training-cta" onClick={() => goTo(10)}>Next</button>;
  } else if (state.step === 10) {
    const gauges = [
      ["20–25", "On playa, across the week", "Operational shifts spread through the week. Structure varies year to year with camp size.", 70],
      ["15–20", "Pre-playa", "Planning, logistics, storage, build weekends, truck load, meal prep, supply runs.", 50],
      ["15–20", "Post-playa", "Unload, clean, restore, put the camp back in storage. The half nobody photographs.", 50],
    ] as const;
    screen = <>
      <h2 className="text-3xl font-bold text-white">What you actually signed up for</h2>
      <p className="mt-3 text-slate-400">Most people have never seen these numbers. They are good-faith benchmarks, not a timesheet — but they are what it takes, per person, to make camp work.</p>
      <div className="mt-6 space-y-3">{gauges.map(([hours, label, detail, pct]) => <div className={card} key={label}>
        <div className="flex items-baseline justify-between"><span className="text-2xl font-black text-emerald-300">{hours} <span className="text-sm text-slate-500">hrs</span></span><span className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span></div>
        <ProgressBar value={pct} max={100} className="mt-2 h-1.5" />
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
      </div>)}</div>
      <p className="mt-5 text-sm leading-6 text-slate-500">Heavier off-playa contributors carry a lighter on-playa load, and the reverse. Can&apos;t do in-person work? There are other ways — skills, expertise, remote contribution. Say so rather than going quiet.</p>
    </>;
    action = <button className="training-cta" onClick={() => goTo(11)}>Next</button>;
  } else if (state.step === 11) {
    screen = <>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">The one people miss</p>
      <h2 className="mt-3 text-3xl font-bold text-white">Tear-down is the commitment</h2>
      <div className="mt-6 grid grid-cols-2 gap-3 text-center">
        <div className={card}><strong className="text-5xl font-black text-emerald-300">4</strong><p className="mt-2 text-sm text-slate-400">hours<br />Saturday night</p></div>
        <div className={card}><strong className="text-5xl font-black text-emerald-300">8</strong><p className="mt-2 text-sm text-slate-400">hours<br />Sunday</p></div>
      </div>
      <div className="mt-6 border-l-2 border-red-400 pl-4 leading-7 text-slate-300">This is a commitment to the <strong className="text-white">camp&apos;s</strong> tear-down. It is not your personal pack-out.</div>
      <p className="mt-5 leading-7 text-slate-300">Participation continues until communal structures are fully disassembled and packed. Early departure requires pre-approval from Ops, for legitimate emergencies only.</p>
      <div className="mt-5"><Tips items={[
        { icon: "👫", text: <><strong>Both individuals in a couple participate</strong> — in build and in tear-down. Not one of you.</> },
        { icon: "📦", text: <><strong>Stage your personal bins near the truck before you depart.</strong> Double-check the labelling.</> },
        { icon: "🍳", text: <><strong>Get your things out of the kitchen during the week.</strong> Sunday is hard and the kitchen is where everything ends up.</> },
      ]} /></div>
      <p className="mt-4 text-sm text-slate-500">This applies to leaders, veterans and first-timers alike. We say that explicitly because it has come up.</p>
    </>;
    action = <button className="training-cta" onClick={() => goTo(12)}>Next</button>;
  } else if (state.step === 12) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">Gross violation — our words</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">Missing a shift without a <span className="text-red-300">replacement.</span></h2>
      <p className="mt-5 leading-7 text-slate-300">Finding the replacement is your job. Not the Captain&apos;s, not the crew&apos;s. A shift with a hole in it doesn&apos;t disappear — it lands on whoever showed up.</p>
      <div className="mt-5 border-l-2 border-red-400 pl-4 leading-7 text-slate-300">“Don&apos;t be late or flake on a shift — or face the <strong className="text-amber-300">Wrath of Glitta</strong>.”</div>
      <p className="mt-5 text-sm text-slate-500">We say a version of this in both the Bar and the Meals sections of the Book of Mint. We wrote it down twice because it keeps happening.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(13)}>Next</button>;
  } else if (state.step === 13) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">The cheapest thing on this list</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">Introduce yourself to people you <span className="text-emerald-300">don&apos;t know.</span></h2>
      <p className="mt-5 leading-7 text-slate-300">Every year the camp contains people who have been coming for a decade and people who arrived on Thursday, and they are indistinguishable in goggles. Say your name. Ask theirs.</p>
      <p className="mt-5 text-sm text-slate-500">We gave this its own screen because it costs nothing and it&apos;s the thing most often skipped. If you&apos;re sponsoring someone, introducing them around is explicitly part of your job.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(14)}>Next</button>;
  } else if (state.step === 14) {
    const days = [["Mon", "🌟"], ["Tue", ""], ["Wed", "🌟"], ["Thu", ""], ["Fri", "🌟"], ["Sat", ""], ["Sun", ""]] as const;
    screen = <>
      <h2 className="text-3xl font-bold text-white">How the week actually goes</h2>
      <p className="mt-3 text-slate-400">Full camp nights out on <strong className="text-white">Monday, Wednesday and Friday</strong> — though everyone obviously does whatever they want.</p>
      <div className="mt-5 grid grid-cols-7 gap-1.5">{days.map(([day, mark]) => <div key={day} className={`rounded-xl border p-2 pb-1.5 text-center ${mark ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}><div className="text-[10.5px] font-black text-slate-500">{day}</div><div className="mt-1 text-sm">{mark || "·"}</div></div>)}</div>
      <div className="mt-5"><Tips items={[
        { icon: "🎉", text: <><strong>Monday, after dinner, around 10 PM — Opening Ceremony.</strong> The one thing on this screen you should not miss.</> },
        { icon: "🍸", text: <><strong>Bar: 1–6 PM, Monday to Saturday.</strong> The camp&apos;s whole reason for being, five hours a day.</> },
        { icon: "🍽", text: <><strong>Dinner around sundown, roughly 7 PM.</strong> Brunch follows the AM LNT sweep; dinner follows the PM one.</> },
        { icon: "🧊", text: <><strong>Ice precedes party. LNT precedes food.</strong> End times matter more than start times — something is always waiting on you.</> },
      ]} /></div>
      <p className="mt-5 text-sm text-slate-500">Start times move around out there. End times matter more — something is always waiting on the thing before it.</p>
    </>;
    action = <button className="training-cta" onClick={() => goTo(15)}>Next</button>;
  } else if (state.step === 15) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">And when you get it wrong</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">Perfection isn&apos;t the goal. <span className="text-emerald-300">Accountability is.</span></h2>
      <p className="mt-5 leading-7 text-slate-300">Own your mistakes, learn from them, and communicate early when things aren&apos;t going to plan. That&apos;s how we support each other and keep the party going.</p>
      <p className="mt-5 text-sm text-slate-500">Straight out of our Culture &amp; Commitments. Nobody here expects you to be flawless. We expect you to say something.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(16)}>Check what stuck</button>;
  } else if (state.step === 16) {
    ({ content: screen, action } = quizScreen("cultureQuiz", "Four questions. Two of them you have to get right.", 17));
  } else if (state.step === 17) {
    screen = <>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">Law enforcement · internal only</p>
      <h2 className="mt-3 text-3xl font-bold text-white">We are not your lawyers</h2>
      <p className="mt-3 text-lg text-slate-300">And this is not legal advice.</p>
      <p className="mt-4 leading-7 text-slate-300">Law enforcement operates in Black Rock City. The rules that apply to you out there are federal, state and county rules. None of them are ours, and none of them are ours to interpret for you.</p>
      <p className="mt-4 leading-7 text-slate-300">So most of what follows isn&apos;t written by us. It&apos;s what the <strong className="text-white">Burning Man Project</strong> and the <strong className="text-white">ACLU of Nevada</strong> publish. They say it more precisely than we could, and they&apos;re qualified to. We&apos;ve linked both — read them properly.</p>
      <div className="mt-5 border-l-2 border-amber-400 pl-4 leading-7 text-slate-300">Two things here <strong className="text-white">are</strong> ours. We ask you not to name the camp. And we&apos;d rather you were friendly and boring.</div>
      <div className="mt-6 rounded-2xl border-[1.5px] border-dashed border-orange-400/60 p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-orange-300">Why this one is different</h4>
        <p className="mt-2 text-sm leading-6 text-slate-400">It&apos;s not on your field card and this page won&apos;t print. You&apos;re not signing it at the end, and we&apos;re not recording that we trained you on it — because we didn&apos;t. We pointed you at people who are qualified to.</p>
      </div>
    </>;
    action = <button className="training-cta" onClick={() => goTo(18)}>Continue</button>;
  } else if (state.step === 18) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">The one thing worth remembering</p>
      <h2 className="mt-4 text-3xl font-semibold leading-snug text-white">If you&apos;re not in a controlled, enclosed space — <span className="text-red-300">assume you&apos;re being watched.</span></h2>
      <p className="mt-5 leading-7 text-slate-300">An RV, a shiftpod, a porto. Everywhere else: binoculars, night vision, drones. The Burning Man Project says the same in its own Survival Guide, and adds that some officers work undercover and in costume.</p>
      <div className="mt-5 border-l-2 border-amber-400 pl-4 leading-7 text-slate-300">Which makes the practical version short: <strong className="text-white">assume anything you say to a stranger is public.</strong></div>
      <p className="mt-5 text-sm leading-6 text-slate-500">And yes — we told you earlier to introduce yourself to people you don&apos;t know. Both hold at once, and they resolve the way they would at a work party. Introduce yourself, and be boring about everything else.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(19)}>Next</button>;
  } else if (state.step === 19) {
    screen = <>
      <h2 className="text-3xl font-bold text-white">Four things, and who says them</h2>
      <p className="mt-3 text-slate-400">Two are the law. One is a set of rights published by people who do this for a living. One is us asking you a favour. Tap each.</p>
      <div className="mt-6">
        {seenList("law", content.lawItems, (index) => content.lawItems[index].source, (index) => {
          const item = content.lawItems[index];
          setSheet({
            badge: item.authoredByCamp ? { label: "We’re asking", tone: "camp" } : { label: item.source, tone: "external" },
            title: item.title,
            body: <>
              {item.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 24)} className="mt-4 text-sm leading-6 text-slate-300">{paragraph}</p>)}
              {item.link && <a className="mt-4 inline-block border-b border-sky-400/40 pb-0.5 font-semibold text-sky-300" href={item.link.href} target="_blank" rel="noopener noreferrer">{item.link.label} ↗</a>}
            </>,
          });
        })}
      </div>
      <p className="mt-7 font-semibold text-white">Read the originals</p>
      <div className="mt-3 space-y-2.5">
        {[
          ["https://survival.burningman.org/law-enforcement/", "Burning Man Survival Guide — Law Enforcement", "survival.burningman.org"],
          ["https://www.aclunv.org/en/burning-man", "ACLU of Nevada — Know Your Rights: Burning Man", "aclunv.org"],
          ["https://survival.burningman.org/law-enforcement/lawyers-for-burners/", "Lawyers for Burners", "If you need an actual lawyer out there, start here — not with us."],
        ].map(([href, label, note]) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm hover:border-sky-400/40">
          <span aria-hidden="true">🔗</span>
          <span><strong className="block text-white">{label}</strong><span className="text-xs text-slate-500">{note}</span></span>
        </a>)}
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">If you&apos;re stopped and you&apos;re not sure what to do, that&apos;s exactly what the two links above are for. Read them before you go, not after.</p>
    </>;
    action = <button className="training-cta" disabled={state.law.length !== content.lawItems.length} onClick={() => goTo(20)}>{state.law.length === content.lawItems.length ? "Continue" : `${state.law.length} of ${content.lawItems.length}`}</button>;
  } else if (state.step === 20) {
    screen = <>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Weather</p>
      <h2 className="mt-3 text-3xl font-bold text-white">It might rain</h2>
      <p className="mt-3 leading-7 text-slate-300">We don&apos;t have a policy about shutting parties down, or about much else. If it rains we&apos;ll work it out on the day, like everyone else out there.</p>
      <p className="mt-4 leading-7 text-slate-300">What we do ask is that you turn up equipped for it.</p>
      <div className="mt-5"><Tips items={[
        { icon: "🧥", text: <><strong>A waterproof outer layer.</strong> Something that actually sheds water, not a hoodie.</> },
        { icon: "☂", text: <><strong>A poncho.</strong> Packs down to nothing. Saves the week.</> },
        { icon: "👟", text: <><strong>Rain boots, or boot covers.</strong> Wet playa becomes inches of clay that sticks to everything and doesn&apos;t come off.</> },
      ]} /></div>
      <p className="mt-5 text-sm leading-6 text-slate-500">None of it takes much room in the truck. All of it is miserable to be without.</p>
    </>;
    action = <button className="training-cta" onClick={() => goTo(21)}>Next</button>;
  } else if (state.step === 21) {
    screen = <>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">The bar</p>
      <h2 className="mt-3 text-3xl font-bold text-white">The reason any of it exists</h2>
      <p className="mt-3 leading-7 text-slate-300">Fresh-mint mojitos, a shaded misting tent, and DJs. <strong className="text-white">1:00–6:00 PM, Monday to Saturday.</strong> Run entirely by volunteers on two shifts.</p>
      <div className="mt-5"><Tips items={[
        { icon: "🕐", text: <><strong>Shift 1 · 12:30–3:30 PM.</strong> Includes setup.</> },
        { icon: "🕒", text: <><strong>Shift 2 · 3:30–6:30 PM.</strong> Includes cleaning.</> },
        { icon: "⏰", text: <><strong>Arrive 15 minutes early.</strong> Your Bar Manager briefs you before every shift — procedures, health requirements, and the mojito. Bar Captain is <strong>Kevin Whalen</strong>.</> },
      ]} /></div>
      <div className="mt-6 border-l-2 border-amber-400 pl-4 leading-7 text-slate-300">“A bar shift is an honour, not a chore. Show up ready to shine.”</div>
      <p className="mt-4 text-sm leading-6 text-slate-500">Everyone gets this section, bar shift or not. We want every person in camp to know the next screen — that&apos;s how somebody speaks up when it matters.</p>
    </>;
    action = <button className="training-cta" onClick={() => goTo(22)}>Next</button>;
  } else if (state.step === 22) {
    screen = <Hero>
      <span className="self-start rounded-lg bg-sky-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-sky-300">External requirement · Nevada law</span>
      <h2 className="mt-5 text-3xl font-semibold leading-snug text-white">“Welcome to DeMentha, are you at least <span className="text-emerald-300">21 years of age?</span>”</h2>
      <div className="mt-6"><Tips items={[
        { icon: "①", text: <><strong>Say it to every guest.</strong> No exceptions, even if they look 100.</> },
        { icon: "②", text: <><strong>Wait for a yes.</strong> Actually wait. This is the step people skip.</> },
        { icon: "③", text: <><strong>Then ask for ID.</strong> If it feels off, insist politely — copies are common. If you can&apos;t serve them, that&apos;s on them, not you.</> },
      ]} /></div>
      <p className="mt-5 text-sm leading-6 text-slate-500">Say it exactly as written. It&apos;s a script for a reason — the moment you improvise, you start making judgement calls you don&apos;t need to be making.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(23)}>Next</button>;
  } else if (state.step === 23) {
    screen = <div className="pt-8 text-center">
      <strong className="block text-6xl font-black text-red-300">$1,500</strong>
      <span className="mt-1 block text-sm text-slate-400">to</span>
      <strong className="mt-1 block text-6xl font-black text-red-300">$3,000</strong>
      <p className="mt-4 text-lg text-slate-300">the fine for serving a minor.<br /><strong className="text-white">Per person.</strong></p>
      <p className="mt-7 leading-7 text-slate-300">Not per incident, not per camp. Per person served.</p>
      <p className="mt-4 text-sm text-slate-500">That&apos;s why we make it a mantra instead of a suggestion.</p>
    </div>;
    action = <button className="training-cta" onClick={() => goTo(24)}>Next</button>;
  } else if (state.step === 24) {
    screen = <>
      <h2 className="text-3xl font-bold text-white">The mojito, in nine steps</h2>
      <p className="mt-3 text-slate-400">Tap each as you learn it. Step three is the one everybody gets wrong.</p>
      <div className="mt-5">
        {content.mojitoSteps.map((step, index) => {
          const done = state.mojito.includes(index);
          return <div key={step.text}>
            {step.group && <h4 className={`mb-2 text-[11px] font-black uppercase tracking-widest text-slate-500 ${index > 0 ? "mt-5" : ""}`}>{step.group}</h4>}
            <button onClick={() => persist({ ...state, mojito: done ? state.mojito.filter((item) => item !== index) : [...state.mojito, index] })} className={`mb-2 flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${done ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-black ${done ? "border-emerald-400 bg-emerald-400 text-emerald-950" : "border-white/20 text-slate-500"}`}>{done ? "✓" : index + 1}</span>
              <span className="font-semibold text-white">{step.key ? <>One-second sugar pour — <em className="not-italic text-amber-300">a tiny splash</em></> : step.text}</span>
            </button>
          </div>;
        })}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">Cuyler&apos;s video covers the muddle. Your Bar Manager walks you through the whole thing before your shift — arrive fifteen minutes early and you&apos;ll get it.</p>
    </>;
    action = <button className="training-cta" disabled={state.mojito.length !== content.mojitoSteps.length} onClick={() => goTo(25)}>{state.mojito.length === content.mojitoSteps.length ? "Continue" : `${state.mojito.length} of ${content.mojitoSteps.length}`}</button>;
  } else if (state.step === 25) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">The single most important note in the recipe</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">Simple syrup: <span className="text-emerald-300">a tiny splash.</span></h2>
      <p className="mt-4 text-2xl leading-9 text-slate-300">A quick flick of the wrist — or the whole drink is too sweet.</p>
      <p className="mt-5 leading-7 text-slate-300">A one-second pour. Not a count of three. We call this out above every other step in the recipe, which should tell you how reliably it goes wrong.</p>
      <p className="mt-5 text-sm text-slate-500">You&apos;re making a few hundred of these. The difference between a one-second pour and a two-second pour is the difference between a mojito and a dessert.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(26)}>Next</button>;
  } else if (state.step === 26) {
    screen = <>
      <h2 className="text-3xl font-bold text-white">Four rules behind the bar</h2>
      <p className="mt-3 text-slate-400">Tap each one.</p>
      <div className="mt-6">
        {seenList("bar", content.barRules, (index) => content.barRules[index].source, (index) => {
          const rule = content.barRules[index];
          setSheet({
            badge: rule.external ? { label: rule.source, tone: "external" } : { label: "DeMentha rule", tone: "camp" },
            title: rule.title,
            body: rule.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 24)} className="mt-4 text-sm leading-6 text-slate-300">{paragraph}</p>),
          });
        })}
      </div>
    </>;
    action = <button className="training-cta" disabled={state.bar.length !== content.barRules.length} onClick={() => goTo(27)}>{state.bar.length === content.barRules.length ? "Continue" : `${state.bar.length} of ${content.barRules.length}`}</button>;
  } else if (state.step === 27) {
    screen = <Hero>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">And then the actual point</p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">Slow down. <span className="text-emerald-300">You are the entertainment.</span></h2>
      <p className="mt-5 leading-7 text-slate-300">The drinks are free, so there is zero rush. Let them wait — there are worse places to be than under misters at DeMentha.</p>
      <div className="mt-5 border-l-2 border-amber-400 pl-4 leading-7 text-slate-300">“You&apos;re not at work. The interaction is the point. The mojito is a medium for creating interaction.”</div>
      <p className="mt-5 text-sm text-slate-500">Dance. Joke. Pump up the DJs. We encourage radical self-expression behind the bar specifically, and we say so in as many words in the Book of Mint.</p>
    </Hero>;
    action = <button className="training-cta" onClick={() => goTo(28)}>Check what stuck</button>;
  } else if (state.step === 28) {
    ({ content: screen, action } = quizScreen("barQuiz", "Three questions. Two of them you have to get right.", 29));
  } else if (state.step === 29) {
    screen = <>
      <h2 className="text-3xl font-bold text-white">Sign it</h2>
      <p className="mt-3 text-slate-400">Not a formality. This is the bit that makes it a commitment instead of a webpage you scrolled.</p>
      <div className="mt-7 rounded-2xl border border-white/10 bg-white/5 p-5 text-lg leading-8 text-white">
        <p>I&apos;ve read this, and I&apos;ll follow it.</p>
        <p className="mt-4">I&apos;ll do my hours, I&apos;ll stay for tear-down, and if I can&apos;t make a shift <strong>I&apos;ll find my own replacement.</strong></p>
        <p className="mt-5 text-sm text-slate-400">— {memberName}, {new Date().toLocaleDateString()}</p>
      </div>
      <div className="mt-5 rounded-2xl border-[1.5px] border-dashed border-orange-400/60 p-4">
        <h4 className="text-xs font-black uppercase tracking-widest text-orange-300">The one thing you are not signing</h4>
        <p className="mt-2 text-sm leading-6 text-slate-400">Law Enforcement. That section is reference material published by other people, it isn&apos;t on your field card, and we&apos;re not recording that we trained you on it. Everything else in here is ours, and you&apos;re signing for it.</p>
      </div>
      <p className="mt-4 text-sm text-slate-500">Press and hold the button to sign.</p>
      {completionStatus === "error" && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">We couldn&apos;t save your completion. Check your connection and try again.</p>}
    </>;
    action = completionStatus === "saving"
      ? <button className="training-cta" disabled>Saving…</button>
      : completionStatus === "error"
        ? <button className="training-cta" onClick={() => void finishCompletion()}>Retry completion</button>
        : <button className="training-cta select-none" onPointerDown={startPledge} onPointerUp={cancelPledge} onPointerLeave={cancelPledge} onPointerCancel={cancelPledge}>Hold to sign</button>;
  } else {
    const kindLabel = state.kind === "lead" ? "Captain / Manager" : state.kind === "first" ? "First Year" : "Camp Member";
    screen = <>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Complete</p>
      <h2 className="mt-3 text-4xl font-bold text-white">You&apos;re in.</h2>
      <div className="mt-6 rounded-2xl bg-emerald-300 p-6 text-emerald-950">
        <div className="flex justify-between text-xs font-black uppercase tracking-widest"><span>DeMentha · General 2026</span><span>🌿</span></div>
        <p className="mt-6 text-2xl font-black">{memberName}</p>
        <p className="font-semibold opacity-75">{kindLabel}</p>
        <div className="mt-6 space-y-1.5 text-xs font-bold opacity-80">
          {([["Shifts, on playa", "20–25 hrs"], ["Tear-down", "4 Sat · 8 Sun"], ["Bar", "1–6 PM · Mon–Sat"], ["Serving a minor", "$1,500–3,000"], ["Places to charge", "0"], ["Fuel", "Shade + containment"], ["Stakes", "Tennis balls"]] as const).map(([label, value]) => <div key={label} className="flex justify-between border-t border-emerald-950/15 pt-1.5"><span>{label}</span><span>{value}</span></div>)}
        </div>
        <div className="mt-6 flex justify-between text-xs font-bold opacity-70"><span>3:00 &amp; ARARA · PC0047</span><span>{completedAt ? new Date(completedAt).toLocaleDateString() : "Completed today"}</span></div>
      </div>
      <div className="mt-5"><Tips items={[
        { icon: "🖨", text: <><strong>Print your card before you leave.</strong> Grayscale-safe and laminate-ready. There&apos;s no charging out there — you read that already.</> },
        { icon: "🔒", text: <><strong>Law enforcement isn&apos;t on your card.</strong> On purpose. That section stays inside camp.</> },
        { icon: "♻", text: <><strong>LNT is a separate module.</strong> Also required. Different content, same shape.</> },
        { icon: "✅", text: <><strong>Completion saved.</strong> This exact module version is on file.</> },
      ]} /></div>
      <p className="mt-5 text-sm leading-6 text-slate-500">Module 2 of 12 — this one covers eleven of them. Ice, Meals, Water, Coolers and Space Plan will get their own in time.</p>
    </>;
    action = <button className="training-cta" onClick={onDone}>Done</button>;
  }

  const canGoBack = history.length > 0 || previousStep(state) !== undefined;

  return <div className="mx-auto w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#121310] shadow-2xl print:hidden">
    <div className="flex min-h-[720px] flex-col">
      <header className="relative flex h-14 items-center px-4">
        <button onClick={goBack} disabled={!canGoBack} aria-label="Back" className="h-10 w-10 text-2xl text-emerald-300 disabled:invisible">‹</button>
        <ProgressBar value={state.step} max={TOTAL_STEPS} className="absolute inset-x-5 bottom-0 h-1" />
      </header>
      <section className="flex-1 overflow-y-auto px-6 pb-8 pt-5">{screen}</section>
      {action && <footer className="sticky bottom-0 bg-gradient-to-t from-[#121310] via-[#121310] to-transparent px-6 pb-6 pt-5">{action}</footer>}
    </div>
    {sheet && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={() => setSheet(undefined)}>
      <div role="dialog" aria-modal="true" aria-label={sheet.title} className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-6 sm:rounded-3xl" onClick={(event) => event.stopPropagation()}>
        {sheet.badge && <SheetBadge badge={sheet.badge} />}
        <h3 className="mt-3 text-xl font-bold text-white">{sheet.title}</h3>
        {sheet.body}
        <button className="mt-6 w-full rounded-xl bg-white/10 py-3 font-semibold text-white" onClick={() => setSheet(undefined)}>Close</button>
      </div>
    </div>}
  </div>;
}
