/**
 * EmberTrace - Frontend Chart Types & H4 Component Props Contract
 * Person 5 (Charts Engineer) & Person 4 (App/Map Lead)
 * Path: web/src/features/charts/types.ts
 */

import {
  CalendarApiResponse,
  ApiMonthData,
  SatelliteSensorSource,
  MonthState,
  AnomalyState,
  ApiWarning,
} from '../../../contracts/api/types';

export type {
  CalendarApiResponse,
  ApiMonthData,
  SatelliteSensorSource,
  MonthState,
  AnomalyState,
  ApiWarning,
};

export interface GridCell {
  year: number;
  month: number; // 1 to 12
  monthStr: string; // 'YYYY-MM'
  data: ApiMonthData | null;
  value: number | null;
  state: MonthState;
  anomaly: number | null;
  anomalyState: AnomalyState;
  source: SatelliteSensorSource;
  isProvisional: boolean;
  isPartial: boolean;
  isLowCount: boolean;
  isOutOfRange: boolean;
  isZero: boolean;
  /** First month of a new source (the month before had a different, non-null source). */
  isHandover: boolean;
  tooltipText: string;
  ariaLabel: string;
}

export interface YearRow {
  year: number;
  cells: GridCell[];
  annualTotal: number | null;
  hasTerraChained: boolean;
  hasAquaCalibrated: boolean;
  hasViirs: boolean;
  /** Sources in this year, in the order they first appear (from each month's `source`). */
  sources: NonNullable<SatelliteSensorSource>[];
}

/** One source's stretch of the record, for the legend. */
export interface SourceSpan {
  source: NonNullable<SatelliteSensorSource>;
  from: string; // 'YYYY-MM'
  to: string; // 'YYYY-MM'
}

export interface GridModel {
  rows: YearRow[];
  maxCount: number;
  totalValidMonths: number;
  monthlyMedians: number[]; // 12 entries: Jan to Dec
  meta: CalendarApiResponse['meta'] | null;
  warnings: ApiWarning[];
  sourceSpans: SourceSpan[];
}

export type NoticeTopic = 'terra_chain' | 'provisional' | 'low_count' | 'synthetic_watermark';

// H4 Component Props: FireCalendar
export interface FireCalendarProps {
  response: CalendarApiResponse | null;
  mode?: 'activity' | 'anomaly';
  showProvenance?: boolean; // Sensor handover lines & epoch accents
  showMedianRow?: boolean;  // Historical median baseline summary row
  selectedYear?: number | null;
  selectedMonth?: number | null;
  onCellClick?: (cell: GridCell) => void;
  onCellHover?: (cell: GridCell | null, event?: React.MouseEvent) => void;
  onNoticeRequest?: (topic: NoticeTopic) => void;
  isLoading?: boolean;
  className?: string;
}

export interface ChartExportRef {
  getSvgElement: () => SVGSVGElement | null;
  exportSvg: (filename?: string) => string;
  exportPng: (filename?: string, scale?: number) => Promise<Blob | null>;
}

