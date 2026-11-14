# H1: normalized table (ingest → model)

**Written by:** Person 1 (`pipeline/ingest/`, stages 1 to 4) · **Read by:** Person 2 (`pipeline/model/`, stages 5 to 7)
**Produced by:** `aggregate()` in `pipeline/ingest/aggregate.py`; `pipeline/run.py` writes it to `<out>/normalized.csv`
**Sample:** `contracts/samples/normalized.central-india.csv`. This is **real FIRMS data** for 20.75–21.75 N, 78.5–79.5 E (16 cells × 312 months, 2000-12 to 2026-11), run with `--res 0.25`.

Changes follow the handoff rule in docs/03 §1: adding an optional column is fine with notice; renaming or removing one needs the whole team.

## Grain

One row per **(month, grid cell)**. Every cell that has at least one detection anywhere in the input appears for **every** month from the first to the last month with a detection. Months without fires are filled with 0, not dropped.

## Columns

| Column | Type | Meaning |
|---|---|---|
| `month` | string `YYYY-MM` | UTC calendar month (`acq_date` is UTC). A pandas `Period[M]` in memory |
| `cell_lat`, `cell_lon` | float | Cell **centre**, in degrees: `floor(x / res) * res + res / 2`, rounded to 4 decimals |
| `{s}_count` | int | Raw detections of series `s` in the cell and month, after filtering (confidence nominal or high; `type == 0` where the file has `type`) |
| `{s}_frp_sum` | float | Sum of FRP (MW) of those detections |
| `{s}_count_norm` | float or NaN | `{s}_count` divided by the satellites of `s` observing that month (fractional for partial months). **NaN = no satellite of `s` was observing**; 0 = observed, no fires |
| `{s}_frp_norm` | float or NaN | Same for FRP. FRP is out of scope for the product (docs/03 §4), so this is kept for completeness only |

`s` is one of `terra`, `aqua`, `viirs` (S-NPP, NOAA-20 and NOAA-21 combined). Columns are in this order: `month`, then `terra_*`, `aqua_*`, `viirs_*` (each as count, frp_sum, count_norm, frp_norm), then `cell_lat`, `cell_lon`.

## Rules for readers

- **Use `{s}_count_norm` to tell NaN from 0.** `{s}_count` is 0 even when the satellite wasn't flying, so it can't distinguish the two.
- NaN depends only on the series and the month, never on the cell: a month is NaN for every cell or for none.
- The low-count flag (API spec 5.6) should use `{s}_count` of the source series.

## Known behaviour of the current code (to be fixed in Person 1's tasks)

| Behaviour | Seen in the sample | Fix |
|---|---|---|
| A satellite counts as observing only from the **first month it has a detection in the loaded data** (`restrict_to_loaded_data`). In a small area this starts it too late | Aqua is NaN until 2002-11, because its first detection in this area is in Dec 2002 (Aqua launched 2002-07-04). Jul to Nov 2002 therefore fall back to the Terra chain | ING-6: observed days from mission dates minus outage days (`scripts/check_outages.py`) |
| The month range starts at the first detection of any series, not at 2000-11 | The sample starts 2000-12; Nov 2000 is absent rather than present | ING-6 / ING-8: use the configured coverage start |
| No outage days and no NRT static-source mask yet | NRT months (2026-08 on) are overcounted | ING-6, ING-11 |

## Sidecar: `normalized.meta.json` (ING-8)

Dataset-level values, written by `pipeline/run.py` next to `normalized.csv` and computed by `coverage_info()` in `pipeline/ingest/coverage.py`. Person 2 passes them on into `meta.json` (API spec §4). Sample: `contracts/samples/normalized.meta.central-india.json`.

| Field | Type | Meaning |
|---|---|---|
| `data_through` | date string | Last day with **VIIRS** data. VIIRS is the source of every month from 2012 on, so this decides whether the latest month is partial. Real data: `2026-11-13` |
| `provisional_from` | `YYYY-MM` or null | First month with VIIRS near-real-time (NRT) data; that month and every later one are provisional. Real data: `2026-08`. Null, with a warning, if no NRT rows were loaded |
| `source_series` | string | `VIIRS`: the series the two values above come from |
| `cell_size_deg` | number | The `--res` the table was built with |
| `by_series` | object | Per series (`Terra`, `Aqua`, `VIIRS`; null if absent): `first_day`, `last_day`, `archive_last_day`, `first_nrt_month` |

- Computed from **all** loaded rows, before filtering: a low-confidence detection still shows that the satellite was observing that day.
- Read from detections, so on a small area with few fires the last day or first NRT month can come out later or earlier than the files' real ones. For example, MODIS `first_nrt_month` is 2026-10/11 in the samples, but 2026-09 in the India-wide files. The real pipeline loads all of India.
- If archive data runs into or past the first NRT month of the same series, a warning is printed (archive and NRT overlap: check for duplicates).
