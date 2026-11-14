/**
 * EmberTrace - Cell Model & Matrix Builder
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/cellModel.ts
 *
 * Transforms CalendarApiResponse into a year x month matrix. The range comes from the response
 * (its months, else meta.coverage) and each month's source from its own `source` field, never
 * from dates (charts/AGENTS.md).
 */

import {
  CalendarApiResponse,
  ApiMonthData,
  SatelliteSensorSource,
  GridCell,
  YearRow,
  GridModel,
  SourceSpan,
} from './types';

type Source = NonNullable<SatelliteSensorSource>;

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/** Display names and epoch colours (charts/AGENTS.md: Terra purple, Aqua blue, VIIRS green). */
export const SOURCE_INFO: Record<Source, { short: string; label: string; color: string }> = {
  TERRA_chained: { short: 'Terra', label: 'Terra (chained via Aqua, least certain)', color: '#a855f7' },
  AQUA_calibrated: { short: 'Aqua', label: 'Aqua (calibrated to VIIRS)', color: '#3b82f6' },
  VIIRS: { short: 'VIIRS', label: 'VIIRS', color: '#10b981' },
};

const pad = (m: number) => (m < 10 ? `0${m}` : `${m}`);

/** 'YYYY-MM' -> 'Jul 2002' */
export function formatMonthLabel(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** First and last month to draw: the response's own months, else meta.coverage. */
export function getMonthRange(response: CalendarApiResponse): { first: string; last: string } | null {
  const months = response.months.map((m) => m.month).sort();
  if (months.length) return { first: months[0], last: months[months.length - 1] };
  const cov = response.meta?.coverage;
  return cov ? { first: cov.first_month, last: cov.last_month } : null;
}

/** Each source's first and last month, in order of first appearance. */
export function getSourceSpans(response: CalendarApiResponse | null): SourceSpan[] {
  if (!response) return [];
  const spans = new Map<Source, SourceSpan>();
  for (const m of [...response.months].sort((a, b) => a.month.localeCompare(b.month))) {
    if (!m.source) continue;
    const span = spans.get(m.source);
    if (span) span.to = m.month;
    else spans.set(m.source, { source: m.source, from: m.month, to: m.month });
  }
  return [...spans.values()];
}

export function buildCellAccessibilityText(
  year: number,
  month: number,
  data: ApiMonthData | null,
  isOutOfRange: boolean
): string {
  const monthName = MONTH_NAMES[month - 1];
  if (isOutOfRange) {
    return `${monthName} ${year}: Outside the selected period`;
  }
  if (!data || data.state === 'unavailable' || data.value === null) {
    return `${monthName} ${year}: No satellite observation data`;
  }
  const via = data.source ? ` via ${SOURCE_INFO[data.source].label}` : '';
  const prov = data.provisional ? ' [Provisional NRT]' : '';
  const part = data.partial ? ' [Partial month]' : '';
  if (data.state === 'zero') {
    return `${monthName} ${year}: 0 fire detections observed (Quiet month)${via}${prov}${part}`;
  }
  if (data.anomaly_state === 'not_enough_history') {
    return `${monthName} ${year}: ${Math.round(data.value)} detections (Baseline not established)${via}${prov}${part}`;
  }

  const valStr = `${Math.round(data.value).toLocaleString()} detections`;
  const anomStr =
    data.anomaly_state === 'non_comparable_partial'
      ? 'not comparable: partial month'
      : data.anomaly_state === 'not_defined'
        ? 'no baseline: median is 0'
        : data.anomaly !== null
          ? `${data.anomaly.toFixed(1)}x baseline`
          : 'no anomaly';

  return `${monthName} ${year}: ${valStr} (${anomStr})${via}${prov}${part}`;
}

export function buildGridModel(response: CalendarApiResponse | null): GridModel {
  const range = response ? getMonthRange(response) : null;
  if (!response || !range) {
    return {
      rows: [],
      maxCount: 1,
      totalValidMonths: 0,
      monthlyMedians: Array(12).fill(0),
      meta: response?.meta ?? null,
      warnings: response?.warnings ?? [],
      sourceSpans: [],
    };
  }

  const dataMap = new Map<string, ApiMonthData>();
  let observedMax = 0;
  let validCount = 0;

  for (const m of response.months) {
    dataMap.set(m.month, m);
    if (m.value !== null && !isNaN(m.value) && m.state !== 'unavailable') {
      if (m.value > observedMax) observedMax = m.value;
      validCount++;
    }
  }

  const rows: YearRow[] = [];
  const firstYear = Number(range.first.slice(0, 4));
  const lastYear = Number(range.last.slice(0, 4));
  let previousSource: Source | null = null;

  for (let yr = firstYear; yr <= lastYear; yr++) {
    const cells: GridCell[] = [];
    const sources: Source[] = [];
    let annualSum = 0;
    let hasValidCountInYear = false;

    for (let mo = 1; mo <= 12; mo++) {
      const monthStr = `${yr}-${pad(mo)}`;
      const isOutOfRange = monthStr < range.first || monthStr > range.last;
      const raw = dataMap.get(monthStr) || null;
      const source = raw?.source ?? null;

      const isHandover = !!source && !!previousSource && source !== previousSource;
      if (source) {
        previousSource = source;
        if (!sources.includes(source)) sources.push(source);
      }

      const value = raw?.value ?? null;
      const state = isOutOfRange ? 'unavailable' : (raw?.state ?? 'unavailable');
      const anomaly = raw?.anomaly ?? null;
      const anomalyState = isOutOfRange ? 'unavailable' : (raw?.anomaly_state ?? 'unavailable');
      const isZero = state === 'zero' || value === 0;

      if (value !== null && !isNaN(value) && state !== 'unavailable') {
        annualSum += value;
        hasValidCountInYear = true;
      }

      const tooltipText = buildCellAccessibilityText(yr, mo, raw, isOutOfRange);

      cells.push({
        year: yr,
        month: mo,
        monthStr,
        data: raw,
        value,
        state,
        anomaly,
        anomalyState,
        source,
        isProvisional: raw?.provisional ?? false,
        isPartial: raw?.partial ?? false,
        isLowCount: raw?.low_count ?? false,
        isOutOfRange,
        isZero,
        isHandover,
        tooltipText,
        ariaLabel: tooltipText,
      });
    }

    rows.push({
      year: yr,
      cells,
      annualTotal: hasValidCountInYear ? Math.round(annualSum) : null,
      hasTerraChained: sources.includes('TERRA_chained'),
      hasAquaCalibrated: sources.includes('AQUA_calibrated'),
      hasViirs: sources.includes('VIIRS'),
      sources,
    });
  }

  return {
    rows,
    maxCount: Math.max(1, observedMax),
    totalValidMonths: validCount,
    monthlyMedians: (response.meta?.baseline?.median_by_calendar_month || Array(12).fill(0)).map((v: number | null) => v ?? 0),
    meta: response.meta,
    warnings: response.warnings || [],
    sourceSpans: getSourceSpans(response),
  };
}
