# CLAUDE.md

EmberTrace: NASA Space Apps 2026, Challenge 15 (harmonizing MODIS + VIIRS fire hotspots). See @docs/00-problem-statement.md for the challenge requirements.

Harmonize MODIS and VIIRS active-fire hotspots (NASA FIRMS) into one consistent VIIRS-equivalent monthly series per grid cell, Nov 2000 to today. A FastAPI backend sums it over a user-selected area. A React frontend shows a year × month calendar, an anomaly calendar (vs the historical median) and quality flags, and offers CSV and chart downloads. Users: emergency responders, scientists, land managers.

## Docs (read before non-trivial work)

- **The PRD (`docs/01-prd.md`) is the source of truth.** It overrides every other doc and this file.
- **If docs disagree with the PRD, with each other, or with this file, or anything is unclear: stop and ask. Do not pick a side.**
- `docs/README.md` is the index.
- `docs/02-architecture-methodology.md` is an **outdated draft**. Use it for the science, but check its banner for superseded facts.
- `docs/05-task-delegation-prep.md` is historical (pre-hackathon roles).
- `docs/07-data-profile.md` is the profile of our real FIRMS files (from `scripts/profile_raw.py`). It beats the "assumed" facts below.

## Repo layout

Exists now:
- `pipeline/run.py`: runs the pipeline. `pipeline/ingest/` = stages 1-4 (load, filter, grid+count, normalize; Person 1), `pipeline/model/` = stages 5-7 (calibrate, harmonize, calendar; Person 2). Split from the old single-file `harmonize.py` in ING-1 with byte-identical outputs.
- `contracts/normalized.schema.md`: handoff H1 (stage-4 table, ingest -> model).
- `contracts/samples/`: real-data samples for central India: H1 `normalized`, plus a **stand-in** `cell_month` + `meta.json` for the API until Person 2's H2 lands. Read its README (rules and known quirks).
- `pipeline/config.yaml`: satellite dates and series, MODIS confidence thresholds (assumed), default cell size. Read and checked by `pipeline/ingest/satellites.py`; a bad value fails loudly (ING-2).
- `pipeline/tests/ingest/`: pytest tests for stages 1-4.
- `scripts/profile_raw.py`: profiles the raw FIRMS files (columns, codes, date ranges).
- `data/raw/DL_FIRE_<product>_<id>/`: real FIRMS downloads, each with `fire_archive_*.csv`, `fire_nrt_*.csv` and `Readme.txt`. Products: `M-C61` (MODIS C6.1, Terra + Aqua), `SV-C2` (VIIRS S-NPP), `J1V-C2` (VIIRS NOAA-20), `J2V-C2` (VIIRS NOAA-21). Do not commit these or any large data. Synthetic data must be labelled as synthetic.
- `Dockerfile`, `Makefile`, `README.md`, `docs/`.

Planned (docs/03 §2), not created yet:
- `api/`: FastAPI. Contract in `contracts/api/types.ts` + `contracts/fixtures/*.json`.
- `web/`: React + Vite + TypeScript, react-leaflet + leaflet-draw, D3 scales + SVG charts.
- Tests for `pipeline/model/` (Person 2), `api/` and `web/`.

Deploy: one Docker container (root `Dockerfile`) on **Google Cloud Run**, `asia-south1`. API under `/api`, frontend at `/`, data baked into the image. Backup: frontend in mock mode. See `docs/06-deployment.md`.

Each folder has a single owner (docs/03 §2). Handoff files in `contracts/` change only with team agreement.

## Commands

```
pip install -r pipeline/requirements.txt   # in whatever env you use (venv, conda, ...)
python scripts/profile_raw.py
python pipeline/run.py --modis "data/raw/DL_FIRE_M-C61_*/fire_*.csv" --viirs "data/raw/DL_FIRE_*V-C2_*/fire_*.csv" --res 0.25 --out out/
python -m pytest pipeline/tests
```

Archive and NRT files can overlap in time. Until de-duplication exists (see Known issues), check the overlap before loading both.

Make targets: `make pipeline | api | web | web-live | test | contract-test | fixtures` (planned); `make docker-run | deploy | demo-on | demo-off | url | logs` (exist).

## Method (do not change without asking)

1. Three series: Terra, Aqua, VIIRS (S-NPP + NOAA-20 + NOAA-21 combined).
2. Filter: drop confidence `low`; for archive files keep `type == 0` (vegetation fire). NRT files have no `type`: drop NRT detections inside the static-source mask built from archive type 1/2/3 locations (docs/03, ING-11 method note).
3. Grid 0.25°, count per cell per month. Missing (cell, month) = 0 only if a satellite was observing; NaN if not.
4. Normalize: divide counts by the number of satellites observing that month (fractional for partial months).
5. Conversions (log1p-log1p line + bias factor; needs >= 30 rows and >= 12 months):
   - Aqua -> VIIRS, fitted 2012-01..2019-12 (before Terra/Aqua orbit drift; verify dates)
   - Terra -> Aqua, fitted 2002-08..2011-12, used only for Nov 2000 - Jun 2002
6. Final value per cell-month: VIIRS if present, else calibrated Aqua, else Terra chained via Aqua. Keep the `source` column: `VIIRS` (2012-01+), `AQUA_calibrated` (2002-07 to 2011-12), `TERRA_chained` (2000-11 to 2002-06).
7. Calendar: year × month totals. Anomaly = value ÷ full-record median of the same calendar month.

## Invariants (do not break)

