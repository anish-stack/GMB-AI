import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Caveat } from "next/font/google";
import {
  Search,
  Hash,
  Lightbulb,
  PenLine,
  ImageIcon,
  ShieldCheck,
  Eye,
  Send,
  Bot,
  Moon,
  Layers,
  Users,
  Building2,
  BarChart3,
  Calendar,
  Tag,
  Check,
  CheckCircle2,
  ArrowRight,
  Play,
  Star,
  FileText,
  Sparkles,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/saas/settings.js";
import { listPlans } from "@/lib/saas/billing.js";
import PricingToggle from "@/components/landing/pricing-toggle.js";

export const dynamic = "force-dynamic";

const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"] });

const RED = "#F53236";

/* ---------------------------------- data ---------------------------------- */

const PIPELINE = [
  { icon: Search, title: "Business Research", desc: "Understand the client's business, location, audience and latest updates.", tag: "Fresh & relevant insights", tone: "blue" },
  { icon: Hash, title: "Keyword Discovery", desc: "Find the most relevant local, service-based and trending keywords.", tag: "Better visibility on Google", tone: "rose" },
  { icon: Lightbulb, title: "Content Planning", desc: "Choose the strongest topic, post angle and messaging for maximum impact.", tag: "Topics that drive engagement", tone: "green" },
  { icon: PenLine, title: "AI Copywriting", desc: "Create clear, on-brand and compelling Google Business Profile content.", tag: "Tailored to your client's tone", tone: "violet" },
  { icon: ImageIcon, title: "Visual Creation", desc: "Generate an attractive, professionally designed image matched to the post.", tag: "Scroll-stopping visuals", tone: "amber" },
  { icon: ShieldCheck, title: "Quality Check", desc: "Score the content for relevance, quality and consistency (80+ criteria).", tag: "High-quality, on-brand posts", tone: "blue" },
  { icon: Eye, title: "Human Approval", desc: "Review, edit, approve or reject in seconds.", tag: "You stay in control", tone: "rose" },
  { icon: Send, title: "Smart Publishing", desc: "Publish instantly or schedule for the best time to reach your client's audience.", tag: "More reach, better results", tone: "green" },
];

const TONE = {
  blue: {
    badge: "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30",
    icon: "bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 dark:from-blue-500/10 dark:to-blue-500/20 dark:text-blue-400",
    tag: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    arrow: "text-blue-500",
  },
  rose: {
    badge: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/30",
    icon: "bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600 dark:from-rose-500/10 dark:to-rose-500/20 dark:text-rose-400",
    tag: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
    arrow: "text-rose-500",
  },
  green: {
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30",
    icon: "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 dark:from-emerald-500/10 dark:to-emerald-500/20 dark:text-emerald-400",
    tag: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    arrow: "text-emerald-500",
  },
  violet: {
    badge: "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:ring-violet-500/30",
    icon: "bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 dark:from-violet-500/10 dark:to-violet-500/20 dark:text-violet-400",
    tag: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    arrow: "text-violet-500",
  },
  amber: {
    badge: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30",
    icon: "bg-gradient-to-br from-amber-50 to-orange-100 text-orange-500 dark:from-amber-500/10 dark:to-amber-500/20 dark:text-amber-400",
    tag: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300",
    arrow: "text-orange-500",
  },
};

const FEATURES = [
  { icon: Bot, title: "Multi-provider AI chain", desc: "Automatically falls back across providers.", tone: "blue" },
  { icon: Moon, title: "Nightly automation", desc: "Scheduled jobs keep your queues filled.", tone: "violet" },
  { icon: Layers, title: "Duplicate detection", desc: "Stops near-identical posts from going out.", tone: "rose" },
  { icon: ShieldCheck, title: "Bulk approve & reject", desc: "Clear a week of posts in a few clicks.", tone: "rose" },
  { icon: BarChart3, title: "Analytics & exports", desc: "Track volume and QA pass rates, export to CSV.", tone: "rose" },
  { icon: Calendar, title: "Content calendar", desc: "See every post at a glance.", tone: "rose" },
  { icon: Users, title: "Team roles", desc: "Keep approval and publishing permissions in check.", tone: "violet" },
  { icon: Building2, title: "Multi-tenant by design", desc: "Run it as your own internal tool, or resell it.", tone: "violet" },
  { icon: Tag, title: "White-label ready", desc: "Put your own branding in front of your clients.", tone: "rose" },
];

const FEATURE_ICON = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  rose: "bg-rose-50 text-[#F53236] dark:bg-rose-500/10 dark:text-rose-400",
};

