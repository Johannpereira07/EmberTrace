/**
 * EmberTrace - Color Scales & Formatting
 * Person 5 (Charts Engineer)
 * Path: web/src/styles/scales.ts
 * 
 * Rules & Invariants:
 * 1. Zero counts are hollow with outline, NOT the lowest viridis ramp color.
 * 2. Activity count uses square-root scaling to handle extreme fire skews.
 * 3. Anomaly scale is diverging Blue (below normal) to Orange (above normal) centered at 1.0.
 * 4. Math.log2(0) is guarded: clamped at min 0.05 to avoid -Infinity.
 * 5. Standalone pure functions - no external d3 runtime dependency required.
 */

export interface ColorStop {
  stop: number;
  color: string;
}

// 5-stop Viridis palette
export const VIRIDIS_STOPS: string[] = [
  '#440154', // 0.00
  '#3b528b', // 0.25
  '#21918c', // 0.50
  '#5ec962', // 0.75
  '#fde725', // 1.00
];

// ColorBrewer-derived Diverging Blue-Orange stops centered at 1.0
export const ANOMALY_PALETTE = {
  extremeLow: '#053061',     // < 0.2x normal (-2.32 log2)
  low: '#2166ac',            // 0.2x - 0.5x (-1 to -2.32 log2)
  moderateLow: '#67a9cf',    // 0.5x - 0.8x (-0.32 to -1 log2)
  nearNormalLow: '#d1e5f0',  // 0.8x - 1.0x (0 to -0.32 log2)
  normal: '#f7f7f7',         // exactly 1.0x normal
  nearNormalHigh: '#fddbc7', // 1.0x - 1.25x (0 to +0.32 log2)
  moderateHigh: '#f4a582',   // 1.25x - 2.0x (+0.32 to +1 log2)
  high: '#d6604d',           // 2.0x - 4.0x (+1 to +2 log2)
  extremeHigh: '#67001f',    // > 4.0x (> +2 log2)
};

export const SPECIAL_CELL_COLORS = {
  zeroHollowFill: '#ffffff',
  zeroOutlineStroke: '#94a3b8',
  unavailableFill: '#e2e8f0',
  unavailableStroke: '#cbd5e1',
  outOfRangeFill: '#f8fafc',
  outOfRangeStroke: '#e2e8f0',
  notEnoughHistoryFill: '#f1f5f9',
};

function interpolateHex(color1: string, color2: string, factor: number): string {
  const c1 = parseInt(color1.slice(1), 16);
  const c2 = parseInt(color2.slice(1), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function getViridisColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const segments = VIRIDIS_STOPS.length - 1;
  const scaled = clamped * segments;
  const index = Math.floor(scaled);
  const subFactor = scaled - index;

  if (index >= segments) {
    return VIRIDIS_STOPS[segments];
  }
  return interpolateHex(VIRIDIS_STOPS[index], VIRIDIS_STOPS[index + 1], subFactor);
}

export function getActivityColor(count: number | null | undefined, maxCount: number): {
  fill: string;
  stroke: string;
  isHollow: boolean;
} {
  if (count === null || count === undefined || isNaN(count)) {
    return {
      fill: SPECIAL_CELL_COLORS.unavailableFill,
      stroke: SPECIAL_CELL_COLORS.unavailableStroke,
      isHollow: false,
    };
  }

  if (count === 0) {
    return {
      fill: SPECIAL_CELL_COLORS.zeroHollowFill,
      stroke: SPECIAL_CELL_COLORS.zeroOutlineStroke,
      isHollow: true,
    };
  }

  const effectiveMax = Math.max(1, maxCount);
  const normalized = Math.max(0, Math.min(1, count / effectiveMax));
  const sqrtT = Math.sqrt(normalized);

  const fill = getViridisColor(sqrtT);
  return {
    fill,
    stroke: fill,
    isHollow: false,
  };
}

export function safeLog2Anomaly(ratio: number): number {
  const clamped = Math.max(0.05, ratio);
  return Math.log2(clamped);
}

export function getAnomalyColor(
  anomaly: number | null | undefined,
  status?: string
): {
  fill: string;
  stroke: string;
  textColor: string;
} {
  if (status === 'out_of_range') {
    return {
      fill: SPECIAL_CELL_COLORS.outOfRangeFill,
      stroke: SPECIAL_CELL_COLORS.outOfRangeStroke,
      textColor: '#94a3b8',
    };
  }

  if (status === 'not_enough_history' || status === 'not_defined' || status === 'non_comparable_partial') {
    return {
      fill: SPECIAL_CELL_COLORS.notEnoughHistoryFill,
      stroke: '#cbd5e1',
      textColor: '#64748b',
    };
  }

  if (anomaly === null || anomaly === undefined || isNaN(anomaly) || status === 'unavailable') {
    return {
      fill: SPECIAL_CELL_COLORS.unavailableFill,
      stroke: SPECIAL_CELL_COLORS.unavailableStroke,
      textColor: '#94a3b8',
    };
  }

  if (Math.abs(anomaly - 1.0) < 0.02) {
    return {
      fill: ANOMALY_PALETTE.normal,
      stroke: '#e2e8f0',
      textColor: '#1e293b',
    };
  }

  if (anomaly < 1.0) {
    if (anomaly <= 0.2) {
      return { fill: ANOMALY_PALETTE.extremeLow, stroke: ANOMALY_PALETTE.extremeLow, textColor: '#ffffff' };
    } else if (anomaly <= 0.5) {
      return { fill: ANOMALY_PALETTE.low, stroke: ANOMALY_PALETTE.low, textColor: '#ffffff' };
    } else if (anomaly <= 0.8) {
      return { fill: ANOMALY_PALETTE.moderateLow, stroke: ANOMALY_PALETTE.moderateLow, textColor: '#0f172a' };
    } else {
      return { fill: ANOMALY_PALETTE.nearNormalLow, stroke: ANOMALY_PALETTE.nearNormalLow, textColor: '#0f172a' };
    }
  } else {
    if (anomaly <= 1.25) {
      return { fill: ANOMALY_PALETTE.nearNormalHigh, stroke: ANOMALY_PALETTE.nearNormalHigh, textColor: '#0f172a' };
    } else if (anomaly <= 2.0) {
      return { fill: ANOMALY_PALETTE.moderateHigh, stroke: ANOMALY_PALETTE.moderateHigh, textColor: '#0f172a' };
    } else if (anomaly <= 4.0) {
      return { fill: ANOMALY_PALETTE.high, stroke: ANOMALY_PALETTE.high, textColor: '#ffffff' };
    } else {
      return { fill: ANOMALY_PALETTE.extremeHigh, stroke: ANOMALY_PALETTE.extremeHigh, textColor: '#ffffff' };
    }
  }
}

export function formatCount(count: number | null | undefined): string {
  if (count === null || count === undefined || isNaN(count)) return '—';
  return Math.round(count).toLocaleString('en-US');
}

export function formatAnomaly(anomaly: number | null | undefined): string {
  if (anomaly === null || anomaly === undefined || isNaN(anomaly)) return '—';
  return `${anomaly.toFixed(1)}x`;
}

