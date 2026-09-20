import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  FlaskConical,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Logo } from '@/components/layout/AppShell';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { WeatherCode } from '@/api/types';
import { WeatherIcon } from '@/lib/weather';
import { PLFS_URBAN_SELF_EMPLOYED_SHARE } from '@/api/mock/engine';

const TIMELINE: { day: string; code: WeatherCode; amount: number; tone: string }[] = [
  { day: 'Mon', code: 'clear', amount: 1320, tone: 'text-good-ink' },
  { day: 'Tue', code: 'partly_cloudy', amount: 1180, tone: 'text-ink-soft' },
  { day: 'Wed', code: 'rain', amount: 940, tone: 'text-ink-soft' },
  { day: 'Thu', code: 'heavy_rain', amount: 780, tone: 'text-serious-ink' },
  { day: 'Fri', code: 'storm', amount: 610, tone: 'text-critical-ink' },
  { day: 'Sat', code: 'partly_cloudy', amount: 1490, tone: 'text-good-ink' },
  { day: 'Sun', code: 'clear', amount: 1660, tone: 'text-good-ink' },
];

const FEATURES = [
  {
    Icon: TrendingUp,
    title: '7 and 14-day income forecast',
    body: 'A point forecast with an honest range, built from your day-of-week pattern, weather, festivals and recent demand — with the contributing factors named.',
  },
  {
    Icon: ShieldCheck,
    title: 'A buffer sized to your volatility',
    body: 'Not "three months of expenses". A target that moves with your income swings, your forecast uncertainty and the bills actually due — shown line by line.',
  },
  {
    Icon: CalendarDays,
    title: 'Festival and saving windows',
    body: 'Learns from your own history which periods earned more, then shows where saving a little extra does the most work for your buffer.',
  },
  {
    Icon: FlaskConical,
    title: 'Stress-test your week',
    body: 'Drop your income, add rain, add an emergency expense. Watch the projected balance, shortfall risk and buffer recalculate live.',
  },
];

const PRINCIPLES = [
  'No lending, no credit products, no BNPL',
  'No credit scoring or eligibility judgements',
  'Synthetic demo data — no real financial credentials',
  'Every prediction names its contributing factors',
];

