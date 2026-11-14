// H3: EmberTrace API request and response types (docs/04-api-spec.md). Owner: Person 3.
// Mirrors api/models.py; `make contract-test` checks the field names agree.
// Change rule (docs/03 §1): adding an optional field needs notice; renaming or removing needs the team.

export type Month = string; // "YYYY-MM", UTC calendar month

export type Source = "VIIRS" | "AQUA_calibrated" | "TERRA_chained";
export type State = "value" | "zero" | "unavailable";
export type AnomalyState =
  | "ok"
  | "not_defined"
  | "not_enough_history"
  | "non_comparable_partial"
  | "unavailable";
export type WarningCode =
  | "SYNTHETIC_DATA"
  | "SNAPPED_AOI"
  | "CHAINED_SEGMENT"
  | "PROVISIONAL"
  | "PARTIAL_MONTH"
  | "LOW_COUNT";
export type ErrorCode =
  | "INVALID_AOI"
  | "INVALID_DATES"
  | "EMPTY_AREA"
  | "OUT_OF_COVERAGE"
  | "AOI_TOO_LARGE"
  | "NOT_AVAILABLE";

// ---- Requests ----

export interface Bbox {
  type: "bbox";
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

/** Same body for /api/calendar, /api/download/monthly.csv and /api/download/detections.csv. */
export interface CalendarRequest {
  aoi: Bbox; // polygon is Should (API-10), not accepted yet: returns INVALID_AOI
  start_month?: Month; // default: coverage.first_month
  end_month?: Month; // default: coverage.last_month
}

// ---- GET /api/health ----

export interface HealthResponse {
  status: "ok";
  data_kind: "synthetic" | "real";
  pipeline_version: string;
}

// ---- GET /api/meta ----

export interface Coverage {
  first_month: Month;
  last_month: Month;
}

export interface GridExtent {
  min_lat: number;
  max_lat: number;
  min_lon: number;
  max_lon: number;
}

export interface MetaResponse {
  data_kind: "synthetic" | "real";
  pipeline_version: string;
  cell_size_deg: number;
  coverage: Coverage;
  data_through: string; // "YYYY-MM-DD"
  provisional_from: Month;
  grid_extent: GridExtent;
}

// ---- POST /api/calendar ----

export interface Baseline {
  basis: "full_record";
  n_years: number; // fewest years behind any calendar month's median
  median_by_calendar_month: (number | null)[]; // 12 values, Jan..Dec
}

export interface CalendarMeta {
  data_kind: "synthetic" | "real";
  pipeline_version: string;
  unit: string;
  cell_size_deg: number;
  coverage: Coverage;
  data_through: string;
  aoi_requested: Bbox;
  aoi_analyzed: Bbox;
  snapped: boolean;
  n_cells: number;
  baseline: Baseline;
}

export interface MonthRow {
  month: Month;
  value: number | null; // 0 = observed, no detections; null = unavailable
  state: State;
  anomaly: number | null; // non-null only when anomaly_state is "ok"
  anomaly_state: AnomalyState;
  source: Source | null;
  provisional: boolean;
  partial: boolean;
  low_count: boolean;
}

export interface MonthRange {
  from: Month;
  to: Month;
}

export interface ApiWarning {
  code: WarningCode;
  message: string;
  ranges: MonthRange[]; // empty = applies to the whole selection
}

export interface CalendarResponse {
  meta: CalendarMeta;
  months: MonthRow[];
  warnings: ApiWarning[];
}

// ---- Errors (all endpoints) ----

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
}

export interface ErrorResponse {
  error: ErrorBody;
}
