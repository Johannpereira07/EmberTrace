# Sample data for building against

| File | What | Contract |
|---|---|---|
| `normalized.central-india.csv` | Stage-4 table (ingest → model) | H1, `../normalized.schema.md` (official) |
| `cell_month.central-india.csv` | Per cell and month: counts per series, harmonized value, source | H2, **stand-in** (see below) |
| `meta.central-india.json` | Dataset facts for `GET /api/meta` | H2, **stand-in**, fields from API spec §4 |
| `normalized.meta.central-india.json` | H1 sidecar: `data_through`, `provisional_from`, cell size, per-series dates | H1 (official, ING-8) |
| `outages.india.csv` | India-wide outage days (159, from the full run in `docs/09`), for `pipeline/run.py --outages` on subsets | ING-6 (from `scripts/check_outages.py --csv`) |
| `calibration.central-india.json` | The two conversion fits and their hold-out checks | Reference only |

All four come from **real FIRMS data** for one small region: 20.75–21.75 N, 78.5–79.5 E (central India, the API spec's example area). That's 16 cells of 0.25°, 2000-12 to 2026-11, archive plus NRT, produced by `pipeline/run.py --res 0.25 --outages contracts/samples/outages.india.csv` on the current `main`. Outage days come from the India-wide list (`outages.india.csv`), because a subset is too small to derive them.

## ⚠️ Stand-in for H2 (superseded)

**H2 now exists** (`contracts/cell_month.schema.md`, `contracts/meta.schema.json`), and `data/cell_month.parquet` + `data/meta.json` hold the full India export (CAL-4). The API should load those. The stand-in files below are kept only as a small example.


**Person 1 made `cell_month.*` and `meta.*` to unblock the API work (Person 3).** They aren't Person 2's H2 contract. Person 2 replaces them in CAL-1 / CAL-4 with `contracts/cell_month.schema.md`, `contracts/meta.schema.json` and `cell_month.parquet`. Column names may change then. Code the API against the API spec, and keep file loading in one place so the switch is a small edit.

## `cell_month.central-india.csv`

4,992 rows (16 cells × 312 months), 430 KB. Columns:

- The H1 columns (`month`, `cell_lat`, `cell_lon` = cell **centre**, and per series `terra_*`, `aqua_*`, `viirs_*`: `count`, `frp_sum`, `count_norm`, `frp_norm`). See `../normalized.schema.md`.
- `harmonized_count`: the VIIRS-equivalent value the API sums over the area. NaN means unavailable, 0 means observed with no fires.
- `source`: `VIIRS`, `AQUA_calibrated` or `TERRA_chained`.

**Rules for the API:**

- Sum `harmonized_count` over the cells in the area. Decide `zero` vs `unavailable` from `harmonized_count` (NaN = unavailable), **never from a raw `*_count`**: raw counts are 0 even when no satellite was flying.
- `low_count` uses the raw count of the month's `source` series (`viirs_count`, `aqua_count` or `terra_count`).
- A cell is inside the snapped area if its centre is: cell edges are centre ± `cell_size_deg / 2`.

## Known quirks of this sample (the real product will differ)

| Quirk | Why | Fixed by |
|---|---|---|
| `TERRA_chained` runs to **2002-11**, and `AQUA_calibrated` starts **2002-12** (product: 2002-06 / 2002-07) | In this small area Aqua's first detection is in Dec 2002, and the current code only counts a satellite as observing from its first detection | ING-6 (Person 1) |
| Starts at **2000-12**, not 2000-11, so `meta.coverage.first_month` is `2000-12` | The table starts at the first month with a detection | ING-6 / ING-8 |
| **No unavailable months** (no NaN in `harmonized_count`) | Every month in this range has a satellite | Test `unavailable` with the API spec mocks (A.1, A.2), or a request before `coverage.first_month` (→ `INVALID_DATES`) |
| Calibration was fitted on these 16 cells only | The product fits once on the whole region | CAL-2 (Person 2) |
| **Before 2012, cells with 0 detections show 4.4 (`AQUA_calibrated`) or 14.2 (`TERRA_chained`), not 0.** So there are no `zero` months before 2012, and e.g. Jun 2001 sums to ~242 from 1 real detection. Don't read these as real fires | The conversions have a positive intercept, so `apply_log_line(0) > 0` (AGENTS.md, Known issues) | CAL-2 / CAL-3 (Person 2) |

`data_kind` is `real` because the detections are real. But these numbers are not product values: don't show them as results in the demo.
