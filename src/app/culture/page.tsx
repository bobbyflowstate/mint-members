import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DeMentha Culture | Burning Man 2026",
  description:
    "Read DeMentha's culture, commitments, camp expectations, and sponsorship responsibilities.",
};

const culturePrinciples = [
  {
    title: "If You're Here, You're In",
    body: "Being here means you're aligned with the mission supporting the music, the bar, and the collective experience. Your presence reflects a shared commitment to what we're building together.",
  },
  {
    title: "Camp Comes First",
    body: "DeMentha works because we think and act as a collective. Our shared spaces including shade, kitchen, bar, and sound are the heartbeat of the camp, and we naturally prioritize them over individual comfort or convenience. When we take care of the whole, the whole takes care of us.",
  },
  {
    title: "Be a Participant, Not a Passenger",
    body: "DeMentha runs because everyone participates. We don't have staff, a concierge, or a cleaning crew. If you see an issue (a busted generator, a rogue piece of MOOP, an empty propane tank) you don't walk past it. You acknowledge it, take proactive ownership, and either step in to help or seek out a Camp Lead or Captain and ask how you can support the fix.",
  },
  {
    title: "Own Your Sh*t",
    body: "Perfection isn't the goal. Accountability is. Own your mistakes, learn from them and communicate early when things aren't going to plan. Showing up this way is how we support each other and keep the party going.",
  },
];

const expectationSections = [
  {
    title: "Commitments Matter",
    body: "Camp dues, ticket confirmations, and required sign-ups are due on time. If a deadline is missed, we'll assume you've opted out. We don't chase. Participation requires follow-through.",
  },
  {
    title: "Shared Responsibility Is Core",
    body: [
      "Participation is a shared, mission-aligned responsibility and not a transactional exchange or form of compensation. DeMentha functions because everyone contributes meaningfully to the collective effort. Contribution is not measured by precise hour-tracking, but by showing up consistently, taking responsibility, and doing what's needed to keep the camp operating. Expectations are intentionally clear but not transactional, allowing flexibility year over year while maintaining fairness and shared ownership.",
      "Outside of build and teardown, campers should generally expect to contribute approximately 20–25 hours total over the week in on-playa operational shifts. These shifts support daily camp operations spread throughout the week. Shift structure may vary year to year based on camp size and needs, and the intent is to set a realistic expectation, not to create a system of minimums or self-accounting.",
      "Meaningful work also happens off-playa before and after Burning Man (for example planning, logistics, storage organization, build weekends, truck load/unload, meal prep sessions, cleaning days, and supply pick-up). Campers should generally expect to contribute approximately 15-20 hours pre-playa and 15-20 hours post-playa to support preparation and restoration efforts. These are not hard and fast rules, but good-faith benchmarks intended to ensure expectations are aligned around what it typically takes, per person, to make camp successful.",
      "We recognize that not everyone has the ability to participate in in-person pre- or post-playa work, though if you are able, that support is always welcomed and deeply valued. There are many ways to contribute. If you have particular skills, professional expertise, or other ways you believe you can support camp, including remote contributions, please reach out. Every member brings unique abilities and aptitudes and we encourage people to step forward where they can add meaningful value.",
      "Campers who participate more heavily in off-playa work may carry a lighter operational load on playa, while those who are not available for off-playa work are expected to contribute more heavily on playa. This is about balancing effort across the community, not penalizing availability constraints.",
    ],
  },
  {
    title: "Tear-Down Is a Core Community Commitment",
    body: [
      "Campers are expected to remain through tear-down unless prior arrangements are made for legitimate exceptions. All campers are expected to stay and actively participate in tear-down, which includes 4 hours on Saturday night and 8 hours on Sunday. This is a commitment to the camp's tear-down, not your personal pack-out. Participation continues until communal structures are fully disassembled and packed.",
      "Early departures require pre-approval from Ops for legitimate emergencies only. This expectation applies to leaders, veterans, and first-timers.",
    ],
  },
  {
    title: "Baseline Respect",
    body: "Contribute to an environment where everyone feels safe, respected, and included. Keep the vibes good, keep your hands to yourself and look out for one another.",
  },
];

const sponsorshipSections = [
  {
    title: "Gatekeepers, Guides & Culture Carriers",
    body: "Sponsorship at DeMentha is a responsibility, not a favor. Sponsors are the gatekeepers and mentors of our community. You are accountable for ensuring a new member is prepared for both the fun and the function of camp life. A good sponsor protects the culture by setting clear expectations, checking for understanding and helping new members succeed within them.",
  },
  {
    title: "What It Means to Be a Sponsor",
    body: [
      "Your role as a sponsor is to mentor and guide, but make no mistake: you are fully accountable for your sponsee's readiness and understanding. Their success (or failure) reflects directly on you.",
      "Before arriving on playa, sit down with your sponsee to review the DeMentha Culture & Commitments and all required camp materials as they are shared. Ensure they understand what 'communal first' looks like in practice, not just in theory, and that they are meeting all commitments and deadlines. If this is their first Burning Man, your role also includes orienting them to the broader realities and principles of the event, not just DeMentha.",
      "An invitation is not a guarantee of attendance. Sponsorship carries accountability. If at any point you discover your sponsee is not aligned, not prepared, or not honoring commitments, it is your responsibility to address it directly.",
      "Once on playa, your job is integration. Introduce your sponsee, answer questions, confirm commitments and show them exactly where they need to be and when.",
      "After the Burn, meet with your sponsee to review culture fit, commitments, and lessons learned. This feedback matters and influences future invitations.",
      "Sponsorship means being willing to teach, guide, and give honest feedback. If that feels uncomfortable, sponsoring isn't the right role for you. Be real with your sponsee. Clarity is what protects the camp.",
    ],
  },
  {
    title: "What It Means to Be a Sponsee",
    body: [
      "Your first year is an opportunity to learn the culture, demonstrate alignment with our values, and understand the responsibilities of participation. An invitation doesn't guarantee a return. Showing up, pulling your weight and closing the loop after the Burn does.",
      "Show up curious. Pay attention. Learn the rhythms of the camp and the reasons behind them. Engagement and initiative are how you find your footing here.",
      "Participation means self-accountability. Meet deadlines, handle your commitments, and take care of yourself and your belongings so others don't have to.",
    ],
  },
];

