# First full real-data run (ING-9 / ING-10)

**Date:** 14 Nov 2026 · **By:** Person 1 · **Code:** `main` at `5740dd0` (after ING-6) · **Command:** `make pipeline`
**Input:** all 8 files in `data/raw/` (India, archive + NRT): 18,035,986 detections, 2000-11-01 to 2026-11-13

> ⚠️ **These are not product results.** The pipeline runs end to end, but the calibration stages have a known issue (section 4) that creates large artificial jumps. Don't show these numbers as fire history.

## 1. Performance (ING-9)

| | |
|---|---|
| Run time | **2 min 13 s** (MacBook, 16 GB RAM) |
| Peak memory | **4.6 GB** (max resident set size) |
| Load 18M detections | 25 s |
| `unified.csv` | 1.47 GB (every detection; gitignored in `out/`) |
| `normalized.csv` / `cell_month.csv` | 91 MB / 121 MB as CSV |
| Grid | **4,651 cells** of 0.25° × 313 months (2000-11 to 2026-11) = 1,455,763 rows |

It fits easily on a laptop. No chunking needed for India at 0.25°. `cell_month` at 121 MB as CSV is fine to bake into the Cloud Run image (`docs/06`); parquet (CAL-4) will be smaller.

## 2. Ingest checks (stages 1 to 4): all pass

| Check | Result |
|---|---|
| Observing periods from the full files = mission starts | Terra 2000-11-01, Aqua 2002-07-04, S-NPP 2012-01-20 to 2026-11-02, NOAA-20 2018-04-01, NOAA-21 2023-03-01. No "data starts after mission start" warning |
| `source` per period | `TERRA_chained` 2000-11 to 2002-06, `AQUA_calibrated` 2002-07 to 2011-12, `VIIRS` 2012-01 on. Exactly as designed (the subset quirks in `contracts/samples/` don't occur on the full files) |
| NaN months | Aqua NaN 2000-11 to 2002-06 (20 months), VIIRS NaN 2000-11 to 2011-12 (134), Terra none |
| `data_through` / `provisional_from` | 2026-11-13 / 2026-08 |
| Outage days | **159**: the 158 from `scripts/check_outages.py` (archive files) + **S-NPP 2026-08-03** (NRT period, 0 detections, neighbour median ~56, not in the FIRMS table) |
| Detections kept after filtering | Terra 518,571 · Aqua 1,240,487 · VIIRS 11,557,725 |
| Warnings / errors | None |

## 3. Calibration (stages 5 to 7, Person 2), as it stands

| Fit | Slope | Intercept | Bias factor | r (log) | Cell-months | Hold-out: monthly corr / mean abs % error |
|---|---|---|---|---|---|---|
| Aqua → VIIRS (2012 to 2019) | 1.117 | 1.316 | 1.181 | 0.761 | 175,941 | 0.937 / 8.08 |
| Terra → Aqua (2002-08 to 2011-12) | 0.527 | 0.738 | 2.544 | 0.407 | 73,696 | 0.849 / 80.3 |

The error column is a fraction, so 8.08 means 808%. Probably months near zero blow it up (flagged for CAL-2). The Terra → Aqua fit is weak (r = 0.41).

## 4. ⚠️ Main finding: zero detections become positive values, causing a large step at 2002-07

The conversions have a positive intercept, so a cell with **0 detections** gets a positive value:

| Source | Value for a cell with 0 detections | × 4,651 cells = floor per month with no fires |
|---|---|---|
| `AQUA_calibrated` | 3.22 | ~15,000 |
| `TERRA_chained` | 18.26 | ~84,900 |

**Effect on the calendar (all of India):**

| Handover | Change at the handover | Normal change for those months, other years | Verdict |
|---|---|---|---|
| 2002-06 → 2002-07 (Terra chain → Aqua) | × **0.18** (86,469 → 15,167) | × 0.81 to 0.98 (Jun → Jul, 2003 to 2011) | **Large artificial step** |
| 2011-12 → 2012-01 (Aqua → VIIRS) | × 0.74 | × 0.86 to 1.15 (Dec → Jan, 2013 to 2019) | Smaller artificial step |
| 2023-02 → 2023-03 (NOAA-21 joins) | × 1.56 | × 2.5 to 5.6 (Feb → Mar, 2018 to 2025) | No upward jump |

- June 2002's total (86,469) is almost all floor (84,914).
- Of 623,234 pre-2012 cell-months, **558,233 have 0 detections**, and they contribute **3.07M of the 6.69M** (46%) pre-2012 harmonized total.
- So there are no `zero` months before 2012, and annual totals for 2001 (1.18M) are about 2.5× those of 2003 to 2011.

This **fails the PRD's success test** (no visible jump at 2002-07 and 2012-01). It's in Person 2's stages (CAL-2 / CAL-3, now flagged in their task rows): the conversions must map 0 to 0. Once fixed, rerun `make pipeline` and repeat the table above. That table is what the Sunday 12:00 go/no-go rule (docs/03 §7) checks.

## 5. How to reproduce

```bash
pip install -r pipeline/requirements.txt
make pipeline            # writes out/ (about 2 min)
make pipeline-test       # 21 tests
```
