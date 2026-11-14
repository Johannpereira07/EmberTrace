"""Request and response shapes (API spec §4-6). contracts/api/types.ts mirrors these; the contract
test checks that the field names agree."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Source = Literal["VIIRS", "AQUA_calibrated", "TERRA_chained"]
State = Literal["value", "zero", "unavailable"]
AnomalyState = Literal["ok", "not_defined", "not_enough_history", "non_comparable_partial", "unavailable"]
WarningCode = Literal["SYNTHETIC_DATA", "SNAPPED_AOI", "CHAINED_SEGMENT", "PROVISIONAL",
                      "PARTIAL_MONTH", "LOW_COUNT"]


class CalendarRequest(BaseModel):
    # aoi is checked by hand (calendar.parse_aoi) so each problem gets its own INVALID_AOI message.
    aoi: dict[str, Any]
    start_month: Optional[str] = None
    end_month: Optional[str] = None


class Bbox(BaseModel):
    type: Literal["bbox"] = "bbox"
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


class Coverage(BaseModel):
    first_month: str
    last_month: str


class GridExtent(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


class Baseline(BaseModel):
    basis: Literal["full_record"]
    n_years: int
    median_by_calendar_month: list[Optional[float]]   # Jan..Dec, null when no month to take it from


class CalendarMeta(BaseModel):
    data_kind: Literal["synthetic", "real"]
    pipeline_version: str
    unit: str
    cell_size_deg: float
    coverage: Coverage
    data_through: str
    aoi_requested: Bbox
    aoi_analyzed: Bbox
    snapped: bool
    n_cells: int
    baseline: Baseline


class Month(BaseModel):
    month: str
    value: Optional[float]
    state: State
    anomaly: Optional[float]
    anomaly_state: AnomalyState
    source: Optional[Source]
    provisional: bool
    partial: bool
    low_count: bool


class MonthRange(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_: str = Field(alias="from")
    to: str


class Warning(BaseModel):
    code: WarningCode
    message: str
    ranges: list[MonthRange]


class CalendarResponse(BaseModel):
    meta: CalendarMeta
    months: list[Month]
    warnings: list[Warning]


class MetaResponse(BaseModel):
    data_kind: Literal["synthetic", "real"]
    pipeline_version: str
    cell_size_deg: float
    coverage: Coverage
    data_through: str
    provisional_from: str
    grid_extent: GridExtent


class HealthResponse(BaseModel):
    status: Literal["ok"]
    data_kind: Literal["synthetic", "real"]
    pipeline_version: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any]


class ErrorResponse(BaseModel):
    error: ErrorBody
