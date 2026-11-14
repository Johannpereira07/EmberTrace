# EmberTrace: API Specification

Role 4: API and Backend Lead  |  NASA Space Apps 2026, Challenge 15

|**Item**|**Detail**|
|---|---|
|Version|0.1 (draft)|
|Status|Draft for the UI role (Role 5) and team review. Field names marked [Pending] depend on the`cell_month.csv`schema from Role 1.|
|Date|13 November 2026|
|Sources|EmberTrace PRD v1.0 (12 Nov 2026); Task Delegation: Burning Activity Calendar (12 Nov 2026); Architecture and Methodology (draft, 9 Nov 2026)|
|Data used for examples|Synthetic only. Every number in this document is demonstration data.|

##### **Status labels**

- Rules that come from the PRD or Task Delegation carry a citation, for example (PRD 5.1).

- `[Proposed]` means this spec recommends it and the team can change it.

- `[Pending]` means it depends on another role's input and must not be frozen yet.

### **1. Overview**

The API is a thin, read-only layer over the precomputed pipeline output ( `cell_month.csv` ). For each request it maps the selected area to grid cells, sums the harmonized values per month, and builds the calendar and anomaly values. It never recalibrates satellites per request or per area (PRD 6.1; Architecture 8).

**Sample data for the backend:** `contracts/samples/cell_month.central-india.csv` and `meta.central-india.json`, real FIRMS data for this spec's example area. It's a stand-in until Person 2's H2 schema, so read `contracts/samples/README.md` for its rules and quirks.

The frontend is built against mock responses first. Mock and real responses share one shape, so switching to the real archive changes `meta.data_kind` from `synthetic` to `real` and changes no field (PRD 8, Maintainability).

### **2. Conventions**

- JSON over HTTPS, UTF-8. Data requests use POST because the body carries the area.

- All endpoints are under the `/api` prefix. The same container serves the built frontend at `/`, so the frontend calls the API on the same origin and needs no CORS (see [Deployment](06-deployment.md)).

- Months are strings in the form `YYYY-MM` . Coordinates are decimal degrees.

- `0` means a month was observed with no detections. `null` means no observation was possible. The two are never interchanged, from pipeline to API to CSV (PRD 6.3, 8).

- The API is public and read-only: no accounts, no uploads. The server validates all input (PRD 8, Security).

- Warnings are returned alongside results. They never block a response (PRD 5.6).

- Function signatures, file schemas and API fields change only after the owner tells everyone affected (Task Delegation, working rules).

- The API never returns months before `coverage.first_month` . The frontend draws earlier months of the first year as unavailable (PRD 5.3).

- Values are VIIRS-equivalent detections per satellite (Architecture 6.5, 6.7), so they are not whole numbers.

- Coverage may be regional and shorter at first. The first archive request is a small region (Architecture 11), so `coverage.first_month` may start after 2000-11 and `OUT_OF_COVERAGE` will be common until the full record is processed.

### **3. Endpoint Summary**

|**Method and path**|**Purpose**|**PRD** **priority**|
|---|---|---|
|`GET /api/health`|Liveness check for Cloud Run and the deploy smoke test. Returns `200 {"status": "ok", "data_kind": ..., "pipeline_version": ...}` once the data is loaded|`[Proposed]` (API-9)|
|`GET /api/meta`|Coverage, cell size, data kind and provisional boundary, so the UI can configure itself before an area is chosen|`[Proposed]`|
|`POST /api/calendar`|Calendar table, anomaly table, per-month flags and warnings for an area and date range|Must|
|`POST /api/download/monthly.csv`|The same monthly data for the selected area as a CSV file|Must|
|`POST /api/download/chart`|Calendar and anomaly image (PNG or SVG). Optional on the server; see 7.2|Should|
|`POST` `/api/download/detections.csv`|Raw detections inside the area. Returns`501`for now|Could|

### **4. GET /api/meta  [Proposed]**

The PRD requires the UI to read the cell size from the data instead of hard-coding it (5.1) and to label provisional months from data (5.6). This endpoint supplies those values, plus the grid extent needed for the out-of-coverage check.

```json
{
  "data_kind": "synthetic",
  "pipeline_version": "0.1-synthetic",
  "cell_size_deg": 0.25,
  "coverage": {"first_month": "2000-11", "last_month": "2026-11"},
  "data_through": "2026-11-12",
  "provisional_from": "2026-08",
  "grid_extent": {"min_lat": 5, "max_lat": 40, "min_lon": 60, "max_lon": 100}
}
```