// NOTE: placeholder numbers — replace with real figures before going live.
const STATS = [
  { icon: FileText, value: "10,000+", label: "Posts generated", cls: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
  { icon: Users, value: "500+", label: "Agencies & businesses", cls: "bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400" },
  { icon: BarChart3, value: "98%", label: "QA pass rate", cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
  { icon: Star, value: "4.9/5", label: "Customer satisfaction", cls: "bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400" },
];

// NOTE: illustrative reviews — swap in real client quotes.
const REVIEWS = [
  { initials: "RM", name: "Rohit Mehta", role: "Digital Marketing Agency", quote: "GMB AI Cloud saves our team hours every week. The quality of posts is amazing." },
  { initials: "PS", name: "Priya Sharma", role: "Multi-location Business", quote: "We manage 50+ locations and this tool makes it effortless. Highly recommended!" },
  { initials: "AV", name: "Aman Verma", role: "SEO Consultant", quote: "The automated content and visuals are on point. Our client engagement has improved a lot." },
];

/* --------------------------------- helpers -------------------------------- */

function Logo({ name }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F53236] shadow-[0_4px_12px_rgba(245,50,54,0.35)]">
        <BarChart3 className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
      </span>
      <span className="text-sm font-semibold">{name}</span>
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-[#e81d22] ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-900/40">
      {children}
    </span>
  );
}

function PrimaryCta({ allowSignup, email, className = "" }) {
  const cls = `inline-flex items-center gap-2 rounded-lg bg-[#F53236] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(245,50,54,0.3)] hover:bg-[#e81d22] ${className}`;
  return allowSignup ? (
    <Link href="/signup" className={cls}>
      Start free <ArrowRight className="h-4 w-4" />
    </Link>
  ) : (
    <a href={`mailto:${email}`} className={cls}>
      Contact sales <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function DashedArrow({ className }) {
  return (
    <svg viewBox="0 0 28 12" fill="none" className={className}>
      <path d="M1 6h22" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M20 2l5 4-5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SOCIALS = [
  { label: "X", d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
  { label: "LinkedIn", d: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" },
  { label: "YouTube", d: "M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" },
  { label: "Instagram", d: "M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95C23.73 2.7 21.31.27 16.95.07 15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z" },
];

/* ---------------------------------- page ---------------------------------- */

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.tenantId ? "/dashboard" : "/admin");

  const [settings, plans] = await Promise.all([
    getSettings(),
    listPlans({ publicOnly: true }),
  ]);
  const allowSignup = Number(settings.allow_signup) === 1;
  const previewPlans = plans.slice(0, 3);
  const name = settings.platform_name;
  const email = settings.support_email;

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* ============================ HEADER ============================ */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo name={name} />
          <nav className="hidden items-center gap-8 text-[13px] text-zinc-500 dark:text-zinc-400 lg:flex">
            {[
              ["#pipeline", "How it works"],
              ["#features", "Features"],
              ["#pricing", "Pricing"],
              ["#reviews", "Reviews"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-zinc-900 dark:hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-lg border border-zinc-200 bg-white px-7 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 sm:inline-flex dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Sign in
            </Link>
            {allowSignup ? (
              <Link href="/signup" className="rounded-lg bg-[#F53236] px-7 py-2 text-sm font-medium text-white hover:bg-[#e81d22]">
                Start free
              </Link>
            ) : (
              <a href={`mailto:${email}`} className="rounded-lg bg-[#F53236] px-7 py-2 text-sm font-medium text-white hover:bg-[#e81d22]">
                Contact sales
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ============================= HERO ============================= */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(700px 420px at 90% 5%, rgba(245,50,54,0.10), transparent 60%), radial-gradient(600px 380px at 70% 40%, rgba(236,72,153,0.06), transparent 60%)",
          }}
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:pb-20">
          <div>
            <Pill>AI-powered Google Business Profile management</Pill>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-[52px]">
              Turn 30 minutes
              <br className="hidden sm:block" /> of GMB post work
              <br className="hidden sm:block" /> into a{" "}
              <span className="text-[#F53236]">two-minute review</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {name} researches, writes, designs and QA-checks Google Business
              Profile posts for every client on your books — your team just
              reviews, approves and publishes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryCta allowSignup={allowSignup} email={email} className="px-7" />
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-6 py-2.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <Play className="h-2.5 w-2.5 fill-current" />
                </span>
                Watch demo
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              {["No credit card required", "Setup in minutes", "Cancel anytime"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 fill-emerald-500 text-white dark:text-zinc-950" /> {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
            <div className={`${hand.className} pointer-events-none absolute -top-6 right-2 z-10 hidden rotate-[4deg] text-right text-lg leading-tight text-zinc-700 lg:block dark:text-zinc-300`}>
              <svg viewBox="0 0 50 30" className="absolute -left-12 top-3 h-6 w-10 text-[#F53236]" fill="none">
                <path d="M48 6 C 30 0, 10 4, 4 22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M1 17 L4 23 L9 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              From idea
              <br />
              to published
              <br />
              in minutes! <span className="text-[#F53236]">🚀</span>
            </div>
            <Image
              src="/illustrations/hero.png"
              width={1456}
              height={1092}
              alt={`${name} dashboard preview`}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </section>

      {/* =========================== PIPELINE =========================== */}
      <section id="pipeline" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Pill>
            <Sparkles className="h-3 w-3" /> A complete, end-to-end workflow
          </Pill>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-[32px]">
            From Idea to Published — <span className="text-[#F53236]">Every Post, Fully Managed</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
            One smart workflow handles the research, content, visuals, quality
            checks and publishing — you simply review and approve.
          </p>
        </div>

        <div className="relative mt-10 lg:px-2">
          {/* row connector: card 4 → card 5 */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible text-indigo-300 lg:block dark:text-indigo-700"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M1000 22 C 1035 22, 1035 50, 1000 50 L 0 50 C -35 50, -35 78, -5 78"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeDasharray="5 5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="relative grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((step, i) => {
              const t = TONE[step.tone];
              const lastInRow = (i + 1) % 4 === 0;
              return (
                <div key={step.title} className="relative">
                  <div className="relative flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900">
                    <span className={`absolute -top-2.5 -left-2.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ring-4 ${t.badge}`}>
                      {i + 1}
                    </span>
                    <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${t.icon}`}>
                      <step.icon className="h-8 w-8" strokeWidth={2.2} />
                    </span>
                    <p className="mt-4 text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{step.desc}</p>
                    <span className={`mt-3 block rounded-md px-2.5 py-1 text-center text-[11px] font-medium ${t.tag}`}>
                      {step.tag}
                    </span>
                  </div>
                  {!lastInRow ? (
                    <DashedArrow className={`absolute top-1/2 -right-8 z-10 hidden h-3 w-8 -translate-y-1/2 px-1 lg:block ${t.arrow}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <p className={`${hand.className} mx-auto mt-8 -rotate-2 text-center text-xl text-zinc-700 dark:text-zinc-300`}>
          Same process.{" "}
          <span className="underline decoration-[#F53236] decoration-2 underline-offset-4">Happier clients.</span>{" "}
          Bigger results.
        </p>
      </section>

      {/* =========================== FEATURES =========================== */}
      <section id="features" className="relative scroll-mt-20 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(500px 380px at 28% 40%, rgba(245,50,54,0.07), transparent 65%)" }}
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-6">
            {/* left */}
            <div className="relative lg:min-h-[480px]">
              <Pill>Why choose {name}</Pill>
              <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-[30px]">
                Built for agencies
                <br /> running this <span className="text-[#F53236]">at scale</span>
              </h2>
              <p className="mt-3 max-w-[270px] text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Everything you need to manage Google Business Profile content
                for multiple clients — in one place.
              </p>
              <ul className="mt-6 space-y-3 text-[13px]">
                {["Save hours every week", "Deliver consistent quality", "Keep clients happy", "Scale without extra headcount"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#F53236] text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              {allowSignup ? <PrimaryCta allowSignup email={email} className="mt-7" /> : null}

              <div className="relative mx-auto mt-10 w-full max-w-sm lg:absolute lg:right-0 lg:bottom-[20%] lg:mt-0 lg:w-[56%]">
                <div className="absolute -top-2 right-6 z-10 w-36 rounded-xl bg-white px-3 py-2 text-[11px] leading-snug text-zinc-700 shadow-lg ring-1 ring-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800">
                  Let AI handle the busy work so you can focus on growth.
                  <span className="absolute -bottom-1.5 left-8 h-3 w-3 rotate-45 bg-white ring-0 dark:bg-zinc-900" />
                </div>
                <Image
                  src="/illustrations/team-laptop.png"
                  width={1456}
                  height={1400}
                  alt=""
                  className="h-auto w-full pt-14"
                />
              </div>
            </div>

            {/* right: feature grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-zinc-100 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${FEATURE_ICON[f.tone]}`}>
                    <f.icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </span>
                  <p className="mt-3 text-[13px] font-semibold leading-tight">{f.title}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* stats */}
          <div className="mt-8 grid grid-cols-2 gap-6 rounded-2xl border border-zinc-100 bg-white px-6 py-5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="flex items-center justify-center gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${s.cls}`}>
                  <s.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-bold leading-none">{s.value}</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ PRICING =========================== */}
      {previewPlans.length ? (
        <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-xl text-center">
            <Pill>Flexible plans for every team</Pill>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-[30px]">
              Simple, <span className="text-[#F53236]">credit-based</span> pricing
            </h2>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Every plan includes the full AI pipeline. You pick the volume.
            </p>
          </div>

          <div className="mt-8">
            <PricingToggle plans={previewPlans} allowSignup={allowSignup} />
          </div>

          <div className="mt-6 text-center">
            <Link href="/pricing" className="inline-flex items-center gap-1 text-xs font-medium text-[#F53236] hover:underline">
              Compare every plan &amp; feature <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      ) : null}

      {/* ============================ REVIEWS =========================== */}
      <section id="reviews" className="scroll-mt-20 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="relative text-center">
            <Pill>Loved by agencies and businesses</Pill>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-[28px]">Real results. Real happy clients.</h2>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Helping teams save time and show real results on Google.
            </p>
            <a
              href="#reviews"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#F53236] hover:underline lg:absolute lg:right-0 lg:bottom-0 lg:mt-0"
            >
              See more reviews <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-3">
            {REVIEWS.map((r) => (
              <div
                key={r.name}
                className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-rose-200 text-sm font-semibold text-[#F53236] dark:from-rose-500/20 dark:to-rose-500/10">
                  {r.initials}
                </span>
                <div>
                  <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">&ldquo;{r.quote}&rdquo;</p>
                  <p className="mt-3 text-[13px] font-semibold leading-none">{r.name}</p>
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{r.role}</p>
                  <div className="mt-2 flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ FINAL CTA ========================= */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <div
          className="relative overflow-hidden rounded-2xl px-6 py-10 text-white sm:px-10"
          style={{
            background:
              "radial-gradient(420px 260px at 72% 110%, rgba(245,50,54,0.55), transparent 70%), radial-gradient(500px 300px at 95% 0%, rgba(245,50,54,0.25), transparent 70%), linear-gradient(100deg, #17171a 0%, #1d1416 55%, #2a1113 100%)",
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr_auto_auto]">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F53236] shadow-[0_0_30px_rgba(245,50,54,0.6)]">
              <BarChart3 className="h-6 w-6 text-white" strokeWidth={2.5} />
            </span>

            <div>
              <h2 className="text-2xl font-bold sm:text-[28px]">Stop writing GMB posts by hand</h2>
              <p className="mt-2 max-w-md text-sm text-zinc-300">
                Bring your clients in, connect their profiles, and let the
                pipeline fill the queue tonight.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <PrimaryCta allowSignup={allowSignup} email={email} className="px-7" />
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-2.5 text-sm font-medium hover:bg-white/10"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white">
                    <Play className="h-2 w-2 fill-current" />
                  </span>
                  Watch demo
                </a>
              </div>
            </div>

            <div className="relative hidden items-center lg:flex">
              <p className={`${hand.className} -rotate-6 text-xl leading-tight text-zinc-200`}>
                More clients.
                <br /> More visibility.
                <br /> <span className="pl-4">Less work.</span>
              </p>
              <img src="/illustrations/rocket.svg" alt="" width={220} height={260} className="ml-2 h-40 w-auto" />
            </div>

            <div className="justify-self-start rounded-xl border border-white/20 bg-black/30 px-5 py-4 text-xl font-semibold leading-tight lg:justify-self-end">
              Grow on
              <br /> Google
              <br /> with AI <span className="text-amber-300">✨</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================= FOOTER =========================== */}
      <footer id="faq" className="scroll-mt-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.9fr_0.9fr_1fr_1.4fr]">
          <div>
            <Logo name={name} />
            <p className="mt-3 max-w-[210px] text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Smarter Google Business Profile marketing, at scale.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li><a href="#pipeline" className="hover:text-zinc-900 dark:hover:text-white">How it works</a></li>
              <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-white">Features</a></li>
              <li><Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-white">Pricing</Link></li>
              <li><a href="#faq" className="hover:text-zinc-900 dark:hover:text-white">FAQ</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold">Company</p>
            <ul className="mt-3 space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
              <li><a href="#features" className="hover:text-zinc-900 dark:hover:text-white">About</a></li>
              <li><a href="#reviews" className="hover:text-zinc-900 dark:hover:text-white">Blog</a></li>
              <li><a href={`mailto:${email}`} className="hover:text-zinc-900 dark:hover:text-white">Contact</a></li>
              <li><a href="#" className="hover:text-zinc-900 dark:hover:text-white">Privacy</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold">Follow us</p>
            <div className="mt-3 flex items-center gap-4 text-zinc-700 dark:text-zinc-300">
              {SOCIALS.map((s) => (
                <a key={s.label} href="#" aria-label={s.label} className="hover:text-[#F53236]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d={s.d} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold">Get product updates</p>
            <form className="mt-3 flex items-center gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs outline-none placeholder:text-zinc-400 focus:border-[#F53236] dark:border-zinc-800 dark:bg-zinc-900"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F53236] text-white hover:bg-[#e81d22]"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 py-5 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
            <span className="flex gap-6">
              <a href="#" className="hover:text-zinc-900 dark:hover:text-white">Terms</a>
              <a href="#" className="hover:text-zinc-900 dark:hover:text-white">Privacy</a>
              <a href={`mailto:${email}`} className="hover:text-zinc-900 dark:hover:text-white">Support</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}