/**
 * EmberTrace - Mock Response Generator (H3 Fixtures)
 * Conforming strictly to docs/04-api-spec.md
 * Path: web/src/dev/makeResponse.ts
 */

import { CalendarApiResponse, ApiMonthData, SatelliteSensorSource } from '../../../contracts/api/types';
import { START_YEAR, END_YEAR, START_MONTH, END_MONTH, isMonthInGlobalRange, getSensorSourceForDate } from '../features/charts/cellModel';

const SEASONAL_WEIGHTS = [
  0.4, 0.7, 1.5, 1.9, 1.6, 0.5,
  0.2, 0.2, 0.3, 1.4, 1.8, 0.6
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateNormalResponse(): CalendarApiResponse {
  const rand = seededRandom(42);
  const months: ApiMonthData[] = [];
  const baseMonthlyCounts: Record<number, number[]> = {
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
    7: [], 8: [], 9: [], 10: [], 11: [], 12: []
  };

  const tempMonths: { yr: number; mo: number; value: number; source: SatelliteSensorSource }[] = [];

  for (let yr = START_YEAR; yr <= END_YEAR; yr++) {
    for (let mo = 1; mo <= 12; mo++) {
      if (!isMonthInGlobalRange(yr, mo)) continue;

      const source = getSensorSourceForDate(yr, mo);
      const seasonWeight = SEASONAL_WEIGHTS[mo - 1];
      const yearNoise = 0.7 + rand() * 0.6;
      const value = Math.round(850 * seasonWeight * yearNoise * 10) / 10;

      baseMonthlyCounts[mo].push(value);
      tempMonths.push({ yr, mo, value, source });
    }
  }

  const medianByMonth: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const arr = [...baseMonthlyCounts[m]].sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    const med = arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    medianByMonth.push(Math.round(med * 10) / 10);
  }

  for (const item of tempMonths) {
    const padMo = item.mo < 10 ? `0${item.mo}` : `${item.mo}`;
    const month = `${item.yr}-${padMo}`;
    const baselineMed = medianByMonth[item.mo - 1];
    const anomaly = baselineMed > 0 ? Number((item.value / baselineMed).toFixed(2)) : 1.0;

    const provisional = item.yr === END_YEAR && item.mo >= 8; // provisional_from: 2026-08
    const partial = item.yr === END_YEAR && item.mo === END_MONTH;

    months.push({
      month,
      value: item.value,
      state: item.value === 0 ? 'zero' : 'value',
      anomaly,
      anomaly_state: 'ok',
      source: item.source,
      provisional,
      partial,
      low_count: false,
    });
  }

  return {
    meta: {
      data_kind: 'synthetic',
      pipeline_version: '0.1-synthetic',
      unit: 'VIIRS-equivalent detections per satellite',
      aoi_requested: {
        type: 'bbox',
        min_lat: 20.8,
        max_lat: 21.6,
        min_lon: 78.5,
        max_lon: 79.5,
      },
      aoi_analyzed: {
        min_lat: 20.75,
        max_lat: 21.75,
        min_lon: 78.5,
        max_lon: 79.5,
      },
      snapped: true,
      cell_size_deg: 0.25,
      n_cells: 16,
      coverage: {
        first_month: '2000-11',
        last_month: '2026-11',
      },
      data_through: '2026-11-13',
      baseline: {
        basis: 'full_record',
        n_years: 26,
        median_by_calendar_month: medianByMonth,
      },
    },
    months,
    warnings: [
      {
        code: 'SYNTHETIC_DATA',
        message: 'Demonstration data only. Raw counts and calibration parameters are synthetic.',
        ranges: [],
      },
      {
        code: 'SNAPPED_AOI',
        message: 'Requested area snapped outward to 0.25° grid boundaries.',
        ranges: [],
      },
      {
        code: 'CHAINED_SEGMENT',
        message: 'Nov 2000 to Jun 2002 chained via Aqua and carries higher uncertainty.',
        ranges: [{ from: '2000-11', to: '2002-06' }],
      },
      {
        code: 'PROVISIONAL',
        message: 'Recent months from 2026-08 onward are provisional NRT detections.',
        ranges: [{ from: '2026-08', to: '2026-11' }],
      },
      {
        code: 'PARTIAL_MONTH',
        message: 'Current month (2026-11) is incomplete.',
        ranges: [{ from: '2026-11', to: '2026-11' }],
      },
    ],
  };
}

export function generateSparseResponse(): CalendarApiResponse {
  const normal = generateNormalResponse();
  const rand = seededRandom(108);

  const months: ApiMonthData[] = normal.months.map((m) => {
    const roll = rand();
    let val: number = 0;
    if (roll > 0.65) {
      val = Math.floor((roll - 0.65) * 15);
    }
    return {
      ...m,
      value: val,
      state: val === 0 ? 'zero' : 'value',
      anomaly: val === 0 ? 0 : Number((val / 2.5).toFixed(2)),
      low_count: true,
    };
  });

  return {
    ...normal,
    meta: {
      ...normal.meta,
      aoi_requested: {
        type: 'bbox',
        min_lat: 11.8,
        max_lat: 12.6,
        min_lon: 75.2,
        max_lon: 76.1,
      },
      aoi_analyzed: {
        min_lat: 11.75,
        max_lat: 12.75,
        min_lon: 75.0,
        max_lon: 76.25,
      },
      n_cells: 20,
    },
    months,
    warnings: [
      ...normal.warnings,
      {
        code: 'LOW_COUNT',
        message: 'Detections are very sparse (<10 fires/month). Anomaly ratios may fluctuate dramatically.',
        ranges: [{ from: '2000-11', to: '2026-11' }],
      },
    ],
  };
}

export function generateEdgeCasesResponse(): CalendarApiResponse {
  const normal = generateNormalResponse();

  const months: ApiMonthData[] = normal.months.map((m) => {
    if (m.month === '2005-04') {
      return {
        ...m,
        value: null,
        state: 'unavailable',
        anomaly: null,
        anomaly_state: 'unavailable',
      };
    }
    if (m.month === '2001-01') {
      return {
        ...m,
        anomaly: null,
        anomaly_state: 'not_enough_history',
      };
    }
    if (m.month === '2016-07') {
      return {
        ...m,
        value: 0,
        state: 'zero',
        anomaly: 0,
        anomaly_state: 'ok',
      };
    }
    if (m.month === '2020-04') {
      return {
        ...m,
        value: 6200.5,
        anomaly: 4.8,
        anomaly_state: 'ok',
      };
    }
    return m;
  });

  return {
    ...normal,
    months,
  };
}

