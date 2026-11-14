/**
 * EmberTrace - Source labels shared by both calendars.
 * Each year gets a text tag naming its source(s); the first month of a new source gets a coloured
 * edge. Colour is never the only cue: the tag and the edge's tooltip both name the source.
 */

import React from 'react';
import { GridCell, YearRow } from './types';
import { SOURCE_INFO, formatMonthLabel } from './cellModel';

/** Width of the left column that holds the year and its source tag. */
export const ROW_LABEL_WIDTH = 112;
const YEAR_RIGHT_EDGE = 40;

export function RowLabel({
  row,
  cellHeight,
  selected,
  showSource,
}: {
  row: YearRow;
  cellHeight: number;
  selected: boolean;
  showSource: boolean;
}) {
  const y = cellHeight / 2 + 4;
  return (
    <>
      <text
        x={YEAR_RIGHT_EDGE}
        y={y}
        textAnchor="end"
        fontSize="12"
        fontWeight={selected ? '700' : '500'}
        fill={selected ? '#38bdf8' : '#94a3b8'}
      >
        {row.year}
      </text>
      {showSource && row.sources.length > 0 && (
        <text x={YEAR_RIGHT_EDGE + 7} y={y} fontSize="10" fontWeight="600">
          {row.sources.map((s, i) => (
            <tspan key={s} fill={SOURCE_INFO[s].color}>
              {i > 0 ? '/' : ''}
              {SOURCE_INFO[s].short}
            </tspan>
          ))}
          <title>{row.sources.map((s) => SOURCE_INFO[s].label).join(', then ')}</title>
        </text>
      )}
    </>
  );
}

/** Coloured bar in the gap left of the first month of a new source. */
export function HandoverEdge({ cell, cellHeight }: { cell: GridCell; cellHeight: number }) {
  if (!cell.isHandover || !cell.source) return null;
  const info = SOURCE_INFO[cell.source];
  return (
    <rect x={-3} y={-2} width={3} height={cellHeight + 4} rx={1} fill={info.color}>
      <title>
        {info.short} from {formatMonthLabel(cell.monthStr)}
      </title>
    </rect>
  );
}
