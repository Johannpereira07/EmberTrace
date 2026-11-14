/**
 * EmberTrace – CSV download button (APP-8)
 * Person 4: App & Map Lead
 */

import React, { useState } from 'react';
import { useAppState } from '../../app/store';
import { downloadMonthlyCsv, ApiError } from '../../api/client';

export function DownloadButton() {
  const { state } = useAppState();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== 'success' || !state.aoi || !state.calendarData) return null;

  async function handleDownload() {
    if (!state.aoi) return;
    setDownloading(true);
    setError(null);
    try {
      const aoi = state.aoi;
      const start = state.startMonth ?? state.meta?.coverage.first_month ?? '';
      const end = state.endMonth ?? state.meta?.coverage.last_month ?? '';
      const filename = `embertrace_${aoi.min_lat}-${aoi.max_lat}_${aoi.min_lon}-${aoi.max_lon}_${start}_to_${end}.csv`;
      await downloadMonthlyCsv(
        { aoi: { type: 'bbox', ...aoi }, start_month: state.startMonth ?? undefined, end_month: state.endMonth ?? undefined },
        filename,
      );
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="pt-2 border-t border-slate-850">
      <button
        onClick={handleDownload}
        disabled={downloading}
        aria-label="Download monthly CSV"
        className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <span>{downloading ? '⏳' : '📥'}</span>
        <span>{downloading ? 'Generating CSV...' : 'Download Monthly CSV'}</span>
      </button>
      {error && (
        <p role="alert" className="text-rose-400 text-xs mt-2 text-center font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
