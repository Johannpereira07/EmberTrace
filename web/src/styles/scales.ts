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

// 9-stop diverging Blue-Orange palette centered on 1.0 (log2 domain [-2, 0, 2], so 0.25x to 4x)
export const ANOMALY_STOPS: string[] = [
  '#2166ac', // 0: <= 0.25x (-2 log2)
  '#4393c3', // 1: ~0.35x (-1.5 log2)
  '#92c5de', // 2: 0.5x (-1.0 log2)
  '#d1e5f0', // 3: ~0.71x (-0.5 log2)
  '#f7f7f7', // 4: exactly 1.0x (0 log2)
  '#fee0b6', // 5: ~1.41x (+0.5 log2)
  '#fdb863', // 6: 2.0x (+1.0 log2)
  '#e08214', // 7: ~2.83x (+1.5 log2)
  '#b35806', // 8: >= 4.0x (+2 log2)
];

export const ANOMALY_PALETTE = {
  stop0: '#2166ac',
  stop1: '#4393c3',
  stop2: '#92c5de',
  stop3: '#d1e5f0',
  stop4: '#f7f7f7',
  stop5: '#fee0b6',
  stop6: '#fdb863',
  stop7: '#e08214',
  stop8: '#b35806',
};

export const SPECIAL_CELL_COLORS = {
  zeroHollowFill: '#ffffff',
  zeroOutlineStroke: '#334155',
  unavailableFill: '#e5e5e5',
  unavailableHatchStroke: '#555555',
  unavailableStroke: '#555555',
  outOfRangeFill: 'none',
  outOfRangeStroke: 'none',
  notEnoughHistoryFill: '#e5e5e5',
  notEnoughHistoryStroke: '#555555',
  notEnoughHistoryText: '#333333',
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
  if (ratio === 0) return -2;
  const clamped = Math.min(4, Math.max(0.25, ratio));
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
      stroke: SPECIAL_CELL_COLORS.notEnoughHistoryStroke,
      textColor: SPECIAL_CELL_COLORS.notEnoughHistoryText,
    };
  }

  if (anomaly === null || anomaly === undefined || isNaN(anomaly) || status === 'unavailable') {
    return {
      fill: SPECIAL_CELL_COLORS.unavailableFill,
      stroke: SPECIAL_CELL_COLORS.unavailableStroke,
      textColor: '#94a3b8',
    };
  }

  // An anomaly of exactly 0 is valid and gets the bluest color (#2166ac)
  if (anomaly === 0) {
    return { fill: ANOMALY_STOPS[0], stroke: ANOMALY_STOPS[0], textColor: '#ffffff' };
  }

  // Clamp BEFORE the log: Math.max(ratio, 0.25) and Math.min(ratio, 4)
  const clamped = Math.min(4, Math.max(0.25, anomaly));
  const log2Val = Math.log2(clamped); // in [-2, 2]
  const t = (log2Val + 2) / 4; // in [0, 1]
  const index = Math.max(0, Math.min(8, Math.round(t * 8)));
  const fill = ANOMALY_STOPS[index];

  // Contrast text: indices 2 to 6 are light, others are dark
  const darkText = index >= 2 && index <= 6;
  const textColor = darkText ? (index === 4 ? '#1e293b' : '#0f172a') : '#ffffff';

  return {
    fill,
    stroke: index === 4 ? '#cbd5e1' : fill,
    textColor,
  };
}

export function formatCount(count: number | null | undefined): string {
  if (count === null || count === undefined || isNaN(count)) return '—';
  return Math.round(count).toLocaleString('en-US');
}

export function formatAnomaly(anomaly: number | null | undefined): string {
  if (anomaly === null || anomaly === undefined || isNaN(anomaly)) return '—';
  return `${anomaly.toFixed(1)}x`;
}

