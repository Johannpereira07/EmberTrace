/**
 * EmberTrace - Anomaly Heatmap Component (Diverging Ratio vs Median)
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/AnomalyHeatmap.tsx
 */

import React, { useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { CalendarApiResponse, GridCell, ChartExportRef, NoticeTopic } from './types';
import { buildGridModel, MONTH_NAMES } from './cellModel';
import { getAnomalyColor, formatAnomaly, SPECIAL_CELL_COLORS } from '../../styles/scales';

export interface AnomalyHeatmapProps {
  data: CalendarApiResponse | null;
  isLoading?: boolean;
  selectedYear?: number | null;
  selectedMonth?: number | null;
  onCellClick?: (cell: GridCell) => void;
  onCellHover?: (cell: GridCell | null, event?: React.MouseEvent) => void;
  onNoticeRequest?: (topic: NoticeTopic) => void;
  showSensorMarkers?: boolean;
  className?: string;
}

export const AnomalyHeatmap = forwardRef<ChartExportRef, AnomalyHeatmapProps>(
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
      className = '',
    },
    ref
  ) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const model = useMemo(() => buildGridModel(data), [data]);

    const CELL_WIDTH = 46;
    const CELL_HEIGHT = 22;
    const CELL_GAP = 3;
    const LEFT_LABEL_WIDTH = 55;
    const TOP_HEADER_HEIGHT = 34;

    const gridWidth = LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP) + 20;
    const numRows = model.rows.length;
    const gridHeight = TOP_HEADER_HEIGHT + numRows * (CELL_HEIGHT + CELL_GAP) + 45;

    useImperativeHandle(ref, () => ({
      getSvgElement: () => svgRef.current,
      exportSvg: (filename = 'embertrace-anomaly.svg') => {
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
      exportPng: async (filename = 'embertrace-anomaly.png', scale = 2): Promise<Blob | null> => {
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
              ctx.fillStyle = '#ffffff';
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
            <span className="text-sm font-medium text-slate-600">Loading anomaly data...</span>
          </div>
        </div>
      );
    }

    if (!data || model.rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-500">
          No anomaly data available for selected area.
        </div>
      );
    }

    return (
      <div className={`overflow-x-auto bg-white p-4 rounded-xl border border-slate-200 shadow-sm ${className}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${gridWidth} ${gridHeight}`}
          width="100%"
          height="100%"
          style={{
            maxWidth: `${gridWidth}px`,
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            userSelect: 'none',
          }}
          role="img"
          aria-label="Harmonized Fire Anomaly Heatmap (2000-2026)"
        >
          <rect x="0" y="0" width={gridWidth} height={gridHeight} fill="#ffffff" />

          <g transform={`translate(${LEFT_LABEL_WIDTH}, ${TOP_HEADER_HEIGHT - 10})`}>
            {MONTH_NAMES.map((name, i) => (
              <text
                key={name}
                x={i * (CELL_WIDTH + CELL_GAP) + CELL_WIDTH / 2}
                y="0"
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#475569"
              >
                {name}
              </text>
            ))}
          </g>

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
                  fill={isSelectedYear ? '#1e293b' : '#64748b'}
                >
                  {row.year}
                </text>

                {isHandover2002 && (
                  <line
                    x1={LEFT_LABEL_WIDTH - 6}
                    y1="0"
                    x2={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP)}
                    y2="0"
                    stroke="#9333ea"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                )}
                {isHandover2012 && (
                  <line
                    x1={LEFT_LABEL_WIDTH - 6}
                    y1="0"
                    x2={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP)}
                    y2="0"
                    stroke="#059669"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                )}

                {row.cells.map((cell, cIdx) => {
                  const xPos = LEFT_LABEL_WIDTH + cIdx * (CELL_WIDTH + CELL_GAP);
                  const isSelected = isSelectedYear && selectedMonth === cell.month;
                  const colorInfo = cell.isOutOfRange
                    ? { fill: SPECIAL_CELL_COLORS.outOfRangeFill, stroke: SPECIAL_CELL_COLORS.outOfRangeStroke, textColor: '#94a3b8' }
                    : getAnomalyColor(cell.anomaly, cell.anomalyState);

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
                        fill={colorInfo.fill}
                        stroke={isSelected ? '#0284c7' : colorInfo.stroke}
                        strokeWidth={isSelected ? '2' : '1'}
                      />

                      {!cell.isOutOfRange && cell.anomaly !== null && (
                        <text
                          x={CELL_WIDTH / 2}
                          y={CELL_HEIGHT / 2 + 3.5}
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="600"
                          fill={colorInfo.textColor}
                        >
                          {formatAnomaly(cell.anomaly)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          <g transform={`translate(${LEFT_LABEL_WIDTH}, ${gridHeight - 16})`}>
            <text x="0" y="0" fontSize="10" fill="#94a3b8">
              {model.meta?.data_kind === 'synthetic'
                ? 'DEMONSTRATION DATA (SYNTHETIC) • NASA Space Apps Challenge 2026 • EmberTrace'
                : 'NASA FIRMS Harmonized Fire Record • EmberTrace'}
            </text>
          </g>
        </svg>
      </div>
    );
  }
);

AnomalyHeatmap.displayName = 'AnomalyHeatmap';

