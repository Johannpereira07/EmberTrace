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
      className={`p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-sm ${className}`}
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {type === 'activity' ? (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800">Fire Detections:</span>
            
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  display: 'inline-block',
                  width: '14px',
                  height: '14px',
                  backgroundColor: SPECIAL_CELL_COLORS.zeroHollowFill,
                  border: `1.5px solid ${SPECIAL_CELL_COLORS.zeroOutlineStroke}`,
                  borderRadius: '2px',
                }}
              />
              <span className="text-slate-600">0 (Hollow)</span>
            </div>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-slate-500">1</span>
              <div
                style={{
                  width: '120px',
                  height: '12px',
                  borderRadius: '2px',
                  background: `linear-gradient(to right, ${VIRIDIS_STOPS.join(', ')})`,
                  border: '1px solid #cbd5e1',
                }}
                title="Square-root scaled Viridis ramp"
              />
              <span className="text-slate-700 font-medium">{Math.round(maxCount).toLocaleString()}+</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800">Anomaly vs Median:</span>
            
            <div className="flex items-center gap-1.5">
              <span className="text-blue-800 font-medium">0.2x (Low)</span>
              <div className="flex gap-0.5">
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.extremeLow }} title="< 0.2x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.low }} title="0.2x - 0.5x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.moderateLow }} title="0.5x - 0.8x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.nearNormalLow }} title="0.8x - 1.0x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.normal, border: '1px solid #cbd5e1' }} title="1.0x (Normal)" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.nearNormalHigh }} title="1.0x - 1.25x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.moderateHigh }} title="1.25x - 2.0x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.high }} title="2.0x - 4.0x" />
                <span style={{ width: '14px', height: '12px', backgroundColor: ANOMALY_PALETTE.extremeHigh }} title="> 4.0x" />
              </div>
              <span className="text-orange-800 font-medium">4.0x+ (High)</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-slate-600">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#9333ea',
                display: 'inline-block',
              }}
            />
            <button
              type="button"
              className="hover:underline text-slate-700 cursor-pointer"
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
                backgroundColor: '#2563eb',
                display: 'inline-block',
              }}
            />
            <span>2002–11: Aqua Calibrated</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#059669',
                display: 'inline-block',
              }}
            />
            <span>2012–Now: VIIRS</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-medium">
              [P] Provisional NRT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