`provisional_from` is the first month of the near-real-time (NRT) period. Both it and `cell_size_deg` must come from a pipeline output, because today neither is written to any output file (cell size is only the `--res` setting). See open item O2 in section 9.

### **5. POST /api/calendar**

#### **5.1 Request**

```json
{
  "aoi": {
    "type": "bbox",
    "min_lat": 20.8,
    "max_lat": 21.6,
    "min_lon": 78.5,
    "max_lon": 79.5
  },
  "start_month": "2000-11",
  "end_month": "2026-11"
}
```

|**Field**|**Type**|**Required**|**Description**|
|---|---|---|---|
|`aoi`|object|Yes|The area of interest|
|`aoi.type`|string|Yes|`bbox`(Must) or`polygon`(Should, `[Proposed]`)|
|`aoi.min_lat`,`aoi.max_lat`, `aoi.min_lon`,`aoi.max_lon`|number|For`bbox`|Rectangle bounds in decimal degrees. Map drawing and manual entry both produce this shape|
|`aoi.geometry`|GeoJSON Polygon|For `polygon`|Polygon in longitude, latitude order|
|`start_month`|string|No|Default:`coverage.first_month`(2000-11)|
|`end_month`|string|No|Default:`coverage.last_month`|

##### **Validation rules (PRD 5.1, 5.2):**

- Latitude within -90 to 90, longitude within -180 to 180, minimum less than maximum.

- `start_month` not after `end_month` ; both within `coverage` .

- The area must contain at least one grid cell and intersect the data grid.

#### **5.2 Snapping to grid cells  [Proposed]**

The PRD requires snapping to whole grid cells and showing the area actually analyzed (5.1). The sources do not say how to round. This spec snaps outward: minimums round down and maximums round up to the cell boundary, so the analyzed area always contains the requested area. For a polygon, a cell is included when its center lies inside the polygon. The response reports the result in `meta.aoi_analyzed` .

#### **5.3 Response: meta**

|**Field**|**Type**|**Description**|
|---|---|---|
|`data_kind`|string|`synthetic`or`real`. The UI labels synthetic data as demonstration data (PRD 5.6, 12.3)|
|`pipeline_version`|string|Version of the pipeline output being served|
|`unit`|string|Unit of`value`: VIIRS-equivalent detections per satellite (non-integer values)|
|`aoi_requested`|object|The area as sent|
|`aoi_analyzed`|object|The area after snapping, in the same shape as a`bbox`|
|`snapped`|boolean|True when the analyzed area differs from the requested area|
|`cell_size_deg`|number|Grid cell size in degrees, for the snapping notice|
|`n_cells`|integer|Number of grid cells in the analyzed area|
|`coverage`|object|`first_month`and`last_month`available in the data. `first_month`may be later than 2000-11 until the full record is processed|
|`data_through`|string (date)|Last day covered by the data. Used to decide whether the latest month is partial|
|`baseline`|object|`basis`(`full_record`),`n_years`, and `median_by_calendar_month`(12 values, January to December, in the unit of`value`)|

#### **5.4 Response: months**

One entry per month in the requested range, in order, including unavailable months.

|**Field**|**Type**|**Description**|
|---|---|---|
|`month`|string|`YYYY-MM`|
|`value`|number or null|Sum of the harmonized per-cell values over all cells in the analyzed area.`0`when observed with no detections;`null` when unavailable|
|`state`|string|`value`,`zero`or`unavailable`. Lets the UI draw the three cell states without testing for null|
|`anomaly`|number or null|`value`divided by the baseline median for the same calendar month. Non-null only when`anomaly_state`is`ok`|
|`anomaly_state`|string|`ok`,`not_defined`(median is zero or cannot be computed), `not_enough_history`,`non_comparable_partial`, or `unavailable`|
|`source`|string or null|`VIIRS`(Jan 2012 onward),`AQUA_calibrated`(Jul 2002 to Dec 2011) or`TERRA_chained`(Nov 2000 to Jun 2002).`null` when unavailable|
|`provisional`|boolean|True for NRT months, from`provisional_from`onward|
|`partial`|boolean|True when the month is not complete at`data_through`|
|`low_count`|boolean|True when the raw detections of the source sensor in the area for the month fall below the configured threshold|

