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

## Planned additions (ING-8, optional fields with notice)

- `data_through`: the last day covered by the input
- `provisional_from`: the first NRT month (2026-08 in our data)

These are table-level values. They'll go in a small sidecar (`<out>/normalized.meta.json`) rather than in a column, so that Person 2 can pass them on into `meta.json`.