export function Landing() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActive((i) => (i + 1) % TIMELINE.length), 1600);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-canvas-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo compact />
          <div className="flex items-center gap-2">
            <a
              href="#how"
              className="focus-ring hidden rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink sm:block"
            >
              How it works
            </a>
            <Link to="/login">
              <Button variant="primary" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
                Try the demo
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------- hero */}
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-900/25 px-3 py-1.5 text-2xs font-600 uppercase tracking-[0.1em] text-brand-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              AI income forecasting for gig workers
            </span>

            <h1 className="mt-6 font-display text-4xl font-700 leading-[1.06] tracking-tight text-ink sm:text-6xl">
              Your income changes.
              <br />
              <span className="bg-gradient-to-r from-brand-300 to-[#8B9BF0] bg-clip-text text-transparent">
                Your essentials don&rsquo;t.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-lg">
              KAMAI.AI forecasts unstable delivery income, identifies upcoming shortfalls, and helps gig workers build
              enough financial buffer to survive bad weeks.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login">
                <Button variant="primary" size="lg" iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
                  Try the demo
                </Button>
              </Link>
              <a href="#how">
                <Button variant="secondary" size="lg">
                  See how it works
                </Button>
              </a>
            </div>

            <p className="mt-5 flex items-center gap-2 text-xs text-ink-faint">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Demo runs on synthetic data. No accounts, no bank details, nothing to sign up for.
            </p>
          </motion.div>

          {/* ------------------------------------------ income timeline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="card mt-14 p-5 sm:p-7"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="label-eyebrow">One week in a delivery driver&rsquo;s life</p>
                <p className="mt-1.5 font-display text-lg font-600 text-ink">
                  Same person. Same effort. <span className="text-ink-muted">₹610 to ₹1,660 a day.</span>
                </p>
              </div>
              <p className="text-xs text-ink-faint">Illustrative — not this demo&rsquo;s forecast</p>
            </div>

            <ol className="grid grid-cols-4 gap-2 sm:grid-cols-7 sm:gap-3">
              {TIMELINE.map((t, i) => (
                <li key={t.day}>
                  <div
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border px-2 py-4 transition-all duration-500',
                      active === i && !reduce
                        ? 'border-brand-400/50 bg-brand-900/20 sm:scale-[1.04]'
                        : 'border-canvas-line bg-canvas-raised',
                    )}
                  >
                    <span className="text-2xs font-600 uppercase tracking-[0.08em] text-ink-muted">{t.day}</span>
                    <WeatherIcon code={t.code} className="h-7 w-7" title={t.day} />
                    <span className={cn('tnum font-display text-sm font-600', t.tone)}>
                      ₹{t.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 grid grid-cols-1 gap-3 border-t border-canvas-line pt-5 sm:grid-cols-3">
              <HeroStat label="Weekly income" value="₹7,980" sub="swings ±34% week to week" />
              <HeroStat label="Weekly essentials" value="₹4,900" sub="rent, EMI, food, fuel — fixed" />
              <HeroStat label="The real question" value="Can I spend today?" sub="answered by next week's forecast" accent />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------------------------------------------------- problem */}
      <section className="border-y border-canvas-line bg-canvas-raised/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="label-eyebrow">The problem</p>
              <h2 className="mt-3 font-display text-2xl font-700 leading-tight text-ink sm:text-3xl">
                The problem isn&rsquo;t earning too little.
                <br />
                It&rsquo;s not knowing what comes next.
              </h2>
            </div>
            <div className="space-y-5">
              <blockquote className="rounded-2xl border border-canvas-line bg-canvas-card p-5">
                <p className="text-base leading-relaxed text-ink-soft">
                  &ldquo;My average month is fine. But I don&rsquo;t know what I&rsquo;ll earn next week, so I
                  don&rsquo;t know whether I can safely spend money today.&rdquo;
                </p>
                <footer className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                  <span>
                    The gap this product closes — self-employed workers are{' '}
                    {PLFS_URBAN_SELF_EMPLOYED_SHARE}% of India&rsquo;s urban workforce, the largest single segment.
                  </span>
                  <span className="text-ink-faint">(PLFS, MoSPI)</span>
                </footer>
              </blockquote>
              <p className="text-sm leading-relaxed text-ink-muted">
                Income arrives daily and varies. Rent, EMI and bills arrive monthly and don&rsquo;t. A single weak week
                landing next to a payment date is what turns a normal month into a crisis. KAMAI.AI makes that collision
                visible before it happens, and sizes the buffer needed to absorb it.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ProblemStat
                  value="47%"
                  label="couldn’t cover a month of expenses without borrowing"
                  source="Flourish Ventures & 60 Decibels, The Digital Hustle: India"
                />
                <ProblemStat
                  value="7.7M → 23.5M"
                  label="India’s gig workforce, 2020-21 projected to 2029-30"
                  source="NITI Aayog"
                />
                <ProblemStat
                  value="Instability,"
                  label="not low pay alone, is what the Economic Survey flags as the risk"
                  source="Economic Survey, via Forbes India"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <p className="label-eyebrow">How it works</p>
        <h2 className="mt-3 max-w-2xl font-display text-2xl font-700 leading-tight text-ink sm:text-3xl">
          Know your next good week. Prepare for your next bad week.
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="card card-hover p-6"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-brand-400/25 bg-brand-900/25">
                <Icon className="h-5 w-5 text-brand-300" aria-hidden />
              </span>
              <h3 className="font-display text-base font-600 text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- ethics */}
      <section className="border-t border-canvas-line bg-canvas-raised/40">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <p className="label-eyebrow">What this is not</p>
              <h2 className="mt-3 font-display text-2xl font-700 leading-tight text-ink sm:text-3xl">
                A resilience tool, not a lending funnel.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                Gig workers are among the most aggressively targeted groups for payday credit. This product takes the
                opposite position: it tells you what&rsquo;s coming and what to hold, and it sells you nothing.
              </p>
            </div>

            <ul className="space-y-3">
              {PRINCIPLES.map((p) => (
                <li key={p} className="flex items-start gap-3 rounded-xl border border-canvas-line bg-canvas-card p-4">
                  <BadgeCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-good-ink" aria-hidden />
                  <span className="text-sm text-ink-soft">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="card relative overflow-hidden bg-hero-glow p-8 text-center sm:p-14">
          <Wallet className="mx-auto mb-5 h-9 w-9 text-brand-300" aria-hidden />
          <h2 className="mx-auto max-w-xl font-display text-2xl font-700 leading-tight text-ink sm:text-3xl">
            See a full week forecast, buffer target and stress test — in about 60 seconds.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">
            The demo loads Arjun, a delivery partner in Delhi NCR, with 14 months of synthetic earning history.
          </p>
          <Link to="/login" className="mt-8 inline-block">
            <Button variant="primary" size="lg" iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
              Open the demo
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-canvas-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <Logo compact />
          <p className="text-center text-xs text-ink-faint sm:text-right">
            Prototype built on synthetic data. Forecasts are estimates, not guarantees, and nothing here is financial
            advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HeroStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div>
      <p className="label-eyebrow">{label}</p>
      <p
        className={cn(
          'tnum mt-1.5 font-display text-xl font-600 leading-none',
          accent ? 'text-brand-300' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs text-ink-muted">{sub}</p>
    </div>
  );
}

/**
 * A cited fact in the problem section. Every number here traces to
 * src/data/evidence-sources.json — see that file for the full claim, exact
 * value, methodology notes and a live-reachability check on the source URL.
 */
function ProblemStat({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="rounded-xl border border-canvas-line bg-canvas-card p-4">
      <p className="tnum font-display text-lg font-700 leading-tight text-ink">{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{label}</p>
      <p className="mt-2 text-[10px] uppercase tracking-[0.06em] text-ink-faint">{source}</p>
    </div>
  );
}