The UI derives "converted year" ( `source` is not `VIIRS` ) and "lower confidence" ( `source` is `TERRA_chained` ) from `source` . They are not separate fields, so they cannot disagree with it.

#### **5.5 Response: warnings**

Each warning has a `code` , a plain-language `message` , and `ranges` , a list of `{from, to}` month ranges it applies to (empty when it applies to the whole selection).

|**Code**|**When it appears**|
|---|---|
|`SYNTHETIC_DATA`|`meta.data_kind`is`synthetic`|
|`SNAPPED_AOI`|`meta.snapped`is true|
|`CHAINED_SEGMENT`|The range includes months from 2000-11 to 2002-06|
|`PROVISIONAL`|The range includes months from`provisional_from`|
|`PARTIAL_MONTH`|The latest month in the range is incomplete|
|`LOW_COUNT`|Any month in the range has`low_count`true|

#### **5.6 Computation rules**

- **Value.** Select the cells inside `aoi_analyzed` , then sum their harmonized values per month. A month is `unavailable` when no satellite was observing (NaN in the pipeline). A month with observations and no detections is `zero` . NaN depends only on whether a satellite series was flying, not on the cell (Architecture 6.5), and empty cells are filled with 0 (6.4). A month is therefore unavailable for every cell or for none.

- **Anomaly.** `value` divided by the median of the harmonized values for the same calendar month across the baseline years (PRD 5.4). If the median is zero or cannot be computed, `anomaly_state` is `not_defined` and `anomaly` is `null` . A partial month is `non_comparable_partial` .

- **Baseline.** `[Proposed]` The baseline is always the full available record, not the selected range, so a narrower view does not change what 1.0 means (PRD Appendix A, D1).

- **Not enough history.** `not_enough_history` applies when fewer years than a configured minimum exist for a calendar month. The threshold is set when real data is available (D5).

- **Low count.** `[Proposed]` Based on the raw detection counts of the source sensor in the area, which `cell_month.csv` keeps per sensor (Architecture 4), not on the converted value. The threshold is a server configuration value, not a code constant, and is set after seeing real data (D5). The columns are currently `terra_count`, `aqua_count` and `viirs_count` (see `contracts/normalized.schema.md`; final names in H2). Compute `low_count` only for months that have a `source`, and leave it `false` for `unavailable` months. **Never use a raw count to decide `state`**: raw counts are 0 even when no satellite was flying, so `unavailable` vs `zero` must come from the harmonized value being null.

- **Provisional and partial.** Both come from data ( `provisional_from` , `data_through` ), never from fixed UI constants (PRD 5.6, D4).

### **6. Errors**

All failures use one envelope. No partial or wrong result is ever returned with an error (PRD 8, Reliability).

```json
{
  "error": {
    "code": "INVALID_AOI",
    "message": "min_lat must be less than max_lat.",
    "details": {"field": "aoi.min_lat", "received": {"min_lat": 25, "max_lat": 20}}
  }
}
```

|**HTTP**|**Code**|**Trigger**|**details**|
|---|---|---|---|
|400|`INVALID_AOI`|Latitude or longitude out of range, minimum not less than maximum, malformed polygon|`field`,`received`|
|400|`INVALID_DATES`|Bad format, start after end, or outside the coverage range|`field`,`coverage`|
|422|`EMPTY_AREA`|The area is valid but contains no grid cells|`aoi_analyzed`|
|422|`OUT_OF_COVERAGE`|The area is entirely outside the data grid|`grid_extent`|
|413|`AOI_TOO_LARGE`|Optional. Only if a size limit is set after performance testing (PRD 5.1,`[Proposed]`)|`max_cells`|
|501|`NOT_AVAILABLE`|Raw detections download before real data exists|none|

### **7. Download Endpoints**

All three accept the same request body as `/api/calendar` , so a download always matches what the user saw.

#### **7.1 POST /api/download/monthly.csv  (Must)**

The CSV matches the display and records the area as analyzed, the date range and the cell size (PRD 5.7). Metadata goes in `#` comment lines at the top, followed by one row per month.

