import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Fuel,
  Landmark,
  MapPin,
  Plus,
  Sparkles,
  Target,
  Trash2,
  User,
} from 'lucide-react';
import { Logo } from '@/components/layout/AppShell';
import { Button, Card } from '@/components/ui';
import { useLocation } from '@/hooks/useLocation';
import { useCommitments } from '@/hooks/useCommitments';
import type { UserGoalInput, UserLoanInput } from '@/api';
import { cn } from '@/lib/cn';
import { todayISO } from '@/lib/format';
import fuelPriceByCity from '@/data/fuel-price-by-city.json';

type Step = 1 | 2 | 3;

function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * The app's entry gate, in three steps. Not a real login — this product
 * explicitly rules out fake credentials (see the README's ethics section):
 * step 1 is just a display name, step 2 is the city that drives real weather
 * and fuel price, and step 3 is an entirely optional way to tell the
 * forecast about loans and goals so the buffer, cashflow and default warnings
 * can actually plan around them instead of only ever seeing rent and one
 * built-in EMI.
 */
export function Login() {
  const [step, setStep] = useState<Step>(1);
  const { name, setName: saveName } = useCommitments();
  const { cities, selectCity } = useLocation();

  const [nameInput, setNameInput] = useState(name);
  const [pendingCity, setPendingCity] = useState<string | null>(null);

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;
    saveName(nameInput);
    setStep(2);
  }

  function chooseCity(cityId: string) {
    setPendingCity(cityId);
    selectCity(cityId);
    setTimeout(() => setStep(3), 260);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas bg-hero-glow px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl"
      >
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="mb-6 flex items-center justify-center gap-2" aria-hidden>
          {([1, 2, 3] as const).map((s) => (
            <span
              key={s}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                s === step ? 'w-8 bg-brand-400' : s < step ? 'w-4 bg-brand-400/50' : 'w-4 bg-canvas-line',
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <StepShell key="name">
              <form onSubmit={submitName}>
                <StepHeader
                  icon={<User className="h-5 w-5 text-brand-300" aria-hidden />}
                  eyebrow="Step 1 of 3"
                  title="What should we call you?"
                  description="Just a name for your dashboard — nothing else, no account created."
                />
                <label htmlFor="login-name" className="sr-only">
                  Your name
                </label>
                <input
                  id="login-name"
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. Arjun"
                  maxLength={40}
                  className="w-full rounded-xl border border-canvas-line bg-canvas-raised px-4 py-3 text-center font-display text-lg text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-400/60"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!nameInput.trim()}
                  iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}
                >
                  Continue
                </Button>
              </form>
            </StepShell>
          ) : null}

          {step === 2 ? (
            <StepShell key="city">
              <StepHeader
                icon={<MapPin className="h-5 w-5 text-brand-300" aria-hidden />}
                eyebrow="Step 2 of 3"
                title="Where are you based?"
                description="Your city sets the real weather and real fuel price behind the forecast — everything else about your demo profile stays the same."
              />
              <CityPicker pendingCity={pendingCity} cities={cities} onChoose={chooseCity} />
            </StepShell>
          ) : null}

          {step === 3 ? <CommitmentsStep key="commitments" /> : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------- shared shell */

function StepShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="p-6 sm:p-8">{children}</Card>
    </motion.div>
  );
}

function StepHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7 text-center">
      <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-400/25 bg-brand-900/25">
        {icon}
      </span>
      <p className="label-eyebrow">{eyebrow}</p>
      <h1 className="mt-1.5 font-display text-xl font-700 tracking-tight text-ink sm:text-2xl">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ step 2 */

