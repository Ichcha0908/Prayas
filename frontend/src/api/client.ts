/**
 * HTTP client for the KAMAI.AI backend.
 *
 * Everything the app needs in order to talk to a real server lives here:
 * base URL resolution, JSON parsing, timeouts, and a normalised error type.
 * No component ever calls fetch directly.
 */

import type { ApiEnvelopeError } from './types';

export type DataSource = 'mock' | 'live' | 'auto';

const RAW_SOURCE = (import.meta.env.VITE_DATA_SOURCE ?? 'auto') as string;

export const DATA_SOURCE: DataSource = (['mock', 'live', 'auto'] as const).includes(
  RAW_SOURCE as DataSource,
)
  ? (RAW_SOURCE as DataSource)
  : 'auto';

/** Empty base URL means same-origin `/api`, which the Vite dev proxy forwards. */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const DEMO_DRIVER_ID = import.meta.env.VITE_DEMO_DRIVER_ID ?? 'DRV-0001';

const DEFAULT_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: unknown;

  constructor(message: string, status: number, code = 'api_error', detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  /** True when the backend is simply not there — the trigger for mock fallback. */
  get isUnreachable(): boolean {
    return this.status === 0 || this.status === 502 || this.status === 503 || this.status === 504;
  }
}

function buildUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalised}`;
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'http_error';
  let message = `${res.status} ${res.statusText || 'Request failed'}`;
  let detail: unknown;
  try {
    const body = (await res.json()) as Partial<ApiEnvelopeError> & { detail?: unknown };
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      detail = body.error.detail;
    } else if (body?.detail) {
      // FastAPI's default error shape.
      detail = body.detail;
      message = typeof body.detail === 'string' ? body.detail : message;
    }
  } catch {
    /* non-JSON error body — keep the status line */
  }
  return new ApiError(message, res.status, code, detail);
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  query?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let url = buildUrl(path);
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(opts.query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('The request timed out.', 0, 'timeout');
    }
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0,
      'network_error',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const http = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, body, opts),
};

/**
 * One-shot backend reachability probe used by DATA_SOURCE === 'auto'.
 * Cached for the lifetime of the page so we probe at most once.
 */
let livePromise: Promise<boolean> | null = null;

export function isLiveBackendAvailable(): Promise<boolean> {
  if (DATA_SOURCE === 'mock') return Promise.resolve(false);
  if (DATA_SOURCE === 'live') return Promise.resolve(true);
  if (!livePromise) {
    livePromise = http
      .get<unknown>('/api/health', { timeoutMs: 2500 })
      .then(() => true)
      .catch(() => false);
  }
  return livePromise;
}

/** Test seam — lets the demo toggle force the mock engine without a reload. */
export function resetBackendProbe(): void {
  livePromise = null;
}
