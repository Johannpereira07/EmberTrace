# EmberTrace

**NASA Space Apps Challenge 2026 · Challenge 15: Harmonization of MODIS and VIIRS Hot Spots**

Satellites have mapped active fires for over 20 years, but the record is split between two sensor families. **MODIS** (Terra from 2000, Aqua from 2002) has the long history; **VIIRS** (S-NPP from 2012, NOAA-20 from 2018, NOAA-21 from 2023) sees far more small fires. Joining their raw counts creates fake jumps whenever a sensor or satellite changes.

EmberTrace turns NASA FIRMS hotspots into **one consistent, VIIRS-equivalent monthly record from November 2000 to today**, so the sensor of origin no longer matters. A web app lets you pick an area and a date range and shows:

- a **burning activity calendar** (year × month heatmap, colorblind-safe)
- an **anomaly calendar**: each month compared with the median of the same month in other years
- **data-quality markers**: converted years, the least certain 2000–2002 segment, provisional and partial months, low counts
- a **CSV download** of the monthly data

**Success test:** no visible jump in the calendar at the sensor handovers (July 2002, January 2012).

## Status (14 Nov 2026)

| Part | Status |
|---|---|
| Data pipeline, stages 1–4 (load, filter, grid, normalize) | ✅ Done and validated on the real FIRMS archive for India: 18.0M detections, 2000-11-01 to 2026-11-13 (`docs/09`) |
| Stages 5–7 (calibrate, harmonize, calendar) | ⚠️ In progress. Known issue: zero detections convert to a positive value, which creates a jump at 2002-07 (`docs/09` §4). **Calendar numbers are not final results yet** |
| Backend API, frontend | In progress (`api/`, `web/`) |

## How to run

Requires Python 3.11+ and the real FIRMS files in `data/raw/` (not in git, about 1.4 GB). No real data? Use the synthetic data below.

```bash
pip install -r pipeline/requirements.txt

make pipeline          # full India run into out/ (about 2 min, about 4.6 GB RAM)
make pipeline-test     # 32 tests
make synthetic         # synthetic data with a planted answer: generate, run, check (about 6 s, no real data)
```

Without `make`:

```bash
python pipeline/run.py --modis "data/raw/DL_FIRE_M-C61_*/fire_*.csv" \
                       --viirs "data/raw/DL_FIRE_*V-C2_*/fire_*.csv" --out out/
```

Outputs in `out/`: `normalized.csv` (per cell and month, per satellite series), `normalized.meta.json` (data-through date, first provisional month, outage days, filter counts), `cell_month.csv` (harmonized value and source), `calibration.json`, `calendar.csv`, `calendar_anomaly.csv`, `outages.csv`.

**App:** the backend and frontend run steps go here once `api/` and `web/` are merged. Deployment to Google Cloud Run: `docs/06-deployment.md`.

## How it works

```
FIRMS files ─► 1 load ─► 2 filter ─► 3 grid ─► 4 normalize ─► 5 calibrate ─► 6 harmonize ─► 7 calendar ─► API ─► web app
(MODIS, VIIRS)   one      drop low    0.25°     ÷ satellites     Aqua→VIIRS      VIIRS from 2012,  year × month
archive + NRT    format   confidence  cells,    actually         Terra→Aqua      calibrated Aqua    + anomaly
                          and non-    per month observing                        2002–2011, Terra
                          vegetation            (minus outages)                  chain 2000–2002
```

- **Sensor from the satellite name**, because VIIRS files use MODIS-style column names.
- **Satellite dates, thresholds and cell size** live in `pipeline/config.yaml`, not in code.
- **"No data" is never shown as "no fires".** A month without a satellite observing is unavailable (NaN), not 0.
- **Outage days** (from NASA's list, checked against our data) are removed from the observed days (`docs/08`).
- **Near-real-time files have no fire `type`**, so detections at known factories and gas flares are masked out. In the monsoon these are up to 70% of detections (`docs/10`).
- Details: `docs/02-architecture-methodology.md` (science), `contracts/normalized.schema.md` (data handoff), `docs/04-api-spec.md` (API).

## Documentation

Start at [`docs/README.md`](docs/README.md): problem statement, PRD, implementation plan, API spec, deployment, data profile, outage table, the first real run, and the NRT mask. Agent instructions for Claude Code, Antigravity and others: [`AGENTS.md`](AGENTS.md).

## Limitations

We count satellite **detections**, not ground-truth fires. In particular:

- **The 2000–2002 segment is the least certain.** Terra's morning pass has no VIIRS counterpart, so it's converted in two steps (Terra → Aqua → VIIRS-equivalent).
- **One conversion per satellite pair for the whole region.** The real relationship probably differs between forest fires and crop burning.
- **Satellite normalization assumes each satellite sees about the same fire activity.** That's approximate, because they pass at different times of day. Pixel size and scan angle are not corrected.
- **Recent months (from Aug 2026) are provisional** near-real-time data and may change. The static-source mask leaves about ±4% error in them (`docs/10`). The current month is partial.
- **Sparse areas give noisy calendars and unstable anomalies.**
- **Assumed or provisional values:** the MODIS confidence cut-offs (30 / 80) are assumed, not verified. The outage-day cut-off and the mask settings are provisional. Terra and Aqua orbit drift after 2021–2022 is not modelled.
- **Calendar values depend on stages 5–7, which have a known open issue** (`docs/09` §4).

## Future work

- A calibration that keeps zero detections at zero, fitted per region or land cover
- Daily counts, to compare a partial month with the same days of earlier months
- Validated confidence and outage thresholds; correcting for pixel footprint and scan angle
- Polygon areas, chart image export, and raw-detection download
- Automated monthly updates as new NRT data arrives

## Data credits

We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (https://earthdata.nasa.gov/firms), part of NASA's Earth Observing System Data and Information System (EOSDIS).

- **MODIS** Collection 6.1 active fire detections, Terra and Aqua (MCD14ML), doi:[10.5067/FIRMS/MODIS/MCD14ML](https://doi.org/10.5067/FIRMS/MODIS/MCD14ML)
- **VIIRS** 375 m active fire detections, S-NPP (VNP14IMGT), doi:[10.5067/FIRMS/VIIRS/VNP14IMGT_NRT.002](https://doi.org/10.5067/FIRMS/VIIRS/VNP14IMGT_NRT.002), plus NOAA-20 and NOAA-21. Their product citations are listed on the [FIRMS site](https://firms.modaps.eosdis.nasa.gov/)
- **Missing-data list:** FIRMS API "missing dates" page (copy and our check in `docs/08`)

Data: India, archive (standard quality) and near-real-time files, downloaded through the FIRMS Archive Download tool.
