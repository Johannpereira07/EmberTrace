# H2: `cell_month` (pipeline → API)

**Written by:** `pipeline/export.py` (CAL-4) · **Read by:** Person 3 (`api/dataset.py`)
**Status:** draft by Person 1 (CAL-4 taken over on 14 Nov). **Person 2 to confirm (CAL-1).** It matches what the API's loader already expects.
**File:** `data/cell_month.parquet`, made by `make pipeline && make export`. It goes with `data/meta.json` (`contracts/meta.schema.json`) and `data/calibration.json`.

Changes follow the handoff rule in docs/03 §1: adding an optional column is fine with notice; renaming or removing one needs the whole team.

## Grain

One row per **(month, grid cell)**: a **full grid**, every cell × every month from `meta.coverage.first_month` to `last_month`, with no gaps and no duplicates. Sorted by `month`, `cell_lat`, `cell_lon`.

## Columns

| Column | Type | Meaning |
|---|---|---|
| `month` | string `YYYY-MM` | UTC calendar month |
| `cell_lat`, `cell_lon` | float64 | Cell **centre** in degrees: `k * cell_size_deg + cell_size_deg / 2` |
| `harmonized_count` | float64, NaN allowed | VIIRS-equivalent detections per satellite (stages 5–7). **NaN = unavailable** (no satellite observing); 0 = observed, no fires. The API sums it over the cells in the area |
| `source` | string or null | `VIIRS` (2012-01 on), `AQUA_calibrated` (2002-07 to 2011-12), `TERRA_chained` (2000-11 to 2002-06). **Null exactly when `harmonized_count` is NaN.** One source per month, the same for every cell |
| `terra_count`, `aqua_count`, `viirs_count` | int64 | Raw filtered detections per series (H1). For the **low-count flag only**, using the column of the month's `source` |

## Rules for readers

- **Decide unavailable vs zero from `harmonized_count` (or `source`), never from a raw count.** Raw counts are 0 even when no satellite was flying.
- The values change whenever stages 5–7 change. `meta.pipeline_version` labels them: `0.1-calibration-pending` means the zero-to-positive calibration issue (AGENTS.md, Known issues) is **not yet fixed**, so don't present these values as results.

## Checks

`pipeline/export.py` refuses to write a file that breaks any rule above. It checks: full grid, no duplicates, cells on the grid, known sources, null source ⇔ NaN value, one source per month, no negative values, `provisional_from` inside coverage, `data_through` in the last month. These are the same things the API's loader rejects.

## Size

All of India at 0.25°: 4,651 cells × 313 months = 1,455,763 rows, **2.5 MB** as parquet.
