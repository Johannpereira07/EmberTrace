/**
 * EmberTrace – Controls panel (APP-4 + APP-5)
 * Person 4: App & Map Lead
 *
 * - Lat/lon bbox form in two-way sync with the map
 * - Start / end month pickers clamped to coverage
 * - "Full record" reset
 * - Query button that triggers the API call
 */

import React, { useState, useEffect } from 'react';
import { useAppState, AoiBbox } from '../../app/store';
import { fetchCalendar, ApiError } from '../../api/client';

const inputStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 6,
  color: '#e2e8f0',
  padding: '6px 10px',
  width: '100%',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#94a3b8',
  marginBottom: 3,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

function CoordInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | '';
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        style={inputStyle}
        value={value}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}

export function ControlsPanel() {
  const { state, dispatch } = useAppState();

  // Local form state mirrors store; syncs to map via dispatch
  const [form, setForm] = useState<AoiBbox>({
    min_lat: state.aoi?.min_lat ?? 20.8,
    max_lat: state.aoi?.max_lat ?? 21.6,
    min_lon: state.aoi?.min_lon ?? 78.5,
    max_lon: state.aoi?.max_lon ?? 79.5,
  });

  // Sync form when map rectangle changes
  useEffect(() => {
    if (state.aoi) setForm(state.aoi);
  }, [state.aoi]);

  function updateForm(key: keyof AoiBbox, val: number) {
    const updated = { ...form, [key]: val };
    setForm(updated);
    dispatch({ type: 'SET_AOI', aoi: updated });
  }

  const coverage = state.meta?.coverage;
  const startMin = coverage?.first_month ?? '2000-11';
  const endMax = coverage?.last_month ?? '2026-11';

  async function handleQuery() {
    if (!state.aoi) return;
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await fetchCalendar({
        aoi: { type: 'bbox', ...state.aoi },
        start_month: state.startMonth ?? undefined,
        end_month: state.endMonth ?? undefined,
      });
      dispatch({ type: 'FETCH_SUCCESS', data });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        dispatch({ type: 'FETCH_ERROR', code: err.code, message: err.message });
      } else {
        dispatch({ type: 'FETCH_ERROR', code: 'UNKNOWN', message: 'An unexpected error occurred.' });
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Bbox inputs */}
      <section aria-label="Area of interest">
        <p style={{ ...labelStyle, fontSize: 12, marginBottom: 8 }}>Area of Interest</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CoordInput label="Min Lat" value={form.min_lat} min={-90} max={form.max_lat} step={0.01} onChange={(v) => updateForm('min_lat', v)} />
          <CoordInput label="Max Lat" value={form.max_lat} min={form.min_lat} max={90} step={0.01} onChange={(v) => updateForm('max_lat', v)} />
          <CoordInput label="Min Lon" value={form.min_lon} min={-180} max={form.max_lon} step={0.01} onChange={(v) => updateForm('min_lon', v)} />
          <CoordInput label="Max Lon" value={form.max_lon} min={form.min_lon} max={180} step={0.01} onChange={(v) => updateForm('max_lon', v)} />
        </div>
      </section>

      {/* Date range */}
      <section aria-label="Date range">
        <p style={{ ...labelStyle, fontSize: 12, marginBottom: 8 }}>Date Range</p>
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          <div>
            <label style={labelStyle}>Start month</label>
            <input
              type="month"
              style={inputStyle}
              value={state.startMonth ?? startMin}
              min={startMin}
              max={state.endMonth ?? endMax}
              aria-label="Start month"
              onChange={(e) => dispatch({ type: 'SET_DATE_RANGE', startMonth: e.target.value || null, endMonth: state.endMonth })}
            />
          </div>
          <div>
            <label style={labelStyle}>End month</label>
            <input
              type="month"
              style={inputStyle}
              value={state.endMonth ?? endMax}
              min={state.startMonth ?? startMin}
              max={endMax}
              aria-label="End month"
              onChange={(e) => dispatch({ type: 'SET_DATE_RANGE', startMonth: state.startMonth, endMonth: e.target.value || null })}
            />
          </div>
          <button
            onClick={() => dispatch({ type: 'RESET_DATE_RANGE' })}
            style={{ background: 'transparent', border: '1px solid #475569', borderRadius: 6, color: '#94a3b8', padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}
            aria-label="Reset to full record"
          >
            Full record
          </button>
        </div>
      </section>

      {/* Query button */}
      <button
        onClick={handleQuery}
        disabled={!state.aoi || state.status === 'loading'}
        aria-label="Query fire data"
        style={{
          background: state.aoi ? '#dc2626' : '#374151',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 600,
          cursor: state.aoi ? 'pointer' : 'not-allowed',
          opacity: state.status === 'loading' ? 0.7 : 1,
        }}
      >
        {state.status === 'loading' ? 'Loading…' : '🔥 Query Fire Data'}
      </button>
    </div>
  );
}
