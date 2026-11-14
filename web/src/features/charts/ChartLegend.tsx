/**
 * EmberTrace - Accessible Chart Legends
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/ChartLegend.tsx
 */

import React from 'react';
import { VIRIDIS_STOPS, ANOMALY_PALETTE, SPECIAL_CELL_COLORS } from '../../styles/scales';

interface LegendProps {
  type: 'activity' | 'anomaly';
  maxCount?: number;
  className?: string;
  onNoticeClick?: (topic: 'terra_chain' | 'provisional') => void;
}

export const ChartLegend: React.FC<LegendProps> = ({
  type,
  maxCount = 1000,
  className = '',
  onNoticeClick,
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
              <span className="text-sky-400 font-medium">0.2x (Low)</span>
              <div className="flex gap-0.5">
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.extremeLow }} title="< 0.2x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.low }} title="0.2x - 0.5x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.moderateLow }} title="0.5x - 0.8x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.nearNormalLow }} title="0.8x - 1.0x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.normal, border: '1px solid #475569' }} title="1.0x (Normal)" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.nearNormalHigh }} title="1.0x - 1.25x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.moderateHigh }} title="1.25x - 2.0x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.high }} title="2.0x - 4.0x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.extremeHigh }} title="> 4.0x" />
              </div>
              <span className="text-orange-400 font-medium">4.0x+ (High)</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-slate-400">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#a855f7',
                display: 'inline-block',
                boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)',
              }}
            />
            <button
              type="button"
              className="hover:underline text-slate-300 hover:text-purple-300 cursor-pointer"
              onClick={() => onNoticeClick?.('terra_chain')}
            >
              2000–02: Terra Chained ℹ️
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'inline-block',
                boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
              }}
            />
            <span className="text-slate-300">2002–11: Aqua Calibrated</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                display: 'inline-block',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)',
              }}
            />
            <span className="text-slate-300">2012–Now: VIIRS</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
              [P] Provisional NRT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

