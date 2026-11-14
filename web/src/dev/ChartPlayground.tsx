/**
 * EmberTrace - CHT-1 Chart Playground Page
 * Person 5 (Charts Engineer)
 * Path: web/src/dev/ChartPlayground.tsx
 * 
 * Standalone dev page exercising FireCalendar, CalendarHeatmap,
 * AnomalyHeatmap, TopAnomalies, and exportChart with H4 props.
 */

import React, { useState, useRef } from 'react';
import { FireCalendar, exportChart } from '../features/charts/FireCalendar';
import { TopAnomalies } from '../features/insights/TopAnomalies';
import { GridCell, ChartExportRef, NoticeTopic, CalendarApiResponse } from '../features/charts/types';
import { generateNormalResponse, generateSparseResponse, generateEdgeCasesResponse } from './makeResponse';
import { formatCount, formatAnomaly } from '../styles/scales';

export const ChartPlayground: React.FC = () => {
  const [datasetType, setDatasetType] = useState<'normal' | 'sparse' | 'edge'>('normal');
  const [chartMode, setChartMode] = useState<'activity' | 'anomaly'>('activity');

  const [hoveredCell, setHoveredCell] = useState<GridCell | null>(null);
  const [selectedCell, setSelectedCell] = useState<GridCell | null>(null);
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [showMedianRow, setShowMedianRow] = useState<boolean>(true);
  const [activeNotice, setActiveNotice] = useState<NoticeTopic | null>(null);

  const chartRef = useRef<ChartExportRef | null>(null);

  const activeResponse: CalendarApiResponse = React.useMemo(() => {
    switch (datasetType) {
      case 'sparse':
        return generateSparseResponse();
      case 'edge':
        return generateEdgeCasesResponse();
      case 'normal':
      default:
        return generateNormalResponse();
    }
  }, [datasetType]);

  const handleExportSvg = () => {
    chartRef.current?.exportSvg(`embertrace-${chartMode}-${datasetType}.svg`);
  };

  const handleExportPng = () => {
    chartRef.current?.exportPng(`embertrace-${chartMode}-${datasetType}.png`, 2);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Banner */}
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-rose-600 text-white">
                  NASA Space Apps 2026 • Challenge 15
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  CHT-1 Playground
                </span>
                <a
                  href="https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/?tab=resources"
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 transition flex items-center gap-1"
                >
                  🌐 NASA Challenge Resources ↗
                </a>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-2 tracking-tight">
                EmberTrace: Harmonized Burning Activity Calendar
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Role 5 (Charts Engineer) Component Playground • Verifying 313 months (Nov 2000 – Nov 2026) across sensor handovers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportSvg}
                className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
              >
                📥 Export SVG
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition"
              >
                📸 Export 2x PNG
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">⚠️ Demonstration Data Notice:</span>
              <span>
                All counts and anomaly metrics are synthetic fixtures conforming to the verified 7-stage calibration schema.
              </span>
            </div>
            <span className="text-[11px] font-mono text-amber-700">313 active months</span>
          </div>

          {activeResponse.warnings?.some((w) => w.code === 'LOW_COUNT') && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
              <span className="font-bold">Low Count Notice:</span>
              <span>
                {activeResponse.warnings.find((w) => w.code === 'LOW_COUNT')?.message}
              </span>
            </div>
          )}
        </header>

        {/* Controls Toolbar */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mode:</span>
            <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setChartMode('activity')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  chartMode === 'activity'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔥 Activity Count (Viridis)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('anomaly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                  chartMode === 'anomaly'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Anomaly Ratio (Blue-Orange)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Test Mock:</span>
            <div className="inline-flex rounded-lg p-1 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setDatasetType('normal')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  datasetType === 'normal' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                }`}
              >
                Normal Area (313 mo)
              </button>
              <button
                type="button"
                onClick={() => setDatasetType('sparse')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  datasetType === 'sparse' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                }`}
              >
                Sparse (Zero Hollow)
              </button>
              <button
                type="button"
                onClick={() => setDatasetType('edge')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  datasetType === 'edge' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
                }`}
              >
                Edge Cases (Gaps/Spike)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Handover Lines (02 & 12)
            </label>
            {chartMode === 'activity' && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={showMedianRow}
                  onChange={(e) => setShowMedianRow(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Median Summary Row
              </label>
            )}
          </div>
        </section>

        {/* Unified FireCalendar Component (Exercising H4 Contract) */}
        <main>
          <FireCalendar
            ref={chartRef}
            response={activeResponse}
            mode={chartMode}
            showProvenance={showMarkers}
            showMedianRow={showMedianRow}
            selectedYear={selectedCell?.year}
            selectedMonth={selectedCell?.month}
            onCellClick={(cell) => setSelectedCell(cell)}
            onCellHover={(cell) => setHoveredCell(cell)}
            onNoticeRequest={(topic) => setActiveNotice(topic)}
          />
        </main>

        {/* Top Anomalies Insight Ranking (CHT-9) */}
        <section>
          <TopAnomalies
            response={activeResponse}
            limit={5}
          />
        </section>

        {/* Cell Inspector / Details Footer */}
        <footer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              Inspecting Month (Hovered / Selected)
            </h3>
            {hoveredCell || selectedCell ? (
              <div className="space-y-1.5">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-slate-500">Period:</span>
                  <span className="font-semibold text-slate-900">
                    {(hoveredCell || selectedCell)?.monthStr}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-slate-500">Harmonized Fire Count:</span>
                  <span className="font-semibold text-slate-900">
                    {formatCount((hoveredCell || selectedCell)?.value)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-slate-500">Anomaly vs Median:</span>
                  <span className="font-semibold text-indigo-700">
                    {formatAnomaly((hoveredCell || selectedCell)?.anomaly)}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-slate-500">Observing Source:</span>
                  <span className="font-semibold text-purple-700">
                    {(hoveredCell || selectedCell)?.source ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Flags:</span>
                  <span className="text-slate-700">
                    {(hoveredCell || selectedCell)?.isProvisional ? '• Provisional NRT ' : ''}
                    {(hoveredCell || selectedCell)?.isPartial ? '• Partial Month' : ''}
                    {!(hoveredCell || selectedCell)?.isProvisional && !(hoveredCell || selectedCell)?.isPartial ? 'None' : ''}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 italic">Hover over any cell in the heatmap to inspect details.</p>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
              Role 5 Handoff & Quality Gates
            </h3>
            <ul className="space-y-1 text-slate-600 list-disc list-inside">
              <li><strong className="text-slate-800">CHT-1 Target:</strong> Delivered with agreed H4 props.</li>
              <li><strong className="text-slate-800">No Handover Jump:</strong> Handover lines marked at Jul 2002 and Jan 2012.</li>
              <li><strong className="text-slate-800">Zero Rule:</strong> 0 fire months rendered as hollow outlines.</li>
              <li><strong className="text-slate-800">SVG Watermark:</strong> Exported SVGs & PNGs contain synthetic disclaimer and AOI.</li>
            </ul>
          </div>
        </footer>

        {/* Notice Modal */}
        {activeNotice && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                {activeNotice === 'terra_chain' && 'Terra Chained Segment (Nov 2000 – Jun 2002)'}
                {activeNotice === 'provisional' && 'Provisional NRT Data (Recent Months)'}
                {activeNotice === 'low_count' && 'Low Count Statistical Warning'}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {activeNotice === 'terra_chain' &&
                  'Terra was the sole active sensor until Aqua launched in July 2002. Because Terra flew in a morning orbit and VIIRS flew in an afternoon orbit, Terra counts are chained through Aqua to achieve VIIRS equivalence. This 20-month segment carries higher uncertainty.'}
                {activeNotice === 'provisional' &&
                  'The latest 2 to 5 months are near-real-time (NRT) detections from LANCE. Science-quality archive data replaces them as it becomes available.'}
                {activeNotice === 'low_count' &&
                  'When monthly fire counts are below 10 detections, single fire events can skew anomaly ratios by 300%+. Interpret anomaly values cautiously in sparse regions.'}
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveNotice(null)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ChartPlayground;

