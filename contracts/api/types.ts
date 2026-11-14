/**
 * EmberTrace - Canonical API Types (H3 Contract)
 * Source of truth: docs/04-api-spec.md & PRD v1.0
 * Shared between Person 3 (Backend API), Person 4 (App/Map), and Person 5 (Charts).
 */

export type SatelliteSensorSource = 'VIIRS' | 'AQUA_calibrated' | 'TERRA_chained' | null;

export type MonthState = 'value' | 'zero' | 'unavailable';

export type AnomalyState =
  | 'ok'
  | 'not_defined'
  | 'not_enough_history'
  | 'non_comparable_partial'
  | 'unavailable';

export interface ApiMonthData {
  month: string; // 'YYYY-MM'
  value: number | null; // VIIRS-equivalent detections per satellite
  state: MonthState; // 'value' | 'zero' | 'unavailable'
  anomaly: number | null; // value / baseline median
  anomaly_state: AnomalyState;
  source: SatelliteSensorSource;
  provisional: boolean; // True for NRT months
  partial: boolean; // True when incomplete at data_through
  low_count: boolean; // True when detections fall below threshold
}

export interface ApiWarning {
  code:
    | 'SYNTHETIC_DATA'
    | 'SNAPPED_AOI'
    | 'CHAINED_SEGMENT'
    | 'PROVISIONAL'
    | 'PARTIAL_MONTH'
    | 'LOW_COUNT'
    | string;
  message: string;
  ranges: Array<{ from: string; to: string }>;
}

export interface BoundingBox {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

export interface CalendarApiResponseMeta {
  data_kind: 'synthetic' | 'real';
  pipeline_version: string;
  unit: string;
  aoi_requested: {
    type: 'bbox' | 'polygon';
    min_lat?: number;
    max_lat?: number;
    min_lon?: number;
    max_lon?: number;
    geometry?: any;
  };
  aoi_analyzed: BoundingBox;
  snapped: boolean;
  cell_size_deg: number;
  n_cells: number;
  coverage: {
    first_month: string; // e.g. '2000-11'
    last_month: string;  // e.g. '2026-11'
  };
  data_through: string;
  baseline: {
    basis: 'full_record' | string;
    n_years: number;
    median_by_calendar_month: number[]; // 12 numbers: Jan (0) to Dec (11)
  };
}

export interface CalendarApiResponse {
  meta: CalendarApiResponseMeta;
  months: ApiMonthData[];
  warnings: ApiWarning[];
}

export interface ApiErrorEnvelope {
  error: {
    code:
      | 'INVALID_AOI'
      | 'INVALID_DATES'
      | 'EMPTY_AREA'
      | 'OUT_OF_COVERAGE'
      | 'AOI_TOO_LARGE'
      | 'NOT_AVAILABLE'
      | string;
    message: string;
    details?: Record<string, any>;
  };
}

