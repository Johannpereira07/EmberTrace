import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CalendarHeatmap } from './CalendarHeatmap';
import { AnomalyHeatmap } from './AnomalyHeatmap';
import type { CalendarApiResponse } from './types';

const mockResponse: CalendarApiResponse = {
  months: [
    {
      month: '2020-01',
      value: 120,
      state: 'value',
      anomaly: 1.5,
      anomaly_state: 'ok',
      source: 'VIIRS',
      provisional: false,
      partial: false,
      low_count: false,
    },
    {
      month: '2020-02',
      value: 0,
      state: 'zero',
      anomaly: 0,
      anomaly_state: 'ok',
      source: 'VIIRS',
      provisional: false,
      partial: false,
      low_count: false,
    },
  ],
  warnings: [],
  meta: {
    data_kind: 'synthetic',
    pipeline_version: '1.0.0',
    unit: 'count',
    cell_size_deg: 0.25,
    coverage: {
      first_month: '2020-01',
      last_month: '2020-02',
    },
    data_through: '2020-02-28',
    aoi_requested: { min_lat: 10, max_lat: 15, min_lon: 70, max_lon: 75 },
    aoi_analyzed: { min_lat: 10, max_lat: 15, min_lon: 70, max_lon: 75 },
    snapped: false,
    n_cells: 400,
    baseline: {
      basis: 'full_record',
      n_years: 1,
      median_by_calendar_month: [100, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  },
};

describe('Exported SVG Legend & Metadata Content', () => {
  it('CalendarHeatmap SVG contains legend, swatches, watermark, AOI and coverage', () => {
    const html = renderToString(React.createElement(CalendarHeatmap, { data: mockResponse }));
    
    // Legend content inside SVG
    expect(html).toContain('Fire Detections:');
    expect(html).toContain('0 (Hollow)');
    expect(html).toContain('No Data');
    expect(html).toContain('Provisional (NRT)');
    expect(html).toContain('cal-viridis-ramp');
    expect(html).toContain('cal-missing-data-hatch');

    // Watermark & metadata inside SVG
    expect(html).toContain('DEMONSTRATION DATA (SYNTHETIC)');
    expect(html).toContain('Coverage: Jan 2020 – Feb 2020');
    expect(html).toContain('AOI: [10.00°, 70.00°] to [15.00°, 75.00°]');

    // Absolute colors only (no var(--...))
    expect(html).not.toMatch(/var\(--/);
  });

  it('AnomalyHeatmap SVG contains legend, swatches, watermark, AOI and coverage', () => {
    const html = renderToString(React.createElement(AnomalyHeatmap, { data: mockResponse }));
    
    // Legend content inside SVG
    expect(html).toContain('Anomaly vs Median:');
    expect(html).toContain('&lt;=0.25x');
    expect(html).toContain('&gt;=4x');
    expect(html).toContain('No Data');
    expect(html).toContain('ano-missing-data-hatch');
    expect(html).toContain('n/c (partial)');
    expect(html).toContain('– (no baseline)');

    // Watermark & metadata inside SVG
    expect(html).toContain('DEMONSTRATION DATA (SYNTHETIC)');
    expect(html).toContain('Coverage: Jan 2020 – Feb 2020');
    expect(html).toContain('AOI: [10.00°, 70.00°] to [15.00°, 75.00°]');

    // Absolute colors only (no var(--...))
    expect(html).not.toMatch(/var\(--/);
  });
});
