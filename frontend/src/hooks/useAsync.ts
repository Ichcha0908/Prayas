import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** True only on the very first load, so refetches don't flash skeletons. */
  initialLoading: boolean;
  reload: () => void;
}

/**
 * Small async-data hook: loading / error / data with cancellation on unmount
 * and a stable `reload`. Refetches keep the previous data on screen so that
 * moving a slider doesn't blank the charts.
 */
export function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const hasLoaded = useRef(false);

  // Keep the latest fn without making it a dependency of the effect.
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);

    fnRef
      .current(controller.signal)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
        hasLoaded.current = true;
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setError(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Something went wrong while loading this data.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, initialLoading: loading && !hasLoaded.current, reload };
}
