import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { setGoals, setLoans, setUserName, type UserGoalInput, type UserLoanInput } from '@/api';

/**
 * Step 1 (name, required) and step 3 (loans/goals, optional) of /login.
 * Kept separate from useLocation because AppShell's "change" affordance only
 * ever needs to touch location — a driver's name and financial commitments
 * aren't something you casually swap the way you'd correct your city.
 */
interface CommitmentsState {
  name: string;
  loans: UserLoanInput[];
  goals: UserGoalInput[];
}

interface CommitmentsContextValue extends CommitmentsState {
  /** True once step 1 has been completed — the other half of the /login gate. */
  hasName: boolean;
  setName: (name: string) => void;
  /** Called once at the end of step 3, whether filled in or skipped. */
  saveCommitments: (loans: UserLoanInput[], goals: UserGoalInput[]) => void;
}

const STORAGE_KEY = 'kamai.commitments';

function readStored(): CommitmentsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { name: '', loans: [], goals: [] };
    const parsed = JSON.parse(raw) as Partial<CommitmentsState>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      loans: Array.isArray(parsed.loans) ? parsed.loans : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    };
  } catch {
    return { name: '', loans: [], goals: [] };
  }
}

function writeStored(state: CommitmentsState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* non-fatal — the session still works, it just won't persist a reload */
  }
}

const CommitmentsContext = createContext<CommitmentsContextValue | null>(null);

export function CommitmentsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CommitmentsState>(() => {
    const stored = readStored();
    // Configure the engine synchronously on first render, before any data
    // hook fires its first fetch — same reasoning as useLocation.
    if (stored.name) setUserName(stored.name);
    if (stored.loans.length) setLoans(stored.loans);
    if (stored.goals.length) setGoals(stored.goals);
    return stored;
  });

  const setName = useCallback((name: string) => {
    const trimmed = name.trim();
    setUserName(trimmed);
    setState((prev) => {
      const next = { ...prev, name: trimmed };
      writeStored(next);
      return next;
    });
  }, []);

  const saveCommitments = useCallback((loans: UserLoanInput[], goals: UserGoalInput[]) => {
    setLoans(loans);
    setGoals(goals);
    setState((prev) => {
      const next = { ...prev, loans, goals };
      writeStored(next);
      return next;
    });
  }, []);

  const value = useMemo<CommitmentsContextValue>(
    () => ({ ...state, hasName: state.name.trim().length > 0, setName, saveCommitments }),
    [state, setName, saveCommitments],
  );

  return <CommitmentsContext.Provider value={value}>{children}</CommitmentsContext.Provider>;
}

export function useCommitments(): CommitmentsContextValue {
  const ctx = useContext(CommitmentsContext);
  if (!ctx) throw new Error('useCommitments must be used inside <CommitmentsProvider>');
  return ctx;
}
