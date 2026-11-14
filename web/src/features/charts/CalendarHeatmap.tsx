/**
 * EmberTrace - Calendar Heatmap Component (Activity Counts)
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/CalendarHeatmap.tsx
 */

import React, { useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { CalendarApiResponse, GridCell, ChartExportRef, NoticeTopic } from './types';
import { buildGridModel, MONTH_NAMES } from './cellModel';
import { getActivityColor, formatCount, SPECIAL_CELL_COLORS } from '../../styles/scales';

export interface CalendarHeatmapProps {
  data: CalendarApiResponse | null;
  isLoading?: boolean;
  selectedYear?: number | null;
  selectedMonth?: number | null;
  onCellClick?: (cell: GridCell) => void;
  onCellHover?: (cell: GridCell | null, event?: React.MouseEvent) => void;
  onNoticeRequest?: (topic: NoticeTopic) => void;
  showSensorMarkers?: boolean;
  showMedianRow?: boolean;
  maxCountOverride?: number;
  className?: string;
}

export const CalendarHeatmap = forwardRef<ChartExportRef, CalendarHeatmapProps>(
  (
    {
      data,
      isLoading = false,
      selectedYear,
      selectedMonth,
      onCellClick,
      onCellHover,
      onNoticeRequest,
      showSensorMarkers = true,
      showMedianRow = true,
      maxCountOverride,
      className = '',
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const model = useMemo(() => buildGridModel(data), [data]);
    const effectiveMax = maxCountOverride || model.maxCount;

    const CELL_WIDTH = 46;
    const CELL_HEIGHT = 22;
    const CELL_GAP = 3;
    const LEFT_LABEL_WIDTH = 55;
    const TOP_HEADER_HEIGHT = 34;
    const MEDIAN_ROW_GAP = 12;

    const gridWidth = LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP) + 60;
    const numRows = model.rows.length;
    const gridHeight =
      TOP_HEADER_HEIGHT +
      numRows * (CELL_HEIGHT + CELL_GAP) +
      (showMedianRow ? MEDIAN_ROW_GAP + CELL_HEIGHT : 0) +
      45;

    useImperativeHandle(ref, () => ({
      getSvgElement: () => svgRef.current,
      exportSvg: (filename = 'embertrace-calendar.svg') => {
        if (!svgRef.current) return '';
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgRef.current);
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return source;
      },
      exportPng: async (filename = 'embertrace-calendar.png', scale = 2): Promise<Blob | null> => {
        if (!svgRef.current) return null;
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgRef.current);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const URLObj = window.URL || window.webkitURL || window;
        const blobURL = URLObj.createObjectURL(svgBlob);

        return new Promise((resolve) => {
          const image = new Image();
          image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = gridWidth * scale;
            canvas.height = gridHeight * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.scale(scale, scale);
              ctx.fillStyle = '#090d16';
              ctx.fillRect(0, 0, gridWidth, gridHeight);
              ctx.drawImage(image, 0, 0);
              canvas.toBlob((blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = filename;
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
          image.src = blobURL;
        });
      },
    }));

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-96 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-slate-600">Loading harmonized calendar data...</span>
          </div>
        </div>
      );
    }

    if (!data || model.rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500">
          No calendar data available for selected area.
        </div>
      );
    }

    return (
      <div className={`w-full overflow-x-auto bg-slate-900/80 backdrop-blur-xl p-5 rounded-2xl border border-slate-800 shadow-2xl shrink-0 ${className}`}>
        <div style={{ minWidth: `${gridWidth}px`, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${gridWidth} ${gridHeight}`}
            width={gridWidth}
            height={gridHeight}
            style={{
              display: 'block',
              width: `${gridWidth}px`,
              height: `${gridHeight}px`,
              minWidth: `${gridWidth}px`,
              minHeight: `${gridHeight}px`,
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              userSelect: 'none',
            }}
            role="img"
            aria-label="Harmonized Fire Activity Calendar (2000-2026)"
          >
            <rect x="0" y="0" width={gridWidth} height={gridHeight} rx="12" fill="#090d16" stroke="#1e293b" strokeWidth="1" />

            {/* Header: Month Names & Total */}
            <g transform={`translate(${LEFT_LABEL_WIDTH}, ${TOP_HEADER_HEIGHT - 10})`}>
              {MONTH_NAMES.map((name, i) => (
                <text
                  key={name}
                  x={i * (CELL_WIDTH + CELL_GAP) + CELL_WIDTH / 2}
                  y="0"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#94a3b8"
                >
                  {name}
                </text>
              ))}
              <text
                x={12 * (CELL_WIDTH + CELL_GAP) + 12}
                y="0"
                textAnchor="start"
                fontSize="11"
                fontWeight="600"
                fill="#94a3b8"
              >
                Total
              </text>
            </g>

            {/* Rows: Years 2000 - 2026 */}
            {model.rows.map((row, rIdx) => {
              const yPos = TOP_HEADER_HEIGHT + rIdx * (CELL_HEIGHT + CELL_GAP);
              const isSelectedYear = selectedYear === row.year;
              const isHandover2002 = showSensorMarkers && row.year === 2002;
              const isHandover2012 = showSensorMarkers && row.year === 2012;

              return (
                <g key={row.year} transform={`translate(0, ${yPos})`}>
                  <text
                    x={LEFT_LABEL_WIDTH - 12}
                    y={CELL_HEIGHT / 2 + 4}
                    textAnchor="end"
                    fontSize="12"
                    fontWeight={isSelectedYear ? '700' : '500'}
                    fill={isSelectedYear ? '#38bdf8' : '#94a3b8'}
                  >
                    {row.year}
                  </text>

                  {isHandover2002 && (
                    <line
                      x1={LEFT_LABEL_WIDTH - 6}
                      y1="0"
                      x2={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP)}
                      y2="0"
                      stroke="#a855f7"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      opacity="0.9"
                    />
                  )}
                  {isHandover2012 && (
                    <line
                      x1={LEFT_LABEL_WIDTH - 6}
                      y1="0"
                      x2={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP)}
                      y2="0"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                      opacity="0.9"
                    />
                  )}

                  {row.cells.map((cell, cIdx) => {
                    const xPos = LEFT_LABEL_WIDTH + cIdx * (CELL_WIDTH + CELL_GAP);
                    const isSelected = isSelectedYear && selectedMonth === cell.month;
                    const colorInfo = cell.isOutOfRange
                      ? { fill: '#0f172a', stroke: '#1e293b', isHollow: false }
                      : getActivityColor(cell.value, effectiveMax);

                    const isDarkFill = !colorInfo.isHollow && cell.value !== null && cell.value > effectiveMax * 0.25;
                    const textFill = isDarkFill ? '#090d16' : '#f8fafc';
                    const cellFill = colorInfo.isHollow ? '#090d16' : colorInfo.fill;
                    const cellStroke = isSelected ? '#38bdf8' : (colorInfo.isHollow ? '#475569' : colorInfo.stroke);

                    return (
                      <g
                        key={cell.monthStr}
                        transform={`translate(${xPos}, 0)`}
                        style={{ cursor: cell.isOutOfRange ? 'default' : 'pointer' }}
                        onClick={() => !cell.isOutOfRange && onCellClick?.(cell)}
                        onMouseEnter={(e) => !cell.isOutOfRange && onCellHover?.(cell, e)}
                        onMouseLeave={() => onCellHover?.(null)}
                        tabIndex={cell.isOutOfRange ? -1 : 0}
                        role="gridcell"
                        aria-label={cell.ariaLabel}
                      >
                        <rect
                          x="0"
                          y="0"
                          width={CELL_WIDTH}
                          height={CELL_HEIGHT}
                          rx="2.5"
                          ry="2.5"
                          fill={cellFill}
                          stroke={cellStroke}
                          strokeWidth={isSelected ? '2' : '1'}
                        />

                        {cell.source === 'TERRA_chained' && !cell.isOutOfRange && (
                          <circle cx={CELL_WIDTH - 4} cy="4" r="2" fill="#a855f7">
                            <title>Terra Chained</title>
                          </circle>
                        )}

                        {cell.isProvisional && !cell.isOutOfRange && (
                          <rect x="2" y="2" width="4" height="4" rx="1" fill="#f59e0b">
                            <title>Provisional NRT</title>
                          </rect>
                        )}

                        {!cell.isOutOfRange && cell.value !== null && (
                          <text
                            x={CELL_WIDTH / 2}
                            y={CELL_HEIGHT / 2 + 3.5}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight={colorInfo.isHollow ? '400' : '600'}
                            fill={colorInfo.isHollow ? '#64748b' : textFill}
                          >
                            {cell.value === 0 ? '0' : formatCount(cell.value)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  <text
                    x={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP) + 12}
                    y={CELL_HEIGHT / 2 + 4}
                    textAnchor="start"
                    fontSize="11"
                    fontWeight="600"
                    fill="#94a3b8"
                  >
                    {row.annualTotal !== null ? formatCount(row.annualTotal) : '—'}
                  </text>
                </g>
              );
            })}

            {/* Historical Monthly Median Summary Row */}
            {showMedianRow && (
              <g
                transform={`translate(0, ${
                  TOP_HEADER_HEIGHT + numRows * (CELL_HEIGHT + CELL_GAP) + MEDIAN_ROW_GAP
                })`}
              >
                <line
                  x1={LEFT_LABEL_WIDTH - 10}
                  y1="-6"
                  x2={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP) + 50}
                  y2="-6"
                  stroke="#1e293b"
                  strokeWidth="1"
                />

                <text
                  x={LEFT_LABEL_WIDTH - 12}
                  y={CELL_HEIGHT / 2 + 4}
                  textAnchor="end"
                  fontSize="11"
                  fontWeight="700"
                  fill="#94a3b8"
                >
                  Median
                </text>

                {Array.from({ length: 12 }, (_, i) => i).map((i) => {
                  const med = model.monthlyMedians[i] ?? null;
                  const xPos = LEFT_LABEL_WIDTH + i * (CELL_WIDTH + CELL_GAP);
                  const colorInfo = getActivityColor(med, effectiveMax);
                  const isDark = !colorInfo.isHollow && med !== null && med > effectiveMax * 0.25;

                  return (
                    <g key={`median-${i}`} transform={`translate(${xPos}, 0)`}>
                      <rect
                        x="0"
                        y="0"
                        width={CELL_WIDTH}
                        height={CELL_HEIGHT}
                        rx="2.5"
                        fill={colorInfo.isHollow ? '#090d16' : colorInfo.fill}
                        stroke={colorInfo.isHollow ? '#475569' : colorInfo.stroke}
                        strokeWidth="1"
                      />
                      <text
                        x={CELL_WIDTH / 2}
                        y={CELL_HEIGHT / 2 + 3.5}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight="600"
                        fill={isDark ? '#090d16' : '#f8fafc'}
                      >
                        {formatCount(med)}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Watermark / Synthetic Disclaimer */}
            <g transform={`translate(${LEFT_LABEL_WIDTH}, ${gridHeight - 16})`}>
              <text x="0" y="0" fontSize="10" fill="#64748b">
                {model.meta?.data_kind === 'synthetic'
                  ? 'DEMONSTRATION DATA (SYNTHETIC) • NASA Space Apps Challenge 2026 • EmberTrace'
                  : 'NASA FIRMS Harmonized Fire Record • EmberTrace'}
              </text>
            </g>
          </svg>
        </div>
      </div>
    );
  }
);

CalendarHeatmap.displayName = 'CalendarHeatmap';

