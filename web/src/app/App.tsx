/**
 * EmberTrace – Root App component (APP-1)
 * Person 4: App & Map Lead
 *
 * Layout:
 *  ┌──────────────────────────────────┐
 *  │  Header                          │
 *  ├──────────┬──────────────────────-┤
 *  │ Sidebar  │  Map (top)            │
 *  │ Controls │  Charts (bottom)      │
 *  │ Quality  │                       │
 *  │ Download │                       │
 *  └──────────┴───────────────────────┘
 */

import React, { useEffect, useRef } from 'react';
import { AppProvider, useAppState } from './store';
import { EmberMap } from '../features/map/EmberMap';
import { ControlsPanel } from '../features/controls/ControlsPanel';
import { QualityPanel } from '../features/quality/QualityPanel';
import { StatusOverlay } from '../features/quality/StatusOverlay';
import { DownloadButton } from '../features/downloads/DownloadButton';
import { ExplainerPanel } from '../features/explainer/ExplainerPanel';
import { FireCalendar } from '../features/charts/FireCalendar';
import { TopAnomalies } from '../features/insights/TopAnomalies';
import { fetchMeta } from '../api/client';
import type { ChartExportRef } from '../features/charts/types';

// ---- Chart mode toggle ----

function ChartModeToggle() {
  const { state, dispatch } = useAppState();
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {(['activity', 'anomaly'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => dispatch({ type: 'SET_CHART_MODE', mode })}
          aria-pressed={state.chartMode === mode}
          style={{
            background: state.chartMode === mode ? '#dc2626' : '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#e2e8f0',
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: state.chartMode === mode ? 700 : 400,
          }}
        >
          {mode === 'activity' ? '🔥 Activity' : '📈 Anomaly'}
        </button>
      ))}
    </div>
  );
}

// ---- Main content area (right side) ----

function MainContent() {
  const { state, dispatch } = useAppState();
  const chartRef = useRef<ChartExportRef>(null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      {/* Map */}
      <div style={{ height: 340, borderRadius: 10, overflow: 'hidden', border: '1px solid #1e293b' }}>
        <EmberMap />
      </div>

      {/* Charts area */}
      <div style={{ flex: 1, background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b', padding: 16, minHeight: 300 }}>
        {state.status !== 'success' ? (
          <StatusOverlay />
        ) : (
          <>
            <ChartModeToggle />
            <QualityPanel />
            <div style={{ marginTop: 12 }}>
              <FireCalendar
                ref={chartRef}
                response={state.calendarData}
                mode={state.chartMode}
                showProvenance={true}
                isLoading={false}
                onNoticeRequest={(topic) => dispatch({ type: 'SET_NOTICE', notice: topic })}
              />
            </div>
            <div style={{ marginTop: 20 }}>
              <TopAnomalies response={state.calendarData} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Sidebar ----

function Sidebar() {
  const { dispatch } = useAppState();

  useEffect(() => {
    fetchMeta()
      .then((meta) => dispatch({ type: 'SET_META', meta }))
      .catch(() => {/* meta is optional — controls fall back to defaults */});
  }, [dispatch]);

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflowY: 'auto',
      }}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#020617', color: '#e2e8f0' }}>
      {/* Header */}
      <header
        style={{
          padding: '10px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 22 }}>🔥</span>
        <div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>EmberTrace</span>
          <span style={{ marginLeft: 10, fontSize: 12, color: '#475569' }}>
            NASA Space Apps 2026 · Challenge 15 · MODIS + VIIRS Harmonization
          </span>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'hidden' }}>
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
