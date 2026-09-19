import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CloudSun,
  FlaskConical,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAppData } from '@/hooks/useAppData';
import { Badge } from '@/components/ui';
import { Copilot } from '@/features/copilot/Copilot';
import { ScenarioBar } from './ScenarioBar';

const NAV = [
  { to: '/app', label: 'Dashboard', Icon: LayoutDashboard, end: true },
  { to: '/app/forecast', label: 'Forecast', Icon: TrendingUp, end: false },
  { to: '/app/cashflow', label: 'Cashflow', Icon: Wallet, end: false },
  { to: '/app/stress-test', label: 'Stress Test', Icon: FlaskConical, end: false },
  { to: '/app/calendar', label: 'Income Calendar', Icon: CalendarDays, end: false },
  { to: '/app/insights', label: 'Insights', Icon: Lightbulb, end: false },
];

/** Mobile bottom bar shows the five most-used destinations. */
const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[5]];

export function AppShell() {
  const { user, scenarios } = useAppData();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const location = useLocation();

  // Scroll to top on route change — long pages otherwise keep their offset.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const profile = user.data?.profile;

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to main content
      </a>

      {/* ------------------------------------------------------- sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-canvas-line bg-canvas-raised lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-canvas-line px-5">
          <Logo />
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-canvas-hover text-ink' : 'text-ink-muted hover:bg-canvas-hover/60 hover:text-ink-soft',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-400"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  ) : null}
                  <Icon className={cn('h-4.5 w-4.5 shrink-0', isActive && 'text-brand-300')} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-canvas-line p-3">
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="focus-ring flex w-full items-center gap-3 rounded-xl border border-brand-400/25 bg-brand-900/20 px-3 py-2.5 text-sm font-medium text-brand-200 transition-colors hover:border-brand-400/50 hover:bg-brand-900/35"
          >
            <MessageSquare className="h-4.5 w-4.5 shrink-0" aria-hidden />
            Ask Kamai
          </button>
        </div>

        {profile ? (
          <div className="border-t border-canvas-line p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-700 text-white">
                {profile.avatar_initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-600 text-ink">{profile.name}</p>
                <p className="truncate text-[11px] text-ink-muted">
                  {profile.role} · {profile.city}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </aside>

      {/* -------------------------------------------------------- topbar */}
      <header className="sticky top-0 z-20 border-b border-canvas-line bg-canvas/85 backdrop-blur-xl lg:pl-60">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Logo compact />
          </div>

          <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
            <p className="truncate text-sm text-ink-muted">
              {profile ? (
                <>
                  <span className="text-ink-soft">{profile.zone}</span> · {profile.typical_working_days} days a week
                </>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {scenarios.length ? (
              <Badge tone="warn" className="hidden sm:inline-flex">
                <FlaskConical className="h-3 w-3" aria-hidden />
                {scenarios.length} scenario{scenarios.length > 1 ? 's' : ''} active
              </Badge>
            ) : null}
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-900/25 px-3 text-xs font-600 text-brand-200 transition-colors hover:border-brand-400/60 lg:hidden"
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              Ask
            </button>
            {profile ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-700 text-white lg:hidden">
                {profile.avatar_initials}
              </span>
            ) : null}
          </div>
        </div>

        <ScenarioBar />
      </header>

      {/* ----------------------------------------------------------- main */}
      <main id="main" className="px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pl-[16.5rem] lg:pr-6">
        <div className="mx-auto w-full max-w-[86rem]">
          <Outlet />
        </div>
      </main>

      {/* ------------------------------------------------- mobile bottom */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-canvas-line bg-canvas-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'focus-ring flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-600 transition-colors',
                    isActive ? 'text-brand-300' : 'text-ink-muted',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="truncate">{label.split(' ')[0]}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Copilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient">
        <CloudSun className="h-4.5 w-4.5 text-white" aria-hidden />
      </span>
      <span className="font-display text-sm font-700 tracking-tight text-ink">
        KAMAI<span className="text-brand-300">.AI</span>
        {!compact ? (
          <span className="block text-[10px] font-500 uppercase tracking-[0.14em] text-ink-faint">Income Weather</span>
        ) : null}
      </span>
    </span>
  );
}

/** Small close button reused by overlays. */
export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas-hover hover:text-ink"
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  );
}
