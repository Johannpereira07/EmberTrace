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
  ANOMALY_PALETTE,
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
    it('guards against -Infinity for 0 or negative values', () => {
      const zeroLog = safeLog2Anomaly(0);
      expect(Number.isFinite(zeroLog)).toBe(true);
      expect(zeroLog).toBeLessThan(0);
      expect(zeroLog).toBe(Math.log2(0.05));
    });

    it('returns exact 0 for 1.0 (normal ratio)', () => {
      expect(safeLog2Anomaly(1.0)).toBe(0);
    });
  });

  describe('getAnomalyColor', () => {
    it('returns neutral color for normal baseline (1.0)', () => {
      const result = getAnomalyColor(1.0, 'ok');
      expect(result.fill).toBe(ANOMALY_PALETTE.normal);
    });

    it('returns blue palette for below normal (<1.0)', () => {
      const lowResult = getAnomalyColor(0.4, 'ok');
      expect(lowResult.fill).toBe(ANOMALY_PALETTE.low);
      const extremeLow = getAnomalyColor(0.1, 'ok');
      expect(extremeLow.fill).toBe(ANOMALY_PALETTE.extremeLow);
    });

    it('returns orange/red palette for above normal (>1.0)', () => {
      const highResult = getAnomalyColor(1.8, 'ok');
      expect(highResult.fill).toBe(ANOMALY_PALETTE.moderateHigh);
      const extremeHigh = getAnomalyColor(4.5, 'ok');
      expect(extremeHigh.fill).toBe(ANOMALY_PALETTE.extremeHigh);
    });

    it('handles special statuses (out_of_range, not_enough_history, unavailable)', () => {
      expect(getAnomalyColor(null, 'out_of_range').fill).toBe(SPECIAL_CELL_COLORS.outOfRangeFill);
      expect(getAnomalyColor(null, 'not_enough_history').fill).toBe(SPECIAL_CELL_COLORS.notEnoughHistoryFill);
      expect(getAnomalyColor(null, 'unavailable').fill).toBe(SPECIAL_CELL_COLORS.unavailableFill);
    });
  });
});

