/**
 * Vitest Unit Tests: Cell Model & Matrix Transformation
 * Person 5 (Charts Engineer)
 */

import { describe, it, expect } from 'vitest';
import {
  buildGridModel,
  isMonthInGlobalRange,
  getSensorSourceForDate,
  START_YEAR,
  END_YEAR,
  TOTAL_ACTIVE_MONTHS,
} from './cellModel';
import { generateNormalResponse, generateSparseResponse, generateEdgeCasesResponse } from '../../dev/makeResponse';

describe('Cell Model & Matrix Tests', () => {
  it('correctly calculates total range: 27 rows (2000 to 2026) and 313 active months', () => {
    let activeMonthsCount = 0;
    for (let yr = START_YEAR; yr <= END_YEAR; yr++) {
      for (let mo = 1; mo <= 12; mo++) {
        if (isMonthInGlobalRange(yr, mo)) {
          activeMonthsCount++;
        }
      }
    }
    expect(END_YEAR - START_YEAR + 1).toBe(27);
    expect(activeMonthsCount).toBe(TOTAL_ACTIVE_MONTHS);
    expect(activeMonthsCount).toBe(313);
  });

  it('marks months before 2000-11 as out_of_range', () => {
    expect(isMonthInGlobalRange(2000, 1)).toBe(false);
    expect(isMonthInGlobalRange(2000, 10)).toBe(false);
    expect(isMonthInGlobalRange(2000, 11)).toBe(true);
    expect(isMonthInGlobalRange(2000, 12)).toBe(true);
  });

  it('correctly attributes satellite sensor source across transitions', () => {
    expect(getSensorSourceForDate(2000, 11)).toBe('TERRA_chained');
    expect(getSensorSourceForDate(2002, 6)).toBe('TERRA_chained');

    // Handover 1: Jul 2002 -> Aqua calibrated
    expect(getSensorSourceForDate(2002, 7)).toBe('AQUA_calibrated');
    expect(getSensorSourceForDate(2011, 12)).toBe('AQUA_calibrated');

    // Handover 2: Jan 2012 -> VIIRS
    expect(getSensorSourceForDate(2012, 1)).toBe('VIIRS');
    expect(getSensorSourceForDate(2026, 11)).toBe('VIIRS');
  });

  it('builds a 27-row grid from normal mock response', () => {
    const mock = generateNormalResponse();
    const model = buildGridModel(mock);

    expect(model.rows.length).toBe(27);
    expect(model.rows[0].year).toBe(2000);
    expect(model.rows[26].year).toBe(2026);
    expect(model.totalValidMonths).toBe(313);
    expect(model.maxCount).toBeGreaterThan(0);

    const row2000 = model.rows[0];
    expect(row2000.cells.length).toBe(12);
    expect(row2000.cells[0].isOutOfRange).toBe(true);
    expect(row2000.cells[9].isOutOfRange).toBe(true);
    expect(row2000.cells[10].isOutOfRange).toBe(false);
    expect(row2000.cells[10].source).toBe('TERRA_chained');

    const row2026 = model.rows[26];
    const nov2026 = row2026.cells[10];
    expect(nov2026.isPartial).toBe(true);
    expect(nov2026.isProvisional).toBe(true);
  });

  it('correctly handles sparse data with zero fire months', () => {
    const sparseMock = generateSparseResponse();
    const model = buildGridModel(sparseMock);

    expect(model.warnings.some(w => w.code === 'LOW_COUNT')).toBe(true);

    const hasZeroCell = model.rows.some(r => r.cells.some(c => c.isZero && !c.isOutOfRange));
    expect(hasZeroCell).toBe(true);
  });

  it('handles edge cases (not_enough_history, unavailable data gap, anomaly=0)', () => {
    const edgeMock = generateEdgeCasesResponse();
    const model = buildGridModel(edgeMock);

    const cell2005_04 = model.rows.find(r => r.year === 2005)?.cells[3];
    expect(cell2005_04?.state).toBe('unavailable');
    expect(cell2005_04?.value).toBeNull();

    const cell2001_01 = model.rows.find(r => r.year === 2001)?.cells[0];
    expect(cell2001_01?.anomalyState).toBe('not_enough_history');

    const cell2016_07 = model.rows.find(r => r.year === 2016)?.cells[6];
    expect(cell2016_07?.anomaly).toBe(0);
  });
});

