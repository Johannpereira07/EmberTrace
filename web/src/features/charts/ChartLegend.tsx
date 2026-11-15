/**
 * EmberTrace - Accessible Chart Legends
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/ChartLegend.tsx
 */

import React from 'react';
import { VIRIDIS_STOPS, ANOMALY_STOPS, SPECIAL_CELL_COLORS } from '../../styles/scales';
import { SOURCE_INFO, formatMonthLabel } from './cellModel';
import type { SourceSpan } from './types';

interface LegendProps {
  type: 'activity' | 'anomaly';
  maxCount?: number;
  className?: string;
  onNoticeClick?: (topic: 'terra_chain' | 'provisional') => void;
  /** Sources present in the response, with their first and last month (getSourceSpans). */
  sources?: SourceSpan[];
}

export const ChartLegend: React.FC<LegendProps> = ({
  type,
  maxCount = 1000,
  className = '',
  onNoticeClick,
  sources = [],
}) => {
  return (
    <div
      className={`p-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl text-xs text-slate-300 shadow-2xl shrink-0 w-full ${className}`}
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {type === 'activity' ? (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Fire Detections:</span>
            
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#090d16',
                  border: '1.5px solid #64748b',
                  borderRadius: '2px',
                }}
              />
              <span className="text-slate-400">0 (Hollow)</span>
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-400">1</span>
              <div
                style={{
                  width: '120px',
                  height: '12px',
                  borderRadius: '2px',
                  background: `linear-gradient(to right, ${VIRIDIS_STOPS.join(', ')})`,
                  border: '1px solid #334155',
                }}
                title="Square-root scaled Viridis ramp"
              />
              <span className="text-slate-200 font-semibold">{Math.round(maxCount).toLocaleString()}+</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Anomaly vs Median:</span>
            
            <div className="flex items-center gap-1.5">
              <span className="text-sky-400 font-medium">&lt;=0.25x</span>
              <div className="flex gap-0.5">
                {ANOMALY_STOPS.map((color, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: '13px',
                      height: '12px',
                      backgroundColor: color,
                      border: idx === 4 ? '1px solid #475569' : undefined,
                    }}
                    title={idx === 4 ? '1.0x (Normal)' : undefined}
                  />
                ))}
              </div>
              <span className="text-orange-400 font-medium">&gt;=4x</span>
            </div>
          </div>
        )}

        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-slate-300" aria-label="Data sources">
          {sources.map((span) => {
            const info = SOURCE_INFO[span.source];
            const text = `${info.label}: ${formatMonthLabel(span.from)} – ${formatMonthLabel(span.to)}`;
            return (
              <li key={span.source} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: info.color, display: 'inline-block' }}
                />
                {span.source === 'TERRA_chained' && onNoticeClick ? (
                  <button
                    type="button"
                    className="hover:underline hover:text-purple-300 cursor-pointer text-left"
                    onClick={() => onNoticeClick('terra_chain')}
                  >
                    {text}
                  </button>
                ) : (
                  <span>{text}</span>
                )}
              </li>
            );
          })}
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b', display: 'inline-block' }} />
            <span>Provisional (near real-time)</span>
          </li>
          {type === 'anomaly' && (
            <>
              <li>
                <span className="font-semibold text-slate-200">n/c</span> partial month, not comparable
              </li>
              <li>
                <span className="font-semibold text-slate-200">–</span> no baseline (median 0 or too few years)
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};
