/**
 * EmberTrace – Controls panel (APP-4 + APP-5)
 * Person 4: App & Map Lead
 *
 * Modern NASA Mission Control Input Panel:
 *  - 1-Click AOI Regional Presets for quick exploration
 *  - Two-way synced Lat/Lon numeric controls
 *  - Full-width stacked temporal range selector (no truncation)
 */

import React, { useState, useEffect } from 'react';
import { useAppState, AoiBbox } from '../../app/store';
import { useCalendarQuery } from '../../app/useCalendarQuery';
import { Explain } from '../guide/Explain';

export const PRESETS: Array<{ name: string; icon: string; aoi: AoiBbox }> = [
  {
    name: 'Central India (Nagpur)',
    icon: '🌾',
    aoi: { min_lat: 20.8, max_lat: 21.6, min_lon: 78.5, max_lon: 79.5 },
  },
  {
    name: 'North-West (Punjab)',
    icon: '🚜',
    aoi: { min_lat: 29.8, max_lat: 31.5, min_lon: 74.8, max_lon: 76.5 },
  },
  {
    name: 'Western Ghats',
    icon: '🌲',
    aoi: { min_lat: 12.0, max_lat: 13.8, min_lon: 75.2, max_lon: 76.4 },
  },
];

function CoordInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number | '';
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-slate-600 font-mono text-[9px]">{unit}</span>
      </label>
      <input
        type="number"
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition shadow-inner"
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
  const runQuery = useCalendarQuery();

  const [form, setForm] = useState<AoiBbox>({
    min_lat: state.aoi?.min_lat ?? 20.8,
    max_lat: state.aoi?.max_lat ?? 21.6,
    min_lon: state.aoi?.min_lon ?? 78.5,
    max_lon: state.aoi?.max_lon ?? 79.5,
  });

  useEffect(() => {
    if (state.aoi) setForm(state.aoi);
  }, [state.aoi]);

  function updateForm(key: keyof AoiBbox, val: number) {
    const updated = { ...form, [key]: val };
    setForm(updated);
    dispatch({ type: 'SET_AOI', aoi: updated });
  }

  // A preset is a one-click demo: select it and run the query straight away.
  function applyPreset(presetAoi: AoiBbox) {
    setForm(presetAoi);
    dispatch({ type: 'SET_AOI', aoi: presetAoi });
    runQuery(presetAoi);
  }

  const coverage = state.meta?.coverage;
  const startMin = coverage?.first_month ?? '2000-11';
  const endMax = coverage?.last_month ?? '2026-11';

  async function handleQuery() {
    if (state.aoi) await runQuery(state.aoi);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Quick AOI Presets */}
      <section data-tour="regions">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick Regions
          </span>
          <span className="text-[10px] text-slate-500 font-medium">One click to load</span>
        </div>
        <Explain topic="regions" className="mb-2" />
        <div className="grid grid-cols-1 gap-1.5">
          {PRESETS.map((p) => {
            const isSelected =
              state.aoi?.min_lat === p.aoi.min_lat &&
              state.aoi?.max_lat === p.aoi.max_lat &&
              state.aoi?.min_lon === p.aoi.min_lon;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p.aoi)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition flex items-center justify-between cursor-pointer border ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-semibold shadow-sm'
                    : 'bg-slate-950/40 hover:bg-slate-900 border-slate-800/80 text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">0.25°</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Manual Coordinates Grid */}
      <section aria-label="Area of interest">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Bounding Box Coordinates
          </span>
          <span className="text-[10px] text-cyan-400 font-mono">WGS-84</span>
        </div>
        <Explain topic="bbox" className="mb-2" />
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 shadow-inner">
          <CoordInput label="Min Lat" value={form.min_lat} min={-90} max={form.max_lat} step={0.01} unit="°N" onChange={(v) => updateForm('min_lat', v)} />
          <CoordInput label="Max Lat" value={form.max_lat} min={form.min_lat} max={90} step={0.01} unit="°N" onChange={(v) => updateForm('max_lat', v)} />
          <CoordInput label="Min Lon" value={form.min_lon} min={-180} max={form.max_lon} step={0.01} unit="°E" onChange={(v) => updateForm('min_lon', v)} />
          <CoordInput label="Max Lon" value={form.max_lon} min={form.min_lon} max={180} step={0.01} unit="°E" onChange={(v) => updateForm('max_lon', v)} />
        </div>
      </section>

      {/* Timeline Date Range (Full Width, Zero Truncation) */}
      <section aria-label="Date range" data-tour="timeline">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Analysis Timeline
          </span>
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET_DATE_RANGE' })}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded transition cursor-pointer hover:bg-cyan-950/30"
          >
            Full Record (26y)
          </button>
        </div>
        <Explain topic="timeline" className="mb-2" />
        <div className="flex flex-col gap-2.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 shadow-inner">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 w-14">
              Start
            </label>
            <input
              type="month"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 transition min-w-0"
              value={state.startMonth ?? startMin}
              min={startMin}
              max={state.endMonth ?? endMax}
              onChange={(e) => dispatch({ type: 'SET_DATE_RANGE', startMonth: e.target.value || null, endMonth: state.endMonth })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 w-14">
              End
            </label>
            <input
              type="month"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 transition min-w-0"
              value={state.endMonth ?? endMax}
              min={state.startMonth ?? startMin}
              max={endMax}
              onChange={(e) => dispatch({ type: 'SET_DATE_RANGE', startMonth: state.startMonth, endMonth: e.target.value || null })}
            />
          </div>
        </div>
      </section>

      {/* Action Button */}
      <button
        onClick={handleQuery}
        disabled={!state.aoi || state.status === 'loading'}
        aria-label="Query fire data"
        className={`w-full py-3.5 px-5 rounded-2xl font-bold text-xs tracking-wider uppercase shadow-xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] ${
          state.aoi && state.status !== 'loading'
            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white shadow-red-950/50 hover:shadow-red-900/60 hover:-translate-y-0.5'
            : 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
        }`}
      >
        {state.status === 'loading' ? (
          <>
            <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span>Harmonizing Multi-Sensor Data...</span>
          </>
        ) : (
          <>
            <span className="text-base">🔥</span>
            <span>Query Harmonized Fires</span>
          </>
        )}
      </button>
    </div>
  );
}
