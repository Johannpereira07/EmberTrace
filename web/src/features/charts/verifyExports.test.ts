import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CalendarHeatmap } from './CalendarHeatmap';
import { AnomalyHeatmap } from './AnomalyHeatmap';
import type { CalendarApiResponse } from './types';
import normalDataJson from '../../../../contracts/fixtures/normal.json';
import sparseDataJson from '../../../../contracts/fixtures/sparse.json';

const normalData = normalDataJson as unknown as CalendarApiResponse;
const sparseData = sparseDataJson as unknown as CalendarApiResponse;

// Synthetic variant
const syntheticNormalData: CalendarApiResponse = {
  ...normalData,
  meta: {
    ...normalData.meta,
    data_kind: 'synthetic',
  },
};

describe('Export Verification for Normal & Sparse Fixtures', () => {
  it('verifies Normal Calendar Heatmap export', () => {
    const svg = renderToString(React.createElement(CalendarHeatmap, { data: normalData }));

    // 1. Legend is present
    expect(svg).toContain('Fire Detections:');
    expect(svg).toContain('0 (Hollow)');
    expect(svg).toContain('No Data');
    expect(svg).toContain('cal-viridis-ramp');
    expect(svg).toContain('cal-missing-data-hatch');

    // 2. Real data label
    expect(svg).toContain('NASA FIRMS Harmonized Fire Record • EmberTrace');

    // 3. Area and Date Range
    expect(svg).toContain('Coverage:');
    expect(svg).toContain('AOI:');

    // 4. No var(--...) used for styling
    expect(svg).not.toMatch(/var\(--/);

    // 5. Background is dark #090d16
    expect(svg).toContain('fill="#090d16"');
  });

  it('verifies Synthetic Calendar Heatmap export displays DEMONSTRATION DATA', () => {
    const svg = renderToString(React.createElement(CalendarHeatmap, { data: syntheticNormalData }));
    expect(svg).toContain('DEMONSTRATION DATA (SYNTHETIC)');
  });

  it('verifies Normal Anomaly Heatmap export', () => {
    const svg = renderToString(React.createElement(AnomalyHeatmap, { data: normalData }));

    // 1. Legend is present with end caps
    expect(svg).toContain('Anomaly vs Median:');
    expect(svg).toContain('&lt;=0.25x');
    expect(svg).toContain('&gt;=4x');
    expect(svg).toContain('ano-missing-data-hatch');

    // 2. Area and Date Range
    expect(svg).toContain('Coverage:');
    expect(svg).toContain('AOI:');

    // 3. No red colors anywhere
    expect(svg).not.toContain('#d6604d');
    expect(svg).not.toContain('#67001f');

    // 4. No var(--...)
    expect(svg).not.toMatch(/var\(--/);
  });

  it('verifies Sparse Calendar Heatmap export', () => {
    const svg = renderToString(React.createElement(CalendarHeatmap, { data: sparseData }));

    expect(svg).toContain('Fire Detections:');
    expect(svg).toContain('Coverage:');
    expect(svg).toContain('AOI:');
    expect(svg).toContain('cal-missing-data-hatch');
  });

  it('verifies Sparse Anomaly Heatmap export', () => {
    const svg = renderToString(React.createElement(AnomalyHeatmap, { data: sparseData }));

    expect(svg).toContain('Anomaly vs Median:');
    expect(svg).toContain('Coverage:');
    expect(svg).toContain('AOI:');
    expect(svg).toContain('ano-missing-data-hatch');
    expect(svg).not.toContain('#d6604d');
    expect(svg).not.toContain('#67001f');
  });
});
