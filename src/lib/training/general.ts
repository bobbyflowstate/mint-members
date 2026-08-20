import type { GeneralTrainingModule } from "./types";

export const generalModule: GeneralTrainingModule = {
  slug: "general",
  version: "2026.2",
  title: "How to be a Dementhian",
  description: "Everything that isn't Leave No Trace: the gear, the safety, the culture, the law, and the bar.",
  estimatedMinutes: 28,
  required: true,
  completionPolicy: { acceptedVersions: ["2026.1", "2026.2"] },
  content: {
    videos: [
      {
        title: "Ratchet strap",
        youtubeId: "ErLlvH8TdnY",
        ours: false,
        credit: "Not ours — a 3D animation of how the mechanism actually works.",
        description: "Every shade structure and every truck load depends on this one.",
      },
      {
        title: "Making a mojito",
        youtubeId: "1Uxxde772t8",
        ours: true,
        credit: "Cuyler Cameron — Dementha Mojito Training.",
        description: "The nine written steps are in the Bar section. This is the muddle, which writing can’t teach.",
      },
    ],
    bikes: [
      { x: 24, y: 34, bad: false, why: "At the rack, between the tent and the road. This is where bikes go." },
      { x: 52, y: 34, bad: false, why: "At the rack. Correct." },
      { x: 78, y: 34, bad: false, why: "At the rack. Correct." },
      { x: 30, y: 60, bad: true, why: "In the emergency lane. The lane runs from our party entrance out to the road and it has to stay clear." },
      { x: 71, y: 57, bad: true, why: "In the emergency lane, directly across the entrance path. Worst placement on the screen." },
      { x: 22, y: 79, bad: true, why: "On the street. Not allowed, and it is the camp that gets told about it, not the rider." },
    ],
    lawItems: [
      {
        icon: "⚖",
        title: "If you’re stopped, you have rights",
        source: "ACLU of Nevada",
        authoredByCamp: false,
        paragraphs: [
          "The ACLU of Nevada publishes a Know Your Rights page specifically for Burning Man. In their words: you have the right to remain silent — and if you want to use it, say so out loud. You have the right to refuse consent to a search of yourself or your vehicle. If you are not under arrest, you have the right to calmly leave. If you are arrested, you have the right to a lawyer — ask for one immediately. These apply regardless of immigration or citizenship status.",
          "Their page also carries their own note that none of it is intended as legal advice. We’d rather you read the whole thing from them than a summary from us — we’re not lawyers, and what you do out there is yours.",
        ],
        link: { href: "https://www.aclunv.org/en/burning-man", label: "Read the ACLU of Nevada page" },
      },
      {
        icon: "🤫",
        title: "We ask you not to name the camp",
        source: "A request from DeMentha",
        authoredByCamp: true,
        paragraphs: [
          "This one is ours, and it’s a favour we’re asking rather than advice we’re giving.",
          "Naming us attaches whatever is happening to you to several hundred other people and to a 501(c)(3) that runs a bar. The bar is the most likely place you’ll be asked.",
        ],
      },
      {
        icon: "🌿",
        title: "Cannabis is illegal here",
        source: "Federal law",
        authoredByCamp: false,
        paragraphs: [
          "Black Rock City sits on federal land. Nevada’s state legalisation does not apply out there. The Burning Man Project states plainly that cannabis remains illegal under federal law and that consuming it in public is illegal.",
          "Nothing to do with us. It’s the law.",
        ],
        link: { href: "https://survival.burningman.org/law-enforcement/specific-laws-to-be-aware-of/", label: "Survival Guide — Specific laws" },
      },
      {
        icon: "💊",
        title: "Prescriptions in their original bottle",
        source: "Federal law",
        authoredByCamp: false,
        paragraphs: [
          "Medication has to be in its original labelled container. A pill organiser is enough to turn a routine interaction into a long one.",
          "Also just the law.",
        ],
      },
    ],
    barRules: [
      {
        icon: "🧤",
        title: "Wash, then glove. Always.",
        source: "Health code",
        external: true,
        paragraphs: [
          "In this order, every shift:",
          "1. Wash your hands before your shift starts.",
          "2. Then put gloves on, and keep them on at all times.",
          "Wash again after any break, and re-glove. The order matters — gloves over unwashed hands are just a container for the problem.",
        ],
      },
      {
        icon: "🔎",
        title: "Inspector? “Let me go get the bar manager!”",
        source: "Say exactly this",
        external: false,
        paragraphs: [
          "If an inspector approaches you, that sentence is the entire answer. Cheerfully, immediately, and then go and get them.",
          "It isn’t evasion and it isn’t a joke — you genuinely aren’t the person who can speak for the camp here, and a helpful guess is how a small question becomes a large one.",
        ],
      },
      {
        icon: "📦",
        title: "Every supply is already at the bar",
        source: "DeMentha rule",
        external: false,
        paragraphs: [
          "Take nothing from anywhere else in camp. If something is missing, ask the Bar Manager. Do not solve it yourself — it may create issues in our system. Tight inventory control is what keeps the bar stocked for the whole event and for our parties.",
        ],
      },
      {
        icon: "🍋",
        title: "Repeat customers: into the drink dumps",
        source: "Cross-references LNT",
        external: false,
        paragraphs: [
          "Excess lime and mint from a returning guest’s cup goes into the drink dump buckets. Solids to bar compost, liquid to the gray water tank — and bar compost never touches kitchen compost. That rule lives in our LNT module. It’s ours, not the compost camp’s — we learned it the hard way.",
        ],
      },
    ],
    mojitoSteps: [
      { group: "Muddle", text: "Four slices of lime" },
      { text: "Four pieces of mint" },
      { text: "One-second sugar pour — a tiny splash", key: true },
      { text: "Muddle well" },
      { group: "Build", text: "One shot of rum" },
      { text: "Add ice" },
      { text: "Shake" },
      { group: "Finish", text: "Fill up with soda water" },
      { text: "Pour into the guest’s cup" },
    ],
    cultureQuiz: [
      {
        question: "Tear-down. What are you committing to?",
        options: [
          "Whatever time is left after you pack your own vehicle",
          "Sunday morning, then you drive",
          "Four hours Saturday night and eight hours Sunday",
        ],
        answer: 2,
        critical: true,
        explanation: "Four hours Saturday night, eight hours Sunday — and it’s our tear-down, not your personal pack-out. You stay until the communal structures are fully disassembled and packed.",
        source: "Early departure needs pre-approval from Ops, for legitimate emergencies only. That goes for leaders, veterans and first-timers alike.",
      },
      {
        question: "You can’t make your shift. What happens next?",
        options: [
          "You tell the Captain and they sort it out",
          "You find your own replacement",
          "You let the crew absorb it — it’s one person",
        ],
        answer: 1,
        critical: true,
        explanation: "Finding the replacement is your job. Missing a shift without one is a gross violation — that’s the strongest language we use anywhere.",
        source: "“Don’t be late or flake on a shift — or face the Wrath of Glitta.” And, from Meals: “people are counting on you.”",
      },
      {
        question: "Roughly how many hours of on-playa shifts do we expect from you across the week?",
        options: ["8–10 hours", "However many you feel like", "20–25 hours"],
        answer: 2,
        critical: false,
        explanation: "20–25 hours on playa, plus roughly 15–20 pre-playa and 15–20 post-playa. These are good-faith benchmarks, not a timesheet — but they’re what it actually takes, per person, to make this work.",
        source: "If you carry more off-playa, we expect less of you on playa. If you can’t do off-playa work, we’ll lean on you more out there.",
      },
      {
        question: "You walk past a propane tank that’s run empty. You’re not on shift.",
        options: [
          "Leave it — someone whose job it is will catch it",
          "Deal with it, or find a Lead and ask how to help",
          "Mention it at dinner if you remember",
        ],
        answer: 1,
        critical: false,
        explanation: "We don’t have staff, a concierge, or a cleaning crew. You acknowledge it, take ownership, and either step in or find a Camp Lead or Captain and ask how to help.",
        source: "Be a participant, not a passenger.",
      },
    ],
    barQuiz: [
      {
        question: "A guest walks up to the bar. What comes out of your mouth first?",
        options: [
          "“What can I get you?”",
          "“Welcome to DeMentha, are you at least 21 years of age?”",
          "Nothing — you ask for ID straight away",
        ],
        answer: 1,
        critical: true,
        explanation: "Every guest, every time, no exceptions — even if they look 100. Then wait for a yes, and then ask for ID. The wait is the part people skip, and it is the part that makes the line function rather than decorate.",
        source: "Say it to every guest, every time. It’s the first thing we teach and the last thing we’d drop.",
      },
      {
        question: "Someone in a county health shirt starts asking you how the bar handles ice.",
        options: [
          "Answer as best you can — you’ve been briefed",
          "Say the bar is closed",
          "“Let me go get the bar manager!”",
        ],
        answer: 2,
        critical: true,
        explanation: "“Let me go get the bar manager!” is the entire answer. You’re not the person who speaks for us here, and a helpful guess is how a small question becomes a large one.",
        source: "This isn’t evasion. It’s the correct answer.",
      },
      {
        question: "The simple syrup. How much?",
        options: [
          "A full count of three",
          "A one-second pour — a tiny splash, a flick of the wrist",
          "Half a jigger",
        ],
        answer: 1,
        critical: false,
        explanation: "A quick flick of the wrist. We call it out as the single most important note in the recipe — any more and the drink is too sweet, and it’s the step almost everyone gets wrong.",
        source: "From our mojito procedure. Step three, and the only one we underline.",
      },
    ],
  },
};
