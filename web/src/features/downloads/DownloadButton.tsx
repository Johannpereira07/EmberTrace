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
    <div>
      <button
        onClick={handleDownload}
        disabled={downloading}
        aria-label="Download monthly CSV"
        style={{
          background: '#0f766e',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          padding: '9px 16px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          width: '100%',
          opacity: downloading ? 0.7 : 1,
        }}
      >
        {downloading ? 'Preparing…' : '⬇ Download Monthly CSV'}
      </button>
      {error && (
        <p role="alert" style={{ color: '#fca5a5', fontSize: 12, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
