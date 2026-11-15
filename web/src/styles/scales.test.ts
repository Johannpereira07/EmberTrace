/**
 * Vitest Unit Tests: Color Scales & Formatting
 * Person 5 (Charts Engineer)
 */

import { describe, it, expect } from 'vitest';
import {
  getActivityColor,
  getAnomalyColor,
  safeLog2Anomaly,
  getViridisColor,
  SPECIAL_CELL_COLORS,
  ANOMALY_STOPS,
} from './scales';

describe('Scales & Color Logic', () => {
  describe('getViridisColor', () => {
    it('returns first stop at 0 and last stop at 1', () => {
      expect(getViridisColor(0)).toBe('#440154');
      expect(getViridisColor(1)).toBe('#fde725');
    });

    it('interpolates smoothly without crashing on out-of-bound inputs', () => {
      expect(getViridisColor(-0.5)).toBe('#440154');
      expect(getViridisColor(1.5)).toBe('#fde725');
      const mid = getViridisColor(0.5);
      expect(mid.startsWith('#')).toBe(true);
      expect(mid.length).toBe(7);
    });
  });

  describe('getActivityColor', () => {
    it('rule: zero counts MUST be hollow with outline, not lowest viridis color', () => {
      const result = getActivityColor(0, 1000);
      expect(result.isHollow).toBe(true);
      expect(result.fill).toBe(SPECIAL_CELL_COLORS.zeroHollowFill);
      expect(result.stroke).toBe(SPECIAL_CELL_COLORS.zeroOutlineStroke);
    });

    it('handles null, undefined and NaN gracefully', () => {
      expect(getActivityColor(null, 1000).fill).toBe(SPECIAL_CELL_COLORS.unavailableFill);
      expect(getActivityColor(undefined, 1000).fill).toBe(SPECIAL_CELL_COLORS.unavailableFill);
      expect(getActivityColor(NaN, 1000).fill).toBe(SPECIAL_CELL_COLORS.unavailableFill);
    });

    it('applies square-root scaling for positive values', () => {
      const lowResult = getActivityColor(100, 10000);
      const highResult = getActivityColor(10000, 10000);
      expect(lowResult.isHollow).toBe(false);
      expect(highResult.isHollow).toBe(false);
      expect(highResult.fill).toBe('#fde725');
      expect(lowResult.fill).not.toBe('#fde725');
    });
  });

  describe('safeLog2Anomaly', () => {
    it('clamps ratio before log to domain [-2, 2] (0.25x to 4x)', () => {
      expect(safeLog2Anomaly(0)).toBe(-2);
      expect(safeLog2Anomaly(0.1)).toBe(-2);
      expect(safeLog2Anomaly(0.25)).toBe(-2);
      expect(safeLog2Anomaly(0.5)).toBe(-1);
      expect(safeLog2Anomaly(1.0)).toBe(0);
      expect(safeLog2Anomaly(2.0)).toBe(1);
      expect(safeLog2Anomaly(4.0)).toBe(2);
      expect(safeLog2Anomaly(10.0)).toBe(2);
    });
  });

  describe('getAnomalyColor', () => {
    it('returns exact specified palette stops for PRD compliance', () => {
      // 0 gives #2166ac
      expect(getAnomalyColor(0, 'ok').fill).toBe('#2166ac');
      // 0.25 and below gives #2166ac
      expect(getAnomalyColor(0.25, 'ok').fill).toBe('#2166ac');
      expect(getAnomalyColor(0.1, 'ok').fill).toBe('#2166ac');
      // 0.5 gives #92c5de
      expect(getAnomalyColor(0.5, 'ok').fill).toBe('#92c5de');
      // 1 gives #f7f7f7
      expect(getAnomalyColor(1, 'ok').fill).toBe('#f7f7f7');
      expect(getAnomalyColor(1.0, 'ok').fill).toBe('#f7f7f7');
      // 2 gives #fdb863
      expect(getAnomalyColor(2, 'ok').fill).toBe('#fdb863');
      expect(getAnomalyColor(2.0, 'ok').fill).toBe('#fdb863');
      // 4 and above give #b35806
      expect(getAnomalyColor(4, 'ok').fill).toBe('#b35806');
      expect(getAnomalyColor(4.0, 'ok').fill).toBe('#b35806');
      expect(getAnomalyColor(5.5, 'ok').fill).toBe('#b35806');
    });

    it('contains no red colors in any stops', () => {
      expect(ANOMALY_STOPS).not.toContain('#d6604d');
      expect(ANOMALY_STOPS).not.toContain('#67001f');
      expect(ANOMALY_STOPS.length).toBe(9);
    });

    it('handles special statuses (out_of_range, not_enough_history, unavailable)', () => {
      expect(getAnomalyColor(null, 'out_of_range').fill).toBe(SPECIAL_CELL_COLORS.outOfRangeFill);
      expect(getAnomalyColor(null, 'not_enough_history').fill).toBe(SPECIAL_CELL_COLORS.notEnoughHistoryFill);
      expect(getAnomalyColor(null, 'unavailable').fill).toBe(SPECIAL_CELL_COLORS.unavailableFill);
    });
  });
});