```csv
# data_kind: synthetic
# unit: VIIRS-equivalent detections per satellite
# aoi_analyzed: min_lat=20.75 max_lat=21.75 min_lon=78.5 max_lon=79.5
# cell_size_deg: 0.25
# range: 2000-11 to 2026-11
month,value,state,anomaly,anomaly_state,source,provisional,partial,low_count
2000-11,25.1,value,1.14,ok,TERRA_chained,false,false,false
2026-11,9.8,value,,non_comparable_partial,VIIRS,true,true,false
```

Unavailable months have an empty `value` and `state unavailable` . They are never written as 0. Values are unrounded in the CSV; the UI may round for display (PRD 5.3).

#### **7.2 POST /api/download/chart  (Should)**

`[Proposed]` The PRD wants the image to include the legend and the status markers (provisional, partial, converted, chained). The frontend already renders all of these, so it is simpler and more faithful for the frontend to export its own rendered SVG or PNG. The server endpoint is therefore optional and can be dropped if the frontend export works.

#### **7.3 POST /api/download/detections.csv  (Could)**

Returns `501 NOT_AVAILABLE` until the real archive is processed. Whether the file holds all detections or only filtered ones is open (D6). The file would be labeled as unharmonized native-sensor data and may be size-limited (PRD 5.7).

### **8. PRD Traceability**

Every Must feature in the PRD has a data source in this API, as Task Delegation asks Roles 3 and 4 to confirm.

|**PRD Must feature**|**Data source in this API**|
|---|---|
|Rectangle selection and lat/lon entry with validation (5.1)|`aoi`bbox input;`INVALID_AOI`errors|
|Grid snapping and notice (5.1)|`meta.aoi_analyzed`,`meta.snapped`, `meta.cell_size_deg`,`SNAPPED_AOI`warning|
|Reject empty and out-of-coverage areas (5.1)|`EMPTY_AREA`,`OUT_OF_COVERAGE`|
|Date range, latest month, current month incomplete (5.2)|`start_month`,`end_month`,`meta.coverage`, `months[].partial`|
|Calendar heatmap with zero and unavailable states (5.3)|`months[].value`and`months[].state`|
|Anomaly heatmap, 1.0 as normal, not-defined state (5.4)|`months[].anomaly`and`months[].anomaly_state`|
|Converted years, chained segment, per-month source (5.5)|`months[].source`,`CHAINED_SEGMENT`warning|
|Harmonization explanation (5.5)|Static frontend content. No API data needed|
|Provisional, partial and low-count labels (5.6)|`months[].provisional`,`partial`,`low_count`and the matching warnings|
|Synthetic data labeling (5.6, 12.3)|`meta.data_kind`,`SYNTHETIC_DATA`warning|
|Monthly CSV download (5.7)|`POST /api/download/monthly.csv`|

### **9. Open Items and Dependencies**

|**ID**|**Item**|**Owner**|**Needed by**|
|---|---|---|---|
|O1|`cell_month.csv`column list and final schema. The design doc describes the contents (counts per sensor, harmonized value, source) but not the column names, and the aggregation step depends on them|Role 1|13 Nov, noon|
|O2|Provisional (NRT) flag and cell size. No pipeline output carries NRT information (PRD D4), and cell size is only a `--res`setting. Proposal: the pipeline writes a small `meta.json`with`provisional_from`and`cell_size_deg`|Role 1 and Role 4|13 Nov, end of day|
|O3|Resolved: NaN depends on the satellite series, not the cell (Architecture 6.5), so a month is unavailable for every cell or for none. Role 1 to confirm the pipeline output keeps this|Role 1|Confirm only|
|O4|Baseline: full record (proposed) or selected range (PRD D1)|Role 3|13 Nov, end of day|
|O5|Cell size 0.25 or 0.5 degrees (PRD D2). The API reads it from data, so no API change either way|Role 2|13 Nov, end of day|
|O6|Low-count threshold and minimum years for a median (PRD D5)|Role 3 and Role 2|After real data|
|O7|Raw detections content, all or filtered (PRD D6)|Role 3|Could Have|
|O8|Hosting for data and app (PRD D7)|Team|During hackathon|
|O9|FRP: the pipeline computes`frp_total`per cell and month (Architecture 6.4) but`cell_month.csv`is not described as holding it. If FRP is promoted above Could Have, a column is needed and`value_frp`is added to`months`, limited to VIIRS-era months (PRD D8)|Role 3 and Role 1|13 Nov, noon|

### **10. API Test Cases**

These cover the PRD checks V4, V7, V8, V9, V10 and V12 on synthetic data and the example files.

