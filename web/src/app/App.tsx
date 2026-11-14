/**
 * EmberTrace – Root App component (APP-1)
 * Person 4: App & Map Lead
 *
 * Modern NASA Earth Science Mission Dashboard:
 *  - High-density responsive split layout
 *  - Interactive OpenStreetMap Dark Canvas satellite canvas
 *  - Harmonized MODIS & VIIRS Heatmap Calendar (Nov 2000 – Nov 2026)
 */

import React, { useEffect, useRef } from 'react';
import { AppProvider, useAppState } from './store';
import { EmberMap } from '../features/map/EmberMap';
import { ControlsPanel, PRESETS } from '../features/controls/ControlsPanel';
import { HeroStrip, formatMonth } from '../features/overview/HeroStrip';
import { useCalendarQuery } from './useCalendarQuery';
import { QualityPanel } from '../features/quality/QualityPanel';
import { StatusOverlay } from '../features/quality/StatusOverlay';
import { DownloadButton } from '../features/downloads/DownloadButton';
import { ExplainerPanel } from '../features/explainer/ExplainerPanel';
import { FireCalendar } from '../features/charts/FireCalendar';
import { TopAnomalies } from '../features/insights/TopAnomalies';
import { fetchMeta } from '../api/client';
import type { ChartExportRef } from '../features/charts/types';
import type { CalendarResponse } from '../../../contracts/api/types';

// ---- Chart Mode Segmented Controller ----

function ChartModeToggle() {
  const { state, dispatch } = useAppState();
  return (
    <div className="inline-flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
      {(['activity', 'anomaly'] as const).map((mode) => {
        const isActive = state.chartMode === mode;
        return (
          <button
            key={mode}
            onClick={() => dispatch({ type: 'SET_CHART_MODE', mode })}
            aria-pressed={isActive}
            className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all duration-200 flex items-center gap-2 cursor-pointer ${isActive
              ? mode === 'activity'
                ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-950/60'
                : 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-lg shadow-indigo-950/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
          >
            <span className="text-sm">{mode === 'activity' ? '🔥' : '📈'}</span>
            <span>{mode === 'activity' ? 'Raw Fire Activity' : 'Baseline Anomalies'}</span>
          </button>
        );
      })}
    </div>
  );
}

function coverageLabel(data: CalendarResponse | null): string {
  if (!data || data.months.length === 0) return '';
  const first = data.months[0].month;
  const last = data.months[data.months.length - 1].month;
  return `${data.months.length} months · ${formatMonth(first)} – ${formatMonth(last)} · ${data.meta.n_cells} cells`;
}

// ---- Main content area (right side) ----

function MainContent() {
  const { state, dispatch } = useAppState();
  const chartRef = useRef<ChartExportRef>(null);

  return (
    <main className="flex-1 flex flex-col gap-6 min-w-0 overflow-y-auto pr-1">
      {/* Pitch + map side by side on wide screens, so the calendar starts higher up */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 shrink-0">
        <div className="xl:col-span-3 flex">
          <HeroStrip />
        </div>
        <div className="xl:col-span-2 h-80 xl:h-auto min-h-[300px] rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl bg-slate-950 relative">
          <EmberMap />
        </div>
      </div>

      {/* Charts & Insights Container */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-5 md:p-6 flex flex-col gap-6 shadow-2xl shrink-0">
        {state.status !== 'success' ? (
          <StatusOverlay />
        ) : (
          <>
            {/* Header controls strip */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800/80 shrink-0">
              <ChartModeToggle />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{coverageLabel(state.calendarData)}</span>
              </div>
            </div>

            {/* Quality and warnings ribbon */}
            <QualityPanel />

            {/* Heatmap Section */}
            <div className="w-full shrink-0">
              <FireCalendar
                ref={chartRef}
                response={state.calendarData}
                mode={state.chartMode}
                showProvenance={true}
                isLoading={false}
                onNoticeRequest={(topic) => dispatch({ type: 'SET_NOTICE', notice: topic })}
              />
            </div>

            {/* Top Historical Anomalies */}
            <div className="shrink-0">
              <TopAnomalies response={state.calendarData} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ---- Sidebar ----

function Sidebar() {
  const { state, dispatch } = useAppState();
  const runQuery = useCalendarQuery();
  const autoLoaded = useRef(false);

  useEffect(() => {
    fetchMeta()
      .then((meta) => dispatch({ type: 'SET_META', meta }))
      .catch(() => { });
  }, [dispatch]);

  // First visit: load the first preset so the calendar is on screen straight away,
  // instead of an empty panel asking the user to draw something.
  useEffect(() => {
    if (!state.meta || state.aoi || autoLoaded.current) return;
    autoLoaded.current = true;
    dispatch({ type: 'SET_AOI', aoi: PRESETS[0].aoi });
    runQuery(PRESETS[0].aoi);
  }, [state.meta, state.aoi, dispatch, runQuery]);

  return (
    <aside
      className="w-full lg:w-84 shrink-0 bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-5 shadow-2xl overflow-y-auto"
      aria-label="Controls sidebar"
    >
      <ControlsPanel />
      <DownloadButton />
      <ExplainerPanel />
    </aside>
  );
}

// ---- App shell ----

function AppShell() {
  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Header */}
      <header className="px-6 py-3.5 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md flex items-center justify-between shrink-0 z-10 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-lg shadow-lg shadow-red-950/60">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-extrabold text-lg tracking-tight text-white">
                EmberTrace
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                NASA Space Apps 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Challenge 15: Cross-Sensor Harmonization of MODIS & VIIRS Hot Spots
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <a href="#" className="text-xs text-slate-300 hover:text-white underline underline-offset-4 decoration-slate-600">
            How it works
          </a>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400" /> Terra
            <span className="text-slate-600">→</span>
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Aqua
            <span className="text-slate-600">→</span>
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> VIIRS
          </div>
        </div>
      </header>

      {/* Main Responsive Grid/Flex Body */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5 p-4 md:p-5 overflow-auto lg:overflow-hidden min-h-0">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
