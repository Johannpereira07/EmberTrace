import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TopMonths } from './TopAnomalies';
import type { CalendarApiResponse } from '../../../contracts/api/types';

const testResponse: CalendarApiResponse = {
  months: [
    {
      month: '2021-03',
      value: 50,
      state: 'value',
      anomaly: 3.5, // High anomaly, but lower count
      anomaly_state: 'ok',
      source: 'VIIRS',
      provisional: false,
      partial: false,
      low_count: false,
    },
    {
      month: '2021-04',
      value: 1200, // Highest count, but lower anomaly
      state: 'value',
      anomaly: 1.2,
      anomaly_state: 'ok',
      source: 'VIIRS',
      provisional: true,
      partial: false,
      low_count: false,
    },
    {
      month: '2021-05',
      value: null, // Unavailable month
      state: 'unavailable',
      anomaly: null,
      anomaly_state: 'unavailable',
      source: null,
      provisional: false,
      partial: false,
      low_count: false,
    },
    {
      month: '2021-06',
      value: 800,
      state: 'value',
      anomaly: 2.0,
      anomaly_state: 'ok',
      source: 'VIIRS',
      provisional: false,
      partial: true,
      low_count: false,
    },
  ],
  warnings: [],
  meta: {
    data_kind: 'synthetic',
    pipeline_version: '1.0.0',
    unit: 'count',
    cell_size_deg: 0.25,
    coverage: { first_month: '2021-03', last_month: '2021-06' },
    data_through: '2021-06-30',
    aoi_requested: { min_lat: 10, max_lat: 15, min_lon: 70, max_lon: 75 },
    aoi_analyzed: { min_lat: 10, max_lat: 15, min_lon: 70, max_lon: 75 },
    snapped: false,
    n_cells: 100,
    baseline: { basis: 'full_record', n_years: 1, median_by_calendar_month: Array(12).fill(100) },
  },
};

describe('TopMonths Component (FIX 4)', () => {
  it('ranks months by fire activity value descending (not anomaly)', () => {
    const html = renderToString(React.createElement(TopMonths, { response: testResponse, limit: 3 }));
    
    // Apr 2021 (value: 1200) should appear first as #1
    expect(html).toContain('#1');
    expect(html).toContain('1,200');
    expect(html).toContain('Apr 2021');

    // Jun 2021 (value: 800) should appear as #2
    expect(html).toContain('#2');
    expect(html).toContain('800');
    expect(html).toContain('Jun 2021');

    // Mar 2021 (value: 50) should appear as #3
    expect(html).toContain('#3');
    expect(html).toContain('50');
    expect(html).toContain('Mar 2021');

    // Unavailable month (May 2021) must be excluded
    expect(html).not.toContain('May 2021');
  });

  it('renders required table columns: Rank, Month, Value, Anomaly, Flags', () => {
    const html = renderToString(React.createElement(TopMonths, { response: testResponse, limit: 3 }));

    expect(html).toContain('Rank');
    expect(html).toContain('Month');
    expect(html).toContain('Value');
    expect(html).toContain('Anomaly');
    expect(html).toContain('Flags');

    // Flags are displayed
    expect(html).toContain('Provisional');
    expect(html).toContain('Partial');
  });
});