|**Case**|**Request**|**Expected result**|
|---|---|---|
|Normal area|Valid bbox, full range|200; all months present; flags set; `SNAPPED_AOI`if rounded|
|Sparse area|Small bbox, one cell|200;`low_count`true;`LOW_COUNT`warning|
|Zero versus unavailable|Any area|Observed empty month is`state` `zero`; satellite not flying is`unavailable`with `null`|
|Zero median|Sparse area, month with median 0|`anomaly_state` `not_defined`,`anomaly` null|
|Partial month|Range ending at the latest month|`partial`true;`non_comparable_partial`|
|Latitude out of range|`min_lat`-100|400`INVALID_AOI`|
|Reversed bounds|`min_lat`25,`max_lat`20|400`INVALID_AOI`|
|Reversed dates|`start_month`after`end_month`|400`INVALID_DATES`|
|Before coverage|`start_month`2000-05|400`INVALID_DATES`|
|Outside the grid|Bbox outside`grid_extent`|422`OUT_OF_COVERAGE`|
|CSV match|Same body to`/api/calendar`and CSV|Rows match; unavailable months empty, never 0|

### **Appendix A: Example Responses**

These are the three mock responses Role 5 uses (Task Delegation, Role 4). They are synthetic and abbreviated here: the real `months` array has one entry per month in the range, so a full-range response has 313 entries. The mock files should carry the full range.

#### **A.1 Normal area**

Shows all three sources, both sensor handovers (Jul 2002 and Jan 2012), a provisional month and a partial month.

```json
{
  "meta": {
    "data_kind": "synthetic",
    "pipeline_version": "0.1-synthetic",
    "unit": "VIIRS-equivalent detections per satellite",
    "cell_size_deg": 0.25,
    "coverage": {"first_month": "2000-11", "last_month": "2026-11"},
    "data_through": "2026-11-12",
    "aoi_requested": {
      "type": "bbox",
      "min_lat": 20.8,
      "max_lat": 21.6,
      "min_lon": 78.5,
      "max_lon": 79.5
    },
    "aoi_analyzed": {
      "type": "bbox",
      "min_lat": 20.75,
      "max_lat": 21.75,
      "min_lon": 78.5,
      "max_lon": 79.5
    },
    "snapped": true,
    "n_cells": 16,
    "baseline": {
      "basis": "full_record",
      "n_years": 25,
      "median_by_calendar_month": [35, 60, 110, 190, 120, 40, 8, 5, 6, 15, 22, 28]
    }
  },
  "months": [
    {
      "month": "2000-11",
      "value": 25.1,
      "state": "value",
      "anomaly": 1.14,
      "anomaly_state": "ok",
      "source": "TERRA_chained",
      "provisional": false,
      "partial": false,
      "low_count": false
    },
    {
      "month": "2002-07",
      "value": 6.4,
      "state": "value",
      "anomaly": 0.8,
      "anomaly_state": "ok",
      "source": "AQUA_calibrated",
      "provisional": false,
      "partial": false,
      "low_count": false
    },
    {
      "month": "2011-12",
      "value": 30.8,
      "state": "value",
      "anomaly": 1.1,
      "anomaly_state": "ok",
      "source": "AQUA_calibrated",
      "provisional": false,
      "partial": false,
      "low_count": false
    },
    {
      "month": "2012-01",
      "value": 38.5,
      "state": "value",
      "anomaly": 1.1,
      "anomaly_state": "ok",
      "source": "VIIRS",
      "provisional": false,
      "partial": false,
      "low_count": false
    },
    {
      "month": "2026-08",
      "value": 6,
      "state": "value",
      "anomaly": 1.2,
      "anomaly_state": "ok",
      "source": "VIIRS",
      "provisional": true,
      "partial": false,
      "low_count": false
    },
    {
      "month": "2026-11",
      "value": 9.8,
      "state": "value",
      "anomaly": null,
      "anomaly_state": "non_comparable_partial",
      "source": "VIIRS",
      "provisional": true,
      "partial": true,
      "low_count": false
    }
  ],
  "warnings": [
    {
      "code": "SYNTHETIC_DATA",
      "message": "Demonstration data. Not real fire history.",
      "ranges": []
    },
    {
      "code": "SNAPPED_AOI",
      "message": "The analyzed area was rounded to 0.25 degree grid cells.",
      "ranges": []
    },
    {
      "code": "CHAINED_SEGMENT",
      "message": "Nov 2000 to Jun 2002 is converted in two stages (Terra to Aqua to VIIRS-equivalent) and is the least certain part of the record.",
      "ranges": [{"from": "2000-11", "to": "2002-06"}]
    },
    {
      "code": "PROVISIONAL",
      "message": "Near-real-time months may change when science-quality data replaces them.",
      "ranges": [{"from": "2026-08", "to": "2026-11"}]
    },
    {
      "code": "PARTIAL_MONTH",
      "message": "This month is incomplete and is not comparable with full months.",
      "ranges": [{"from": "2026-11", "to": "2026-11"}]
    }
  ]
}
```