function CityPicker({
  cities,
  pendingCity,
  onChoose,
}: {
  cities: ReturnType<typeof useLocation>['cities'];
  pendingCity: string | null;
  onChoose: (cityId: string) => void;
}) {
  const prices = (fuelPriceByCity as { cities: Record<string, { petrol_price_per_litre: number }> }).cities;

  return (
    <>
      <div role="radiogroup" aria-label="Select your city" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cities.map((city, i) => {
          const petrol = prices[city.id]?.petrol_price_per_litre;
          const isPending = pendingCity === city.id;
          return (
            <motion.button
              key={city.id}
              type="button"
              role="radio"
              aria-checked={isPending}
              onClick={() => onChoose(city.id)}
              disabled={pendingCity !== null}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'focus-ring group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-150',
                isPending
                  ? 'border-brand-400/70 bg-brand-900/30'
                  : 'border-canvas-line bg-canvas-raised hover:border-brand-400/40 hover:bg-canvas-hover',
                pendingCity !== null && !isPending && 'opacity-40',
              )}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-base font-600 text-ink">{city.label}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{city.zone}</p>
                </div>
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                    isPending ? 'border-brand-400 bg-brand-500' : 'border-canvas-line bg-canvas-card',
                  )}
                >
                  {isPending ? (
                    <Check className="h-3.5 w-3.5 text-white" aria-hidden />
                  ) : (
                    <ArrowRight
                      className="h-3 w-3 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  )}
                </span>
              </div>

              {petrol ? (
                <span className="mt-1 flex items-center gap-1.5 rounded-lg bg-canvas-hover px-2 py-1 text-2xs text-ink-muted">
                  <Fuel className="h-3 w-3" aria-hidden />
                  Petrol <span className="tnum font-600 text-ink-soft">₹{petrol.toFixed(2)}/L</span>
                  <span className="text-ink-faint">today</span>
                </span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-faint">
        Weather from Open-Meteo, fuel prices from PPAC (Ministry of Petroleum &amp; Natural Gas) — both real, both
        checked. Demo runs on synthetic income data; nothing here is a real account.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ step 3 */

function CommitmentsStep() {
  const { saveCommitments } = useCommitments();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<UserLoanInput[]>([]);
  const [goals, setGoals] = useState<UserGoalInput[]>([]);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);

  function finish(keepEntries: boolean) {
    saveCommitments(keepEntries ? loans : [], keepEntries ? goals : []);
    navigate('/app');
  }

  return (
    <StepShell key="commitments">
      <StepHeader
        icon={<Landmark className="h-5 w-5 text-brand-300" aria-hidden />}
        eyebrow="Step 3 of 3 — optional"
        title="Any loans or goals to plan around?"
        description="Add them and your buffer, cashflow and early-warning checks will actually account for what you owe and what you're saving toward. Skip if you'd rather not — nothing below is required."
      />

      <div className="space-y-5">
        {/* -------------------------------------------------------- loans */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-[0.06em] text-ink-muted">
              <Landmark className="h-3.5 w-3.5" aria-hidden />
              Loans &amp; EMIs
            </p>
            {loans.length < 3 && !showLoanForm ? (
              <button
                type="button"
                onClick={() => setShowLoanForm(true)}
                className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-600 text-brand-300 transition-colors hover:text-brand-200"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add a loan
              </button>
            ) : null}
          </div>

          {loans.length ? (
            <ul className="mb-3 space-y-2">
              {loans.map((loan) => (
                <li
                  key={loan.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-canvas-line bg-canvas-raised px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-600 text-ink">{loan.label}</p>
                    <p className="text-xs text-ink-muted">
                      <span className="tnum">₹{loan.emi_amount.toLocaleString('en-IN')}</span>/month · due day{' '}
                      {loan.due_day_of_month}
                      {loan.end_date ? ` · until ${loan.end_date}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoans((prev) => prev.filter((l) => l.id !== loan.id))}
                    aria-label={`Remove ${loan.label}`}
                    className="focus-ring shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-critical-soft hover:text-critical-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showLoanForm ? (
            <LoanForm
              onCancel={() => setShowLoanForm(false)}
              onAdd={(loan) => {
                setLoans((prev) => [...prev, loan]);
                setShowLoanForm(false);
              }}
            />
          ) : null}

          {!loans.length && !showLoanForm ? (
            <p className="rounded-xl border border-dashed border-canvas-line px-3 py-2.5 text-xs text-ink-faint">
              No loans added. Your built-in rent and vehicle EMI are already included automatically.
            </p>
          ) : null}
        </div>

        {/* -------------------------------------------------------- goals */}
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-600 uppercase tracking-[0.06em] text-ink-muted">
              <Target className="h-3.5 w-3.5" aria-hidden />
              Savings goals
            </p>
            {goals.length < 3 && !showGoalForm ? (
              <button
                type="button"
                onClick={() => setShowGoalForm(true)}
                className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-600 text-brand-300 transition-colors hover:text-brand-200"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add a goal
              </button>
            ) : null}
          </div>

          {goals.length ? (
            <ul className="mb-3 space-y-2">
              {goals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-canvas-line bg-canvas-raised px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-600 text-ink">{goal.label}</p>
                    <p className="text-xs text-ink-muted">
                      <span className="tnum">₹{goal.target_amount.toLocaleString('en-IN')}</span> by{' '}
                      {goal.target_date}
                      {goal.saved_so_far > 0 ? ` · ₹${goal.saved_so_far.toLocaleString('en-IN')} saved` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoals((prev) => prev.filter((g) => g.id !== goal.id))}
                    aria-label={`Remove ${goal.label}`}
                    className="focus-ring shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-critical-soft hover:text-critical-ink"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {showGoalForm ? (
            <GoalForm
              onCancel={() => setShowGoalForm(false)}
              onAdd={(goal) => {
                setGoals((prev) => [...prev, goal]);
                setShowGoalForm(false);
              }}
            />
          ) : null}

          {!goals.length && !showGoalForm ? (
            <p className="rounded-xl border border-dashed border-canvas-line px-3 py-2.5 text-xs text-ink-faint">
              No goals added yet — you can always plan a scenario later from Stress Test instead.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row">
        <Button variant="secondary" className="sm:flex-1" onClick={() => finish(false)}>
          Skip for now
        </Button>
        <Button
          variant="primary"
          className="sm:flex-1"
          onClick={() => finish(true)}
          iconRight={<Sparkles className="h-4 w-4" aria-hidden />}
        >
          {loans.length || goals.length ? 'Finish with these' : 'Finish'}
        </Button>
      </div>
    </StepShell>
  );
}

/* --------------------------------------------------------------- loan form */

function LoanForm({ onAdd, onCancel }: { onAdd: (loan: UserLoanInput) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [emi, setEmi] = useState('');
  const [dueDay, setDueDay] = useState('5');
  const [endDate, setEndDate] = useState('');
  const idPrefix = useId();

  const emiValue = Number(emi);
  const dueDayValue = Number(dueDay);
  const canAdd = label.trim().length > 0 && emiValue > 0 && dueDayValue >= 1 && dueDayValue <= 28;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    onAdd({
      id: makeId(),
      label: label.trim(),
      emi_amount: Math.round(emiValue),
      due_day_of_month: Math.round(dueDayValue),
      end_date: endDate || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl border border-brand-400/25 bg-brand-900/10 p-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Loan name" htmlFor={`${idPrefix}-label`} className="col-span-2">
          <input
            id={`${idPrefix}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Personal loan"
            maxLength={30}
            className={inputClass}
          />
        </Field>
        <Field label="EMI amount (₹/month)" htmlFor={`${idPrefix}-emi`}>
          <input
            id={`${idPrefix}-emi`}
            type="number"
            min={1}
            inputMode="numeric"
            value={emi}
            onChange={(e) => setEmi(e.target.value)}
            placeholder="3500"
            className={inputClass}
          />
        </Field>
        <Field label="Due day of month" htmlFor={`${idPrefix}-day`}>
          <input
            id={`${idPrefix}-day`}
            type="number"
            min={1}
            max={28}
            inputMode="numeric"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Ends on (optional)" htmlFor={`${idPrefix}-end`} className="col-span-2">
          <input
            id={`${idPrefix}-end`}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={todayISO()}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!canAdd} className="flex-1">
          Add loan
        </Button>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------- goal form */

function GoalForm({ onAdd, onCancel }: { onAdd: (goal: UserGoalInput) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [savedSoFar, setSavedSoFar] = useState('');
  const idPrefix = useId();

  const amountValue = Number(amount);
  const canAdd = label.trim().length > 0 && amountValue > 0 && date.length > 0 && date > todayISO();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    onAdd({
      id: makeId(),
      label: label.trim(),
      target_amount: Math.round(amountValue),
      target_date: date,
      saved_so_far: Math.max(0, Math.round(Number(savedSoFar) || 0)),
      created_date: todayISO(),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl border border-brand-400/25 bg-brand-900/10 p-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Goal name" htmlFor={`${idPrefix}-label`} className="col-span-2">
          <input
            id={`${idPrefix}-label`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. New phone"
            maxLength={30}
            className={inputClass}
          />
        </Field>
        <Field label="Target amount (₹)" htmlFor={`${idPrefix}-amount`}>
          <input
            id={`${idPrefix}-amount`}
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="15000"
            className={inputClass}
          />
        </Field>
        <Field label="Already saved (₹)" htmlFor={`${idPrefix}-saved`}>
          <input
            id={`${idPrefix}-saved`}
            type="number"
            min={0}
            inputMode="numeric"
            value={savedSoFar}
            onChange={(e) => setSavedSoFar(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </Field>
        <Field label="Save this much by" htmlFor={`${idPrefix}-date`} className="col-span-2">
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={todayISO()}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!canAdd} className="flex-1">
          Add goal
        </Button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------- form bits */

const inputClass =
  'w-full rounded-lg border border-canvas-line bg-canvas-card px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-400/60';

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-2xs font-600 text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
