/**
 * EmberTrace - FireCalendar Unified H4 Component
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/FireCalendar.tsx
 * 
 * Drop-in component consumed by Person 4 (App Lead) via H4 contract:
 * <FireCalendar response={apiResponse} mode="activity" | "anomaly" showProvenance={true} />
 */

import React, { useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { FireCalendarProps, ChartExportRef } from './types';
import { CalendarHeatmap } from './CalendarHeatmap';
import { AnomalyHeatmap } from './AnomalyHeatmap';
import { ChartLegend } from './ChartLegend';
import { getSourceSpans } from './cellModel';

export const FireCalendar = forwardRef<ChartExportRef, FireCalendarProps>(
  (
    {
      response,
      mode = 'activity',
      showProvenance = true,
      showMedianRow = true,
      selectedYear,
      selectedMonth,
      onCellClick,
      onCellHover,
      onNoticeRequest,
      isLoading = false,
      className = '',
    },
    ref
  ) => {
    const internalRef = useRef<ChartExportRef | null>(null);
    const sourceSpans = useMemo(() => getSourceSpans(response), [response]);

    useImperativeHandle(ref, () => ({
      getSvgElement: () => internalRef.current?.getSvgElement() ?? null,
      exportSvg: (filename) => internalRef.current?.exportSvg(filename) ?? '',
      exportPng: (filename, scale) => internalRef.current?.exportPng(filename, scale) ?? Promise.resolve(null),
    }));

    return (
      <div className={`space-y-4 shrink-0 w-full ${className}`}>
        {/* Accessible Legend */}
        <ChartLegend
          type={mode}
          maxCount={response?.months.reduce((max, m) => Math.max(max, m.value ?? 0), 1) ?? 1000}
          onNoticeClick={(topic) => onNoticeRequest?.(topic)}
          sources={showProvenance ? sourceSpans : []}
        />

        {/* Heatmap View */}
        {mode === 'activity' ? (
          <CalendarHeatmap
            ref={internalRef}
            data={response}
            isLoading={isLoading}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onCellClick={onCellClick}
            onCellHover={onCellHover}
            onNoticeRequest={onNoticeRequest}
            showSensorMarkers={showProvenance}
            showMedianRow={showMedianRow}
          />
        ) : (
          <AnomalyHeatmap
            ref={internalRef}
            data={response}
            isLoading={isLoading}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onCellClick={onCellClick}
            onCellHover={onCellHover}
            onNoticeRequest={onNoticeRequest}
            showSensorMarkers={showProvenance}
          />
        )}
      </div>
    );
  }
);

FireCalendar.displayName = 'FireCalendar';

/**
 * H4 Export Helper: exportChart(element, format)
 */
export async function exportChart(
  element: SVGSVGElement | null,
  format: 'svg' | 'png' = 'png',
  filename = 'embertrace-chart'
): Promise<string | Blob | null> {
  if (!element) return null;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(element);

  if (format === 'svg') {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.svg`;
    link.click();
    URL.revokeObjectURL(url);
    return svgString;
  }

  // PNG Export at 2x
  return new Promise((resolve) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URLObj = window.URL || window.webkitURL || window;
    const blobURL = URLObj.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      const width = element.viewBox?.baseVal?.width || element.clientWidth || 760;
      const height = element.viewBox?.baseVal?.height || element.clientHeight || 850;
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.png`;
            link.click();
            URL.revokeObjectURL(url);
            resolve(blob);
          } else {
            resolve(null);
          }
        }, 'image/png');
      } else {
        resolve(null);
      }
      URLObj.revokeObjectURL(blobURL);
    };

    img.src = blobURL;
  });
}

