// Shim: provides the aliases Person 5's components expect.
// This file lives at web/contracts/api/types.ts, which is where
// '../../../contracts/api/types' resolves from web/src/features/*/*.
//
// We re-export everything from the real contract file at the repo root.
// Path from web/contracts/api/ up to EmberTrace/ = ../../.. then into contracts/api/types
// But that would be circular. Instead we duplicate only the alias types here and
// import the core types from a path that works: going up to web/ then to repo contracts.

// From web/contracts/api/types.ts:
//   ../  = web/contracts/
//   ../../ = web/
//   ../  (one more) doesn't exist cleanly so we use the fact that web/src is in tsconfig include
//   and the real contracts/ is also included via "../contracts"
//
// Solution: re-export by going UP through web/ to the repo root contracts/:
// web/contracts/api/types.ts → ../../.. → three levels up from api/ → EmberTrace/
// But ../../.. from web/contracts/api/ is Desktop/NASA/EmberTrace/../.. = wrong
//
// ACTUAL count:
// web/contracts/api/ (depth 3 from EmberTrace)
// ../             = web/contracts/
// ../../          = web/
// ../../../       = EmberTrace/   <-- repo root
// So ../../../contracts/api/types = EmberTrace/contracts/api/types  <-- THE REAL FILE = SELF = circular
//
// Therefore: inline all exports from the canonical file directly here.

export type Month = string;
export type Source = 'VIIRS' | 'AQUA_calibrated' | 'TERRA_chained';
export type State = 'value' | 'zero' | 'unavailable';
export type AnomalyState = 'ok' | 'not_defined' | 'not_enough_history' | 'non_comparable_partial' | 'unavailable';
export type WarningCode = 'SYNTHETIC_DATA' | 'SNAPPED_AOI' | 'CHAINED_SEGMENT' | 'PROVISIONAL' | 'PARTIAL_MONTH' | 'LOW_COUNT';
export type ErrorCode = 'INVALID_AOI' | 'INVALID_DATES' | 'EMPTY_AREA' | 'OUT_OF_COVERAGE' | 'AOI_TOO_LARGE' | 'NOT_AVAILABLE';

export interface Bbox { type?: 'bbox'; min_lat: number; max_lat: number; min_lon: number; max_lon: number; }
export interface CalendarRequest { aoi: Bbox; start_month?: Month; end_month?: Month; }
export interface HealthResponse { status: 'ok'; data_kind: 'synthetic' | 'real'; pipeline_version: string; }
export interface Coverage { first_month: Month; last_month: Month; }
export interface GridExtent { min_lat: number; max_lat: number; min_lon: number; max_lon: number; }
export interface MetaResponse { data_kind: 'synthetic' | 'real'; pipeline_version: string; cell_size_deg: number; coverage: Coverage; data_through: string; provisional_from: Month; grid_extent: GridExtent; }
export interface Baseline { basis: 'full_record'; n_years: number; median_by_calendar_month: (number | null)[]; }
export interface CalendarMeta { data_kind: 'synthetic' | 'real'; pipeline_version: string; unit: string; cell_size_deg: number; coverage: Coverage; data_through: string; aoi_requested: Bbox; aoi_analyzed: Bbox; snapped: boolean; n_cells: number; baseline: Baseline; }
export interface MonthRow { month: Month; value: number | null; state: State; anomaly: number | null; anomaly_state: AnomalyState; source: Source | null; provisional: boolean; partial: boolean; low_count: boolean; }
export interface MonthRange { from: Month; to: Month; }
export interface ApiWarning { code: WarningCode | string; message: string; ranges: MonthRange[]; }
export interface CalendarResponse { meta: CalendarMeta; months: MonthRow[]; warnings: ApiWarning[]; }
export interface ErrorBody { code: ErrorCode; message: string; details: Record<string, unknown>; }
export interface ErrorResponse { error: ErrorBody; }

// Aliases expected by Person 5's components
export type SatelliteSensorSource = Source | null;
export type MonthState = State;
export type ApiMonthData = MonthRow;
export type CalendarApiResponse = CalendarResponse;
export type CalendarApiResponseMeta = CalendarMeta;
export type BoundingBox = Bbox;
export type ApiErrorEnvelope = ErrorResponse;