- **NaN ≠ 0.** NaN or `null` / `unavailable` means no satellite was observing. 0 / `zero` means observed with no fires. Keep this from the pipeline through the API, UI and CSV. Never write an unavailable month as 0. Raw count columns (`{s}_count`) are 0 even when the satellite wasn't flying: decide NaN vs 0 from `{s}_count_norm` (or the harmonized value / `source`), never from a raw count (contracts/normalized.schema.md).
- **Never blend sensors after Jan 2012.** Never average MODIS and VIIRS.
- **No per-request recalibration.** One fit per satellite pair for the whole region, done offline, never per selected area.
- **Nothing hard-coded:** satellite dates, cell size, thresholds and provisional months come from config or `meta.json`.
- Anomaly: a zero median gives `not_defined`, never infinity. A partial month gives `non_comparable_partial`.
- Months are UTC months (`acq_date` is UTC).
- Colorblind-safe scales (Cividis/Viridis; diverging blue↔orange centered on 1.0). Never use color alone to carry information.
- Synthetic data is always labeled as demonstration data. Don't claim real-data validation until it has been done.
- No silent row loss: warn or assert when rows are dropped, codes are unrecognised, or months are missing. When a real file contradicts an assumption, warn or fail loudly. Never silently drop or reinterpret rows.
- Do not invent thresholds, numbers or data. Placeholders go in config and are labelled provisional.

## Satellite dates and constants

Terra 2000-11-01. Aqua 2002-07-04. S-NPP 2012-01-20 to 2026-11-02 13:00 UTC. NOAA-20 2018-04-01.
NOAA-21 2023-03-01: the archive file's first detections are on that date, matching PRD §9 and the FIRMS archive page. The 2024-01-17 correction in docs/03 §4 is superseded.

## Data facts (verified: docs/07-data-profile.md + NASA FIRMS Readme, attributes page and FAQ)

- Data: India, 0 km buffer, `data/raw/DL_FIRE_*`, each with `fire_archive_*.csv` (standard ML) and `fire_nrt_*.csv`. About 17.9M archive rows. Gitignored.
- Sensor comes from the SATELLITE name (Terra, Aqua = MODIS; SNPP, N20, N21 = VIIRS). VIIRS files use MODIS-style column names.
- Confidence: MODIS numeric 0-100, class cut-offs 30/80 **assumed** (not verified; label them as assumed); VIIRS l/n/h.
- `type`: 0 vegetation fire, 1 volcano, 2 other static land source, 3 offshore. Archive only. NRT has no `type`, so unfiltered NRT months are overcounted (about 5% MODIS, 12-14% VIIRS). The static-source mask (ING-11) reduces this; its residual error must be measured and reported.
- Archive and NRT do not overlap. `provisional_from` = 2026-08 (first VIIRS NRT month).
- NOAA-21 starts 2023-03-01 (data), S-NPP ends 2026-11-02.
- MODIS `version` 6.03 (2000-2022), 61.03 (2023+). Calibration windows lie in 6.03.
- Outage days: `docs/08-missing-data-table.md` (FIRMS list) checked against our raw files. See its last section: the list is incomplete for our region, and one row is a copy error. Rule: a satellite-day is an **outage** only if our data has **zero detections** for that satellite that day **and** (FIRMS lists it **or** the neighbouring days are clearly non-zero). Any day with at least one detection is observed, even if FIRMS lists it. Observed days = mission days minus outage days. `scripts/check_outages.py` derives them. Never read an outage as zero fires; partial days count as observed (known limitation). The Readme/FAQ dates 2001-04-15, mid-Aug 2007 and 2009-04-21/22 are **not** full outages over India (detections present); 2002-03 is 03-20..03-28; 2001-06 is 06-15..07-03.
- NRT day/night flag uses orbit direction, standard uses solar zenith angle.

## Decisions (proposed by the team, not all confirmed)

- Anomaly baseline = full record; UI shows "Baseline: N years".
- Cell size 0.25°, read from `meta.json` everywhere.
- Pipeline writes `provisional_from` (first NRT month) into `meta.json`.
- Low-count and minimum-years thresholds are config values with placeholder defaults, labelled provisional.
- Partial current month is labelled partial; its anomaly is "not comparable".
- Raw detections download: Could Have (PRD 5.7). The endpoint returns 501 in the MVP; build a capped export only if every Must and Should is done by Block D. FRP: out of scope (no validated cross-sensor conversion).
- Polygon selection is a Should; a lat/lon box is a Must.

## Known issues (to do)

- Anomaly with a zero calendar-month median is not yet handled in code: must return `not_defined` (blank + flag), not inf/NaN.
- `aggregate` builds the full month × cell grid per series: memory risk on large regions.
- No de-duplication when overlapping downloads contain the same detection.
- NRT static-source mask (ING-11) not built yet.
- Outage days not used yet: normalization counts mission dates only (ING-6, input now in docs/08).
- No `meta.json` yet (Person 2, CAL-1/CAL-4). Its `data_through`, `provisional_from` and cell size come from `normalized.meta.json` (ING-8); windows and baseline years still missing.
- No daily counts, so month-to-date comparison is not possible yet.
- Satellite availability comes from the loaded data's first/last month (`restrict_to_loaded_data`); tiny areas can make a satellite's first/last months look unobserved.

## Git conventions

Branch `p<N>/<TASK-ID>-slug` (e.g. `p3/API-5-anomaly`). Commit `feat(api): ... [API-5]`. Keep PRs small, under about 300 lines. Run the tests before saying a task is done. Never commit credentials (`.env`) or real archive data.