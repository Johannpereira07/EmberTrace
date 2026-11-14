/**
 * EmberTrace - Cell Model & Matrix Builder
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/cellModel.ts
 * 
 * Transforms CalendarApiResponse into a normalized 27-row x 12-column matrix
 * spanning Nov 2000 through Nov 2026 (313 active months).
 */

import { CalendarApiResponse, ApiMonthData, SatelliteSensorSource, GridCell, YearRow, GridModel } from './types';

export const START_YEAR = 2000;
export const END_YEAR = 2026;
export const START_MONTH = 11; // Nov 2000
export const END_MONTH = 11;   // Nov 2026
export const TOTAL_ACTIVE_MONTHS = 313;

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function isMonthInGlobalRange(year: number, month: number): boolean {
  if (year < START_YEAR || year > END_YEAR) return false;
  if (year === START_YEAR && month < START_MONTH) return false;
  if (year === END_YEAR && month > END_MONTH) return false;
  return true;
}

export function getSensorSourceForDate(year: number, month: number): SatelliteSensorSource {
  if (!isMonthInGlobalRange(year, month)) return null;
  if (year < 2002 || (year === 2002 && month < 7)) {
    return 'TERRA_chained';
  }
  if (year < 2012) {
    return 'AQUA_calibrated';
  }
  return 'VIIRS';
}

export function buildCellAccessibilityText(
  year: number,
  month: number,
  data: ApiMonthData | null,
  isOutOfRange: boolean
): string {
  const monthName = MONTH_NAMES[month - 1];
  if (isOutOfRange) {
    return `${monthName} ${year}: Outside observation period`;
  }
  if (!data || data.state === 'unavailable' || data.value === null) {
    return `${monthName} ${year}: No satellite observation data`;
  }
  if (data.state === 'zero') {
    return `${monthName} ${year}: 0 fire detections observed (Quiet month)`;
  }
  if (data.anomaly_state === 'not_enough_history') {
    return `${monthName} ${year}: ${Math.round(data.value)} detections (Baseline not established)`;
  }

  const valStr = `${Math.round(data.value).toLocaleString()} detections`;
  const anomStr = data.anomaly !== null ? `${data.anomaly.toFixed(1)}x baseline` : 'Normal';
  const src = data.source === 'TERRA_chained'
    ? 'Terra chained'
    : data.source === 'AQUA_calibrated'
    ? 'Aqua calibrated'
    : 'VIIRS';

  const prov = data.provisional ? ' [Provisional NRT]' : '';
  const part = data.partial ? ' [Partial month]' : '';

  return `${monthName} ${year}: ${valStr} (${anomStr}) via ${src}${prov}${part}`;
}

export function buildGridModel(response: CalendarApiResponse | null): GridModel {
  if (!response) {
    return {
      rows: [],
      maxCount: 1,
      totalValidMonths: 0,
      monthlyMedians: Array(12).fill(0),
      meta: null,
      warnings: [],
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

  for (let yr = START_YEAR; yr <= END_YEAR; yr++) {
    const cells: GridCell[] = [];
    let annualSum = 0;
    let hasValidCountInYear = false;
    let hasTerraChained = false;
    let hasAquaCalibrated = false;
    let hasViirs = false;

    for (let mo = 1; mo <= 12; mo++) {
      const padMo = mo < 10 ? `0${mo}` : `${mo}`;
      const monthStr = `${yr}-${padMo}`;
      const inRange = isMonthInGlobalRange(yr, mo);
      const raw = dataMap.get(monthStr) || null;

      const isOutOfRange = !inRange;
      const defaultSource = getSensorSourceForDate(yr, mo);
      const source = raw ? raw.source : defaultSource;

      if (source === 'TERRA_chained') hasTerraChained = true;
      if (source === 'AQUA_calibrated') hasAquaCalibrated = true;
      if (source === 'VIIRS') hasViirs = true;

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
        isPartial: raw?.partial ?? (yr === END_YEAR && mo === END_MONTH),
        isLowCount: raw?.low_count ?? false,
        isOutOfRange,
        isZero,
        tooltipText,
        ariaLabel: tooltipText,
      });
    }

    rows.push({
      year: yr,
      cells,
      annualTotal: hasValidCountInYear ? Math.round(annualSum) : null,
      hasTerraChained,
      hasAquaCalibrated,
      hasViirs,
    });
  }

  return {
    rows,
    maxCount: Math.max(1, observedMax),
    totalValidMonths: validCount,
    monthlyMedians: (response.meta?.baseline?.median_by_calendar_month || Array(12).fill(0)).map((v: number | null) => v ?? 0),
    meta: response.meta,
    warnings: response.warnings || [],
  };
}