#### **A.2 Sparse area with a low-count warning**

Shows a zero month, a zero median giving `not_defined` , and a legitimate anomaly of 0 when the median is above zero.

```json
{
  "meta": {
    "data_kind": "synthetic",
    "pipeline_version": "0.1-synthetic",
    "unit": "VIIRS-equivalent detections per satellite",
    "cell_size_deg": 0.25,
    "coverage": {"first_month": "2000-11", "last_month": "2026-11"},
    "data_through": "2026-11-12",
    "aoi_requested": {
      "type": "bbox",
      "min_lat": 12.1,
      "max_lat": 12.2,
      "min_lon": 76.1,
      "max_lon": 76.2
    },
    "aoi_analyzed": {
      "type": "bbox",
      "min_lat": 12,
      "max_lat": 12.25,
      "min_lon": 76,
      "max_lon": 76.25
    },
    "snapped": true,
    "n_cells": 1,
    "baseline": {
      "basis": "full_record",
      "n_years": 25,
      "median_by_calendar_month": [0, 0, 0.6, 1.1, 0.4, 0, 0, 0, 0, 0.3, 0, 0]
    }
  },
  "months": [
    {
      "month": "2001-01",
      "value": 0,
      "state": "zero",
      "anomaly": null,
      "anomaly_state": "not_defined",
      "source": "TERRA_chained",
      "provisional": false,
      "partial": false,
      "low_count": true
    },
    {
      "month": "2005-03",
      "value": 0.8,
      "state": "value",
      "anomaly": 1.33,
      "anomaly_state": "ok",
      "source": "AQUA_calibrated",
      "provisional": false,
      "partial": false,
      "low_count": true
    },
    {
      "month": "2014-04",
      "value": 0,
      "state": "zero",
      "anomaly": 0,
      "anomaly_state": "ok",
      "source": "VIIRS",
      "provisional": false,
      "partial": false,
      "low_count": true
    },
    {
      "month": "2026-11",
      "value": 0,
      "state": "zero",
      "anomaly": null,
      "anomaly_state": "non_comparable_partial",
      "source": "VIIRS",
      "provisional": true,
      "partial": true,
      "low_count": true
    }
  ],
  "warnings": [
    {
      "code": "SYNTHETIC_DATA",
      "message": "Demonstration data. Not real fire history.",
      "ranges": []
    },
    {
      "code": "SNAPPED_AOI",
      "message": "The analyzed area was rounded to 0.25 degree grid cells.",
      "ranges": []
    },
    {
      "code": "LOW_COUNT",
      "message": "Very few detections in this area. The calendar is noisy and anomalies may be unstable.",
      "ranges": [{"from": "2000-11", "to": "2026-11"}]
    },
    {
      "code": "CHAINED_SEGMENT",
      "message": "Nov 2000 to Jun 2002 is converted in two stages and is the least certain part of the record.",
      "ranges": [{"from": "2000-11", "to": "2002-06"}]
    },
    {
      "code": "PROVISIONAL",
      "message": "Near-real-time months may change when science-quality data replaces them.",
      "ranges": [{"from": "2026-08", "to": "2026-11"}]
    },
    {
      "code": "PARTIAL_MONTH",
      "message": "This month is incomplete and is not comparable with full months.",
      "ranges": [{"from": "2026-11", "to": "2026-11"}]
    }
  ]
}
```

#### **A.3 Error case**

Request with `min_lat` 25 and `max_lat` 20. Response `400` :

```json
{
  "error": {
    "code": "INVALID_AOI",
    "message": "min_lat must be less than max_lat.",
    "details": {"field": "aoi.min_lat", "received": {"min_lat": 25, "max_lat": 20}}
  }
}
```
