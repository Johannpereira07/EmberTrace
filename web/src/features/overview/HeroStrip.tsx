/**
 * EmberTrace – first-screen pitch and key facts.
 * Every number comes from /api/meta; nothing here is hard-coded data.
 */

import React from 'react';
import { useAppState } from '../../app/store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatMonth(m: string): string {
  const [y, mm] = m.split('-');
  return `${MONTHS[Number(mm) - 1]} ${y}`;
}

function formatDay(d: string): string {
  const [y, mm, dd] = d.split('-');
  return `${Number(dd)} ${MONTHS[Number(mm) - 1]} ${y}`;
}

function yearsBetween(first: string, last: string): number {
  const [y0, m0] = first.split('-').map(Number);
  const [y1, m1] = last.split('-').map(Number);
  return Math.floor(((y1 - y0) * 12 + (m1 - m0) + 1) / 12);
}

function Tile({ label, value, detail }: { label: string; value: React.ReactNode; detail: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800/80 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-lg font-semibold text-slate-50 leading-tight">{value}</span>
      <span className="text-[11px] text-slate-400">{detail}</span>
    </div>
  );
}

// Same epoch colours as the calendar's provenance markers (charts/AGENTS.md), always with a text label.
const SENSORS = [
  { name: 'Terra', dot: 'bg-purple-400' },
  { name: 'Aqua', dot: 'bg-blue-400' },
  { name: 'VIIRS', dot: 'bg-emerald-400' },
];

export function HeroStrip() {
  const { state } = useAppState();
  const meta = state.meta;
  const years = meta ? yearsBetween(meta.coverage.first_month, meta.coverage.last_month) : null;
  const synthetic = meta?.data_kind === 'synthetic';

  return (
    <section
      aria-labelledby="hero-title"
      className="relative w-full overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/40 p-5 md:p-6 shrink-0"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full bg-orange-500/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-2 max-w-3xl">
          <h1 id="hero-title" className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Is fire activity unusual here?
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {years ? `${years} years` : 'Two decades'} of NASA satellite fire detections on one scale. MODIS and
            VIIRS count fires differently, so we convert the older record to VIIRS-equivalent counts: a change
            in the calendar is a change in fires, not a change of satellite.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Tile
            label="Record"
            value={years ? `${years} years` : '…'}
            detail={meta ? `${formatMonth(meta.coverage.first_month)} – ${formatMonth(meta.coverage.last_month)} · to ${formatDay(meta.data_through)}` : 'Loading'}
          />
          <Tile
            label="Satellite series"
            value={
              <span className="flex flex-wrap items-center gap-x-1.5 text-base">
                {SENSORS.map((s, i) => (
                  <span key={s.name} className="inline-flex items-center gap-1.5">
                    {i > 0 && <span className="text-slate-600" aria-hidden="true">→</span>}
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} aria-hidden="true" />
                    {s.name}
                  </span>
                ))}
              </span>
            }
            detail="One VIIRS-equivalent series"
          />
          <Tile
            label="Grid"
            value={meta ? `${meta.cell_size_deg}° cells` : '…'}
            detail="Monthly counts per cell"
          />
          <Tile
            label={synthetic ? 'Demonstration data' : 'Data'}
            value={
              <span className={synthetic ? 'text-amber-300' : undefined}>
                {meta ? (synthetic ? 'Synthetic' : 'NASA FIRMS') : '…'}
              </span>
            }
            detail={meta ? `Pipeline v${meta.pipeline_version}` : 'Loading'}
          />
        </div>
      </div>
    </section>
  );
}
