/**
 * EmberTrace – Data quality / warnings panel (APP-6)
 * Person 4: App & Map Lead
 *
 * Modern high-density science HUD badge display:
 *  - Persistent Demonstration Data disclaimer (per AGENTS.md)
 *  - Compact warning badges with interactive drawer for affected periods
 */

import React, { useState } from 'react';
import { useAppState } from '../../app/store';
import type { ApiWarning } from '../../../contracts/api/types';

const WARNING_CONFIG: Record<string, { label: string; icon: string; border: string; bg: string; text: string }> = {
  SYNTHETIC_DATA: { label: 'Demonstration Data', icon: '⚠️', border: 'border-amber-500/40', bg: 'bg-amber-950/40', text: 'text-amber-200' },
  SNAPPED_AOI: { label: '0.25° Grid Snapped', icon: '📐', border: 'border-sky-500/30', bg: 'bg-sky-950/30', text: 'text-sky-300' },
  CHAINED_SEGMENT: { label: 'Chained Terra (High Uncertainty)', icon: '🔗', border: 'border-purple-500/30', bg: 'bg-purple-950/30', text: 'text-purple-300' },
  PROVISIONAL: { label: 'Provisional NRT Months', icon: '⏱️', border: 'border-yellow-500/30', bg: 'bg-yellow-950/30', text: 'text-yellow-300' },
  PARTIAL_MONTH: { label: 'Partial Month', icon: '📅', border: 'border-blue-500/30', bg: 'bg-blue-950/30', text: 'text-blue-300' },
  LOW_COUNT: { label: 'Low Detection Sparse Area', icon: '🔵', border: 'border-slate-500/30', bg: 'bg-slate-800/40', text: 'text-slate-300' },
};

export function QualityPanel() {
  const { state } = useAppState();
  const [expanded, setExpanded] = useState(false);
  const data = state.calendarData;

  if (!data) return null;

  const isSynthetic = data.meta.data_kind === 'synthetic';
  const nonSyntheticWarnings = data.warnings.filter((w: ApiWarning) => w.code !== 'SYNTHETIC_DATA');

  return (
    <div aria-label="Data quality information" className="flex flex-col gap-2.5">
      {/* Demonstration Data Banner (NASA Space Apps Guideline) */}
      {isSynthetic && (
        <div
          role="alert"
          className="px-3.5 py-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/70 via-orange-950/50 to-slate-900 text-amber-200 text-xs font-semibold flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 text-sm animate-pulse">⚠️</span>
            <span>Demonstration Data: Raw counts and calibration parameters are synthetic.</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            DEMO MODE
          </span>
        </div>
      )}

      {/* Compact Alert Bar & Warning Chips */}
      {nonSyntheticWarnings.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 transition">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Data Flags:
              </span>
              {nonSyntheticWarnings.map((w: ApiWarning, i: number) => {
                const conf = WARNING_CONFIG[w.code] ?? {
                  label: w.code,
                  icon: 'ℹ️',
                  border: 'border-slate-700',
                  bg: 'bg-slate-800/50',
                  text: 'text-slate-300',
                };
                return (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border ${conf.border} ${conf.bg} ${conf.text}`}
                  >
                    <span>{conf.icon}</span>
                    <span>{conf.label}</span>
                    {w.ranges.length > 0 && (
                      <span className="ml-0.5 text-[9px] font-mono opacity-80">
                        ({w.ranges.length})
                      </span>
                    )}
                  </span>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
            >
              <span>{expanded ? 'Hide Details' : 'View Impact Details'}</span>
              <span className={`text-[9px] transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
            </button>
          </div>

          {/* Expanded Drawer */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-850 flex flex-col gap-2.5">
              {nonSyntheticWarnings.map((w: ApiWarning, i: number) => (
                <div key={i} className="text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span>{WARNING_CONFIG[w.code]?.icon ?? 'ℹ️'}</span>
                    <span>{w.message}</span>
                  </div>
                  {w.ranges.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase mr-1">
                        Affected Months:
                      </span>
                      {w.ranges.map((r: { from: string; to: string }, idx: number) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono text-[10px] border border-slate-700/50"
                        >
                          {r.from === r.to ? r.from : `${r.from} → ${r.to}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
