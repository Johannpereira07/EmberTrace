/**
 * EmberTrace - Anomaly Heatmap Component (Diverging Ratio vs Median)
 * Person 5 (Charts Engineer)
 * Path: web/src/features/charts/AnomalyHeatmap.tsx
 */

import React, { useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { CalendarApiResponse, GridCell, ChartExportRef, NoticeTopic } from './types';
import { buildGridModel, MONTH_NAMES, getMonthRange, formatMonthLabel } from './cellModel';
import { RowLabel, HandoverEdge, ROW_LABEL_WIDTH } from './SourceMarks';
import { getAnomalyColor, formatAnomaly, SPECIAL_CELL_COLORS, ANOMALY_PALETTE } from '../../styles/scales';

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

/** Short codes for months that have a count but no anomaly ratio (explained in the legend). */
export const NO_RATIO_CODE: Partial<Record<string, string>> = {
  non_comparable_partial: 'n/c',
  not_defined: '–',
  not_enough_history: '–',
};

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
    const LEFT_LABEL_WIDTH = ROW_LABEL_WIDTH;
    const TOP_HEADER_HEIGHT = 34;

    const gridWidth = LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP) + 60;
    const numRows = model.rows.length;
    const rowsHeight = TOP_HEADER_HEIGHT + numRows * (CELL_HEIGHT + CELL_GAP);
    const LEGEND_TOP = rowsHeight + 20;
    const LEGEND_SECTION_HEIGHT = 80;
    const METADATA_SECTION_HEIGHT = 45;
    const gridHeight = LEGEND_TOP + LEGEND_SECTION_HEIGHT + METADATA_SECTION_HEIGHT;

    const range = data ? getMonthRange(data) : null;
    const dateRangeStr = range ? `${formatMonthLabel(range.first)} – ${formatMonthLabel(range.last)}` : '';
    const aoi = model.meta?.aoi_analyzed;
    const aoiStr = aoi
      ? `AOI: [${aoi.min_lat.toFixed(2)}°, ${aoi.min_lon.toFixed(2)}°] to [${aoi.max_lat.toFixed(2)}°, ${aoi.max_lon.toFixed(2)}°] (${model.meta?.n_cells ?? 0} cells)`
      : '';

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
            aria-label={`Harmonized fire anomaly calendar${model.rows.length ? `, ${model.rows[0].year} to ${model.rows[model.rows.length - 1].year}` : ''}`}
          >
          <rect x="0" y="0" width={gridWidth} height={gridHeight} rx="12" fill="#090d16" stroke="#1e293b" strokeWidth="1" />

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
          </g>

          {model.rows.map((row, rIdx) => {
            const yPos = TOP_HEADER_HEIGHT + rIdx * (CELL_HEIGHT + CELL_GAP);
            const isSelectedYear = selectedYear === row.year;

            return (
              <g key={row.year} transform={`translate(0, ${yPos})`}>
                <RowLabel row={row} cellHeight={CELL_HEIGHT} selected={isSelectedYear} showSource={showSensorMarkers} />

                {row.cells.map((cell, cIdx) => {
                  const xPos = LEFT_LABEL_WIDTH + cIdx * (CELL_WIDTH + CELL_GAP);
                  const isSelected = isSelectedYear && selectedMonth === cell.month;
                  // Months with a count but no ratio get a dark dashed cell and a short code, so they can't
                  // be read as the white "1.0x normal" colour.
                  const noRatio = !cell.isOutOfRange && cell.value !== null ? NO_RATIO_CODE[cell.anomalyState] : undefined;
                  const colorInfo = cell.isOutOfRange
                    ? { fill: '#0f172a', stroke: '#1e293b', textColor: '#64748b' }
                    : noRatio
                      ? { fill: '#0b1120', stroke: '#64748b', textColor: '#94a3b8' }
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
                        stroke={isSelected ? '#38bdf8' : colorInfo.stroke}
                        strokeWidth={isSelected ? '2' : '1'}
                        strokeDasharray={noRatio && !isSelected ? '3 2' : undefined}
                      />

                        {showSensorMarkers && <HandoverEdge cell={cell} cellHeight={CELL_HEIGHT} />}

                      {cell.isProvisional && !cell.isOutOfRange && (
                        <rect x="2" y="2" width="4" height="4" rx="1" fill="#f59e0b">
                          <title>Provisional NRT</title>
                        </rect>
                      )}

                      {noRatio && (
                        <text x={CELL_WIDTH / 2} y={CELL_HEIGHT / 2 + 3.5} textAnchor="middle" fontSize="9.5" fill={colorInfo.textColor}>
                          {noRatio}
                        </text>
                      )}

                      {!cell.isOutOfRange && !noRatio && cell.anomaly !== null && (
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

            {/* Embedded SVG Legend (Export & Screen) */}
            <g transform={`translate(0, ${LEGEND_TOP})`}>
              <line
                x1={LEFT_LABEL_WIDTH - 10}
                y1="-8"
                x2={LEFT_LABEL_WIDTH + 12 * (CELL_WIDTH + CELL_GAP) + 50}
                y2="-8"
                stroke="#1e293b"
                strokeWidth="1"
              />

              {/* Row 1: Ramp + swatches */}
              <g transform={`translate(${LEFT_LABEL_WIDTH}, 10)`}>
                <text x="0" y="0" fontSize="11" fontWeight="600" fill="#f8fafc">
                  Anomaly vs Median:
                </text>

                <text x="125" y="0" fontSize="10" fill="#38bdf8">&lt;= 0.25x</text>
                <g transform="translate(175, -9)">
                  {Object.values(ANOMALY_PALETTE).map((color, idx) => (
                    <rect key={idx} x={idx * 13} y="0" width="13" height="11" fill={color} stroke="#334155" strokeWidth="0.5" />
                  ))}
                </g>
                <text x="300" y="0" fontSize="10" fill="#f97316">&gt;= 4.0x</text>

                {/* n/c partial */}
                <rect x="350" y="-10" width="13" height="13" rx="2" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
                <text x="368" y="0" fontSize="10" fill="#94a3b8">n/c (partial)</text>

                {/* - no baseline */}
                <rect x="432" y="-10" width="13" height="13" rx="2" fill="#0f172a" stroke="#cbd5e1" strokeWidth="1" />
                <text x="450" y="0" fontSize="10" fill="#94a3b8">– (no baseline)</text>

                {/* Provisional */}
                <rect x="525" y="-8" width="9" height="9" rx="1.5" fill="#f59e0b" />
                <text x="539" y="0" fontSize="10" fill="#94a3b8">Provisional</text>
              </g>

              {/* Row 2: Sensor Epochs */}
              {showSensorMarkers && (
                <g transform={`translate(${LEFT_LABEL_WIDTH}, 34)`}>
                  <circle cx="5" cy="-3" r="4" fill="#a855f7" />
                  <text x="14" y="0" fontSize="10" fill="#94a3b8">Terra (Nov 2000 – Jun 2002)</text>

                  <circle cx="165" cy="-3" r="4" fill="#3b82f6" />
                  <text x="174" y="0" fontSize="10" fill="#94a3b8">Aqua (Jul 2002 – Dec 2011)</text>

                  <circle cx="325" cy="-3" r="4" fill="#10b981" />
                  <text x="334" y="0" fontSize="10" fill="#94a3b8">VIIRS (Jan 2012 – Present)</text>
                </g>
              )}

              {/* Row 3: Metadata, Disclaimer, AOI & Date Range */}
              <g transform={`translate(${LEFT_LABEL_WIDTH}, 62)`}>
                <line x1="0" y1="-8" x2={12 * (CELL_WIDTH + CELL_GAP) + 50} y2="-8" stroke="#1e293b" strokeWidth="1" />
                <text x="0" y="4" fontSize="10" fontWeight="600" fill={model.meta?.data_kind === 'synthetic' ? '#f59e0b' : '#94a3b8'}>
                  {model.meta?.data_kind === 'synthetic'
                    ? 'DEMONSTRATION DATA (SYNTHETIC) • NASA Space Apps Challenge 2026 • EmberTrace'
                    : 'NASA FIRMS Harmonized Fire Record • EmberTrace'}
                </text>
                <text x="0" y="19" fontSize="9.5" fill="#64748b">
                  {[dateRangeStr ? `Coverage: ${dateRangeStr}` : '', aoiStr].filter(Boolean).join('  •  ')}
                </text>
              </g>
            </g>
        </svg>
        </div>
      </div>
    );
  }
);

AnomalyHeatmap.displayName = 'AnomalyHeatmap';

