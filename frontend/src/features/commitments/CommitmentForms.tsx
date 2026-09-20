import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { todayISO } from '@/lib/format';
import type { UserGoalInput, UserLoanInput } from '@/api';

/**
 * The add-a-loan / add-a-goal forms, shared by the /login onboarding wizard
 * (step 3) and /app/profile's editor — one implementation, two entry points,
 * so a field added or validated here never needs doing twice.
 */
export function makeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export const inputClass =
  'w-full rounded-lg border border-canvas-line bg-canvas-card px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand-400/60';

export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
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

export function LoanForm({ onAdd, onCancel }: { onAdd: (loan: UserLoanInput) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [emi, setEmi] = useState('');
  const [dueDay, setDueDay] = useState('5');
  const [endDate, setEndDate] = useState('');
  const idPrefix = useId();

  const emiValue = Number(emi);
  const dueDayValue = Number(dueDay);
  const canAdd = label.trim().length > 0 && emiValue > 0 && dueDayValue >= 1 && dueDayValue <= 28;

  function submit(e: FormEvent) {
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

export function GoalForm({ onAdd, onCancel }: { onAdd: (goal: UserGoalInput) => void; onCancel: () => void }) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [savedSoFar, setSavedSoFar] = useState('');
  const idPrefix = useId();

  const amountValue = Number(amount);
  const canAdd = label.trim().length > 0 && amountValue > 0 && date.length > 0 && date > todayISO();

  function submit(e: FormEvent) {
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
