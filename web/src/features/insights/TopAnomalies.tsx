/**
 * EmberTrace - Top Active Months & Seasonal Insights (CHT-9)
 * Person 5 (Charts Engineer)
 * Path: web/src/features/insights/TopAnomalies.tsx
 * 
 * Exported as <TopMonths /> and <TopAnomalies /> per H4 Contract specification.
 * Ranks months by fire activity value (highest first), excluding unavailable months.
 */

import React from 'react';
import { CalendarApiResponse, ApiMonthData } from '../../../contracts/api/types';
import { MONTH_NAMES } from '../charts/cellModel';
import { formatCount, formatAnomaly, getAnomalyColor } from '../../styles/scales';

export interface TopAnomaliesProps {
  response?: CalendarApiResponse | null;
  data?: CalendarApiResponse | null; // Compatibility alias
  limit?: number; // default top 5
  onSelectMonth?: (month: ApiMonthData) => void;
  className?: string;
}

export const TopAnomalies: React.FC<TopAnomaliesProps> = ({
  response,
  data,
  limit = 5,
  onSelectMonth,
  className = '',
}) => {
  const activeResponse = response ?? data;

  if (!activeResponse || !activeResponse.months || activeResponse.months.length === 0) {
    return (
      <div className={`p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-500 ${className}`}>
        No monthly records available to rank active months.
      </div>
    );
  }

  // Rank by value (highest first), excluding unavailable months
  const ranked = [...activeResponse.months]
    .filter((m) => m.state !== 'unavailable' && m.value !== null && !isNaN(m.value))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, limit);

  return (
    <div className={`bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800/90 p-5 shadow-2xl ${className}`}>
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span>🔥 Top {limit} Most Active Fire Months</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by total monthly fire detections (highest first)
          </p>
        </div>
        <span className="text-[11px] font-mono font-medium text-slate-400 px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800">
          {activeResponse.meta.data_kind === 'synthetic' ? 'Synthetic Demo' : 'Harmonized'}
        </span>
      </div>

      <div className="mt-3.5 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800/80">
              <th className="pb-2.5 font-semibold">Rank</th>
              <th className="pb-2.5 font-semibold">Month</th>
              <th className="pb-2.5 font-semibold text-right">Value</th>
              <th className="pb-2.5 font-semibold text-right">Anomaly</th>
              <th className="pb-2.5 font-semibold text-center">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {ranked.map((m, idx) => {
              const [yr, mo] = m.month.split('-');
              const monthName = MONTH_NAMES[parseInt(mo, 10) - 1];
              const hasAnomaly = m.anomaly !== null && !isNaN(m.anomaly) && m.anomaly_state === 'ok';
              const anomalyColors = hasAnomaly ? getAnomalyColor(m.anomaly, m.anomaly_state) : null;

              return (
                <tr
                  key={m.month}
                  className="hover:bg-slate-800/50 cursor-pointer transition"
                  onClick={() => onSelectMonth?.(m)}
                >
                  <td className="py-2.5 font-mono font-bold text-slate-500">{`#${idx + 1}`}</td>
                  <td className="py-2.5 font-semibold text-slate-200">
                    {`${monthName} ${yr}`}
                  </td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-100">
                    {formatCount(m.value)}
                  </td>
                  <td className="py-2.5 text-right font-mono">
                    {hasAnomaly && anomalyColors ? (
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold shadow-sm inline-block"
                        style={{
                          backgroundColor: anomalyColors.fill,
                          color: anomalyColors.textColor,
                          border: `1px solid ${anomalyColors.stroke}`,
                        }}
                      >
                        {formatAnomaly(m.anomaly)}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {m.provisional && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                          Provisional
                        </span>
                      )}
                      {m.partial && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium">
                          Partial
                        </span>
                      )}
                      {!m.provisional && !m.partial && (
                        <span className="text-slate-600 text-[11px]">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// H4 Contract: <TopMonths />
export const TopMonths = TopAnomalies;

