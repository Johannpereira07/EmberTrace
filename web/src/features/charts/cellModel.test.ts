/**
 * Vitest Unit Tests: Cell Model & Matrix Transformation
 * Person 5 (Charts Engineer)
 */

import { describe, it, expect } from 'vitest';
import { buildGridModel, getSourceSpans, getMonthRange } from './cellModel';
import { generateNormalResponse, generateSparseResponse, generateEdgeCasesResponse } from '../../dev/makeResponse';

describe('Cell Model & Matrix Tests', () => {
  it('takes the range from the response, not from constants', () => {
    const mock = generateNormalResponse();
    const window = { ...mock, months: mock.months.filter((m) => m.month >= '2010-03' && m.month <= '2015-06') };
    expect(getMonthRange(window)).toEqual({ first: '2010-03', last: '2015-06' });

    const model = buildGridModel(window);
    expect(model.rows.map((r) => r.year)).toEqual([2010, 2011, 2012, 2013, 2014, 2015]);
    expect(model.rows[0].cells[1].isOutOfRange).toBe(true); // Feb 2010
    expect(model.rows[0].cells[2].isOutOfRange).toBe(false); // Mar 2010
    expect(model.rows[5].cells[6].isOutOfRange).toBe(true); // Jul 2015
  });

  it('reads each month\'s source from the response and flags the handovers', () => {
    const model = buildGridModel(generateNormalResponse());
    const handovers = model.rows.flatMap((r) => r.cells.filter((c) => c.isHandover).map((c) => `${c.monthStr} ${c.source}`));
    expect(handovers).toEqual(['2002-07 AQUA_calibrated', '2012-01 VIIRS']);

    const row2002 = model.rows.find((r) => r.year === 2002)!;
    expect(row2002.sources).toEqual(['TERRA_chained', 'AQUA_calibrated']);
    expect(model.rows.find((r) => r.year === 2012)!.sources).toEqual(['VIIRS']);
  });

  it('never invents a source for a month the response leaves without one', () => {
    const mock = generateNormalResponse();
    const gap = { ...mock, months: mock.months.map((m) => (m.month === '2005-04' ? { ...m, source: null, value: null, state: 'unavailable' as const } : m)) };
    const cell = buildGridModel(gap).rows.find((r) => r.year === 2005)!.cells[3];
    expect(cell.source).toBeNull();
    expect(cell.isHandover).toBe(false);
    expect(buildGridModel(gap).rows.find((r) => r.year === 2005)!.cells[4].isHandover).toBe(false); // same source after the gap
  });

  it('lists each source\'s span for the legend', () => {
    expect(getSourceSpans(generateNormalResponse())).toEqual([
      { source: 'TERRA_chained', from: '2000-11', to: '2002-06' },
      { source: 'AQUA_calibrated', from: '2002-07', to: '2011-12' },
      { source: 'VIIRS', from: '2012-01', to: '2026-11' },
    ]);
  });

  it('takes the partial flag from the response only', () => {
    const mock = generateNormalResponse();
    const notPartial = { ...mock, months: mock.months.map((m) => ({ ...m, partial: false })) };
    const rows = buildGridModel(notPartial).rows;
    const last = rows[rows.length - 1].cells[10];
    expect(last.isPartial).toBe(false);
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

