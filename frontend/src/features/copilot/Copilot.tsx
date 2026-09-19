import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CloudSun, Send, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import type { ChatResponse } from '@/api/types';
import { useAppData } from '@/hooks/useAppData';
import { cn } from '@/lib/cn';
import { ProvenanceChip } from '@/components/ui';
import { CloseButton } from '@/components/layout/AppShell';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatResponse['citations'];
  route?: string | null;
  followUps?: string[];
}

const STARTERS = [
  'How much will I earn next week?',
  'Why is my risk high?',
  'How much should I keep as a buffer?',
  'Will Diwali be a good week for me?',
  'When should I save more?',
  'What happens if my income drops 20%?',
  'What is my worst projected day?',
  'Which expenses are putting pressure on my buffer?',
];

/** Renders the markdown-lite the backend returns: **bold** and line breaks. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={cn('text-sm leading-relaxed', i > 0 && 'mt-2')}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={j} className="tnum font-600 text-ink">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

export function Copilot({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { driverId, scenarios } = useAppData();
  const navigate = useNavigate();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 220);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    const userTurn: Turn = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setPending(true);

    try {
      const res = await api.postChat({
        driver_id: driverId,
        message: trimmed,
        history: turns.slice(-6).map((t) => ({ role: t.role, content: t.content })),
        scenarios,
      });
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: res.reply,
          citations: res.citations,
          route: res.suggested_route,
          followUps: res.follow_ups,
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'I could not reach your forecast data just now. Please try that again in a moment.',
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-canvas/75 backdrop-blur-sm"
            aria-hidden
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Kamai assistant"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-canvas-line bg-canvas-raised shadow-lift"
          >
            <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-canvas-line px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gradient">
                  <CloudSun className="h-4 w-4 text-white" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-sm font-600 text-ink">Ask Kamai</p>
                  <p className="text-[11px] text-ink-muted">Answers from your own forecast</p>
                </div>
              </div>
              <CloseButton onClick={onClose} label="Close assistant" />
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
              {turns.length === 0 ? (
                <div>
                  <div className="rounded-2xl border border-brand-400/25 bg-brand-900/20 p-4">
                    <div className="mb-2 flex items-center gap-2 text-brand-200">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      <span className="text-xs font-600">Grounded in your data</span>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      I read your forecast, cashflow, buffer and history — not general financial advice. Ask about your
                      income outlook, shortfall risk, buffer target, saving windows or a what-if.
                    </p>
                  </div>

                  <p className="label-eyebrow mb-2 mt-5">Try asking</p>
                  <ul className="space-y-2">
                    {STARTERS.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          onClick={() => send(s)}
                          className="focus-ring group flex w-full items-center justify-between gap-3 rounded-xl border border-canvas-line bg-canvas-card px-3 py-2.5 text-left text-sm text-ink-soft transition-colors hover:border-brand-400/40 hover:text-ink"
                        >
                          <span>{s}</span>
                          <ArrowRight
                            className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-300"
                            aria-hidden
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul className="space-y-4" aria-live="polite">
                  {turns.map((t) =>
                    t.role === 'user' ? (
                      <li key={t.id} className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-gradient px-3.5 py-2.5 text-sm text-white">
                          {t.content}
                        </div>
                      </li>
                    ) : (
                      <li key={t.id}>
                        <div className="rounded-2xl rounded-bl-md border border-canvas-line bg-canvas-card px-3.5 py-3 text-ink-soft">
                          <RichText text={t.content} />

                          {t.citations?.length ? (
                            <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-canvas-line pt-3">
                              {t.citations.map((c) => (
                                <li
                                  key={c.label}
                                  className="flex items-center gap-1.5 rounded-lg bg-canvas-hover px-2 py-1"
                                >
                                  <span className="text-[10px] text-ink-muted">{c.label}</span>
                                  <span className="tnum text-[11px] font-600 text-ink">{c.value}</span>
                                  <ProvenanceChip kind={c.kind} />
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {t.route ? (
                            <button
                              type="button"
                              onClick={() => {
                                navigate(t.route as string);
                                onClose();
                              }}
                              className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-400/35 px-2.5 py-1.5 text-xs font-600 text-brand-200 transition-colors hover:bg-brand-900/30"
                            >
                              Open the details
                              <ArrowRight className="h-3 w-3" aria-hidden />
                            </button>
                          ) : null}
                        </div>

                        {t.followUps?.length ? (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {t.followUps.map((f) => (
                              <li key={f}>
                                <button
                                  type="button"
                                  onClick={() => send(f)}
                                  className="focus-ring rounded-full border border-canvas-line px-2.5 py-1 text-[11px] text-ink-muted transition-colors hover:border-brand-400/40 hover:text-ink-soft"
                                >
                                  {f}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ),
                  )}

                  {pending ? (
                    <li>
                      <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-canvas-line bg-canvas-card px-4 py-3">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-ink-muted"
                            animate={{ opacity: [0.25, 1, 0.25] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
                          />
                        ))}
                        <span className="sr-only">Thinking</span>
                      </div>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="shrink-0 border-t border-canvas-line p-3"
            >
              <div className="flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-card px-3 py-2 focus-within:border-brand-400/60">
                <label htmlFor="copilot-input" className="sr-only">
                  Ask about your income forecast
                </label>
                <input
                  id="copilot-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your week…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || pending}
                  aria-label="Send"
                  className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-white transition-opacity disabled:opacity-35"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <p className="mt-2 px-1 text-[10px] leading-relaxed text-ink-faint">
                Kamai explains your own forecast. It does not offer loans, credit or financial products.
              </p>
            </form>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