function SectionBlock({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8 shadow-[0_20px_80px_rgba(2,6,23,0.35)] backdrop-blur-sm sm:px-10 sm:py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
          {eyebrow}
        </p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        {intro ? (
          <p className="mt-5 text-base leading-8 text-slate-300 sm:text-lg">
            {intro}
          </p>
        ) : null}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function BodyContent({ content }: { content: string | string[] }) {
  const paragraphs = Array.isArray(content) ? content : [content];

  return (
    <div className="space-y-5 text-base leading-8 text-slate-300">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

export default function CulturePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.16),_transparent_28%),linear-gradient(180deg,_#020617_0%,_#0f172a_50%,_#111827_100%)]" />

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-14 lg:py-20">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-slate-950/70 px-6 py-10 shadow-[0_24px_120px_rgba(6,78,59,0.22)] backdrop-blur sm:px-10 sm:py-14">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.2),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.14),_transparent_30%)]" />
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-200">
              DeMentha Member Guide
            </span>
            <span className="text-slate-500">/</span>
            <span>Culture, commitments, and expectations</span>
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            DeMentha Culture & Commitments
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            This is who we are and why we&apos;re here. It&apos;s the core of what
            keeps DeMentha running and bumping.
          </p>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
            The specific purpose of DeMentha is to promote experimental and
            temporal art and music and to uphold the Ten Principles of Burning
            Man. On playa, we do so by hosting daytime gatherings with
            fresh-mint mojitos, a shaded misting tent, and sets from DeMentha
            DJs that keep the energy high. It&apos;s a literal oasis in the desert,
            built by people who show up for the work behind the magic. The
            experience only works because the function does. These gatherings
            are volunteer-supported and advance DeMentha&apos;s nonprofit mission to
            foster community, creativity, and shared cultural experience.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/apply"
              className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400"
            >
              Apply to Join Camp
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-white/20 hover:bg-white/10"
            >
              Return to Home
            </Link>
          </div>
        </section>

        <SectionBlock
          eyebrow="Culture"
          title="What we expect from every DeMenthian"
          intro="The camp works when the mission, the music, and the operations all reinforce each other. These commitments define the baseline."
        >
          <div className="grid gap-4 sm:gap-5">
            {culturePrinciples.map((section) => (
              <article
                key={section.title}
                className="rounded-[1.5rem] border border-white/8 bg-slate-950/45 px-5 py-6 sm:px-7"
              >
                <h3 className="text-xl font-semibold text-white">
                  {section.title}
                </h3>
                <p className="mt-3 text-base leading-8 text-slate-300">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-[1.5rem] border border-amber-400/20 bg-amber-400/6 px-5 py-6 sm:px-7">
            <h3 className="text-xl font-semibold text-white">
              Nonprofit & Volunteer Participation Statement
            </h3>
            <p className="mt-3 text-base leading-8 text-slate-300">
              DeMentha is a 501(c)(3) nonprofit organization. Participation in
              DeMentha activities is voluntary and reflects a shared commitment
              to our mission, culture, and community. Contributions of time,
              effort, and resources support the collective experience and are
              not compensation, consideration, or a condition of receiving
              personal benefit. All activities described herein are intended to
              advance community-building, cultural expression, and shared
              responsibility in alignment with our nonprofit purpose.
            </p>
          </div>
        </SectionBlock>

        <SectionBlock
          eyebrow="Operations"
          title="DeMentha Camp Expectations"
          intro="Think of this as the how-to guide for being a successful DeMenthian. These are the practical, non-negotiable actions that keep the machine running and the party going."
        >
          <div className="space-y-8">
            {expectationSections.map((section) => (
              <article key={section.title} className="max-w-3xl">
                <h3 className="text-2xl font-semibold text-white">
                  {section.title}
                </h3>
                <div className="mt-4">
                  <BodyContent content={section.body} />
                </div>
              </article>
            ))}
          </div>
        </SectionBlock>

        <SectionBlock
          eyebrow="Sponsorship"
          title="Sponsorship at DeMentha"
          intro="Sponsorship protects culture by turning invitations into real preparation, honest expectations, and active integration."
        >
          <div className="space-y-8">
            {sponsorshipSections.map((section) => (
              <article key={section.title} className="max-w-3xl">
                <h3 className="text-2xl font-semibold text-white">
                  {section.title}
                </h3>
                <div className="mt-4">
                  <BodyContent content={section.body} />
                </div>
              </article>
            ))}
          </div>
        </SectionBlock>
      </div>
    </main>
  );
}
