/**
 * EmberTrace – API client (APP-2)
 * Person 4: App & Map Lead
 *
 * Set VITE_USE_MOCKS=true in .env.local to run entirely on fixture JSON files.
 * One environment variable is the ONLY thing that separates mock from live.
 */

import type {
  MetaResponse,
  CalendarResponse,
  CalendarRequest,
  ErrorResponse,
} from '../../../contracts/api/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const USE_MOCKS = _env.VITE_USE_MOCKS === 'true';
const API_BASE: string = _env.VITE_API_BASE ?? '';

// ---- Error handling ----

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  let body: ErrorResponse;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('NETWORK_ERROR', `HTTP ${res.status}: ${res.statusText}`);
  }
  throw new ApiError(body.error.code, body.error.message, body.error.details as Record<string, unknown>);
}

// ---- GET /api/meta ----

export async function fetchMeta(): Promise<MetaResponse> {
  if (USE_MOCKS) {
    const mod = await import('../../../contracts/fixtures/meta.json');
    return mod.default as unknown as MetaResponse;
  }
  const res = await fetch(`${API_BASE}/api/meta`);
  return handleResponse<MetaResponse>(res);
}

// ---- POST /api/calendar ----

export async function fetchCalendar(req: CalendarRequest): Promise<CalendarResponse> {
  if (USE_MOCKS) {
    const mod = await import('../../../contracts/fixtures/normal.json');
    return mod.default as unknown as CalendarResponse;
  }
  const res = await fetch(`${API_BASE}/api/calendar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return handleResponse<CalendarResponse>(res);
}

// ---- POST /api/download/monthly.csv ----

export async function downloadMonthlyCsv(req: CalendarRequest, filename: string): Promise<void> {
  if (USE_MOCKS) {
    // In mock mode, synthesise a minimal CSV from the fixture
    const data = await fetchCalendar(req);
    const header = 'month,value,state,anomaly,anomaly_state,source,provisional,partial,low_count\n';
    const rows = data.months
      .map((m) =>
        [
          m.month,
          m.value ?? '',
          m.state,
          m.anomaly ?? '',
          m.anomaly_state,
          m.source ?? '',
          m.provisional,
          m.partial,
          m.low_count,
        ].join(','),
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    triggerDownload(blob, filename);
    return;
  }
  const res = await fetch(`${API_BASE}/api/download/monthly.csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) return handleResponse<never>(res);
  const blob = await res.blob();
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
