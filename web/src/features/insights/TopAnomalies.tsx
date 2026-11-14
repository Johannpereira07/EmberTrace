/**
 * EmberTrace - Top Anomalies & Seasonal Insights (CHT-9)
 * Person 5 (Charts Engineer)
 * Path: web/src/features/insights/TopAnomalies.tsx
 * 
 * Also exported as <TopMonths /> per H4 Contract specification.
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
        No monthly records available to rank anomalies.
      </div>
    );
  }

  const ranked = [...activeResponse.months]
    .filter((m) => m.anomaly !== null && !isNaN(m.anomaly) && m.state !== 'unavailable' && m.value !== null)
    .sort((a, b) => (b.anomaly ?? 0) - (a.anomaly ?? 0))
    .slice(0, limit);

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🔥 Top {limit} Historical Wildfire Anomalies</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Highest deviations relative to historical monthly medians (2000–2026)
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {activeResponse.meta.data_kind === 'synthetic' ? 'Synthetic Data' : 'Harmonized'}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="pb-2 font-semibold">Rank</th>
              <th className="pb-2 font-semibold">Month / Year</th>
              <th className="pb-2 font-semibold">Sensor</th>
              <th className="pb-2 font-semibold text-right">Detections</th>
              <th className="pb-2 font-semibold text-right">Anomaly Ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ranked.map((m, idx) => {
              const [yr, mo] = m.month.split('-');
              const monthName = MONTH_NAMES[parseInt(mo, 10) - 1];
              const anomalyColors = getAnomalyColor(m.anomaly, m.anomaly_state);
              const sourceBadge =
                m.source === 'TERRA_chained'
                  ? { label: 'Terra', bg: 'bg-purple-100 text-purple-800' }
                  : m.source === 'AQUA_calibrated'
                  ? { label: 'Aqua', bg: 'bg-blue-100 text-blue-800' }
                  : { label: 'VIIRS', bg: 'bg-emerald-100 text-emerald-800' };

              return (
                <tr
                  key={m.month}
                  className="hover:bg-slate-50 cursor-pointer transition"
                  onClick={() => onSelectMonth?.(m)}
                >
                  <td className="py-2.5 font-bold text-slate-400">#{idx + 1}</td>
                  <td className="py-2.5 font-semibold text-slate-800">
                    {monthName} {yr}
                    {m.provisional && (
                      <span className="ml-1.5 px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800 font-medium">
                        Provisional
                      </span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sourceBadge.bg}`}>
                      {sourceBadge.label}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-medium text-slate-700">
                    {formatCount(m.value)}
                  </td>
                  <td className="py-2.5 text-right font-bold">
                    <span
                      className="px-2 py-0.5 rounded text-[11px]"
                      style={{
                        backgroundColor: anomalyColors.fill,
                        color: anomalyColors.textColor,
                        border: `1px solid ${anomalyColors.stroke}`,
                      }}
                    >
                      {formatAnomaly(m.anomaly)}
                    </span>
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

// H4 Alias: <TopMonths />
export const TopMonths = TopAnomalies;

