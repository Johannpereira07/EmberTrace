# Burning Activity Calendar: Architecture and Methodology

NASA Space Apps 2026, Challenge 15: Harmonization of MODIS and VIIRS Hot Spots. Team design document, draft of 9 Nov 2026. Audience: our CS teammates, no remote sensing background needed.

> **⚠️ Outdated draft.** The science and pipeline logic here are still the reference, but parts have been superseded. Where they conflict, follow the [Implementation Plan](03-implementation-plan.md) and the [API Spec](04-api-spec.md):
>
> - **NOAA-21 start:** **1 Mar 2023** is confirmed by the real archive data (`docs/07-data-profile.md`). Splice checks also run at **2023-03**.
> - **S-NPP end:** 2 Nov 2026 **13:00 UTC**. Terra/Aqua end dates are not hard-coded.
> - **MODIS confidence thresholds 30 / 80:** verified (sections 6.2, 10 still say "from memory").
> - **Outputs:** the app serves `cell_month.parquet` plus `meta.json` (with `cell_size_deg`, `provisional_from`, `data_through`), not `cell_month.csv` (sections 4, 8).
> - **Code layout:** `harmonize.py` is split into `pipeline/ingest/` (stages 1 to 4) and `pipeline/model/` (stages 5 to 7).
> - **Open questions in section 11:** settled in the Implementation Plan section 4 (0.25° cells, full-record baseline, FRP cut, one fit per satellite pair, single-container hosting).

## 1. What we are building

A web app that shows a calendar of fire activity (year by month) for any area a user selects, covering Nov 2000 to today, where you cannot tell which satellite sensor produced which year.

Two parts:

- **Part A, data pipeline** (`harmonize.py`, written and tested on synthetic data plus our two sample files): turns MODIS and VIIRS hotspot files into one consistent monthly series.
- **Part B, web app** (proposed design in section 8, not built yet): the user picks an area and dates, sees the calendar and anomalies, and downloads a CSV.

**Success test:** the calendar has no visible jump where one sensor hands over to another.

## 2. Background in one minute

A **hotspot** is a satellite pixel hot enough to be flagged as fire. Each detection is one row in a CSV: latitude, longitude, date, time, FRP (fire radiative power in MW, a measure of fire energy), and a confidence value.

Two sensor families give us the history:

|  | MODIS | VIIRS |
| --- | --- | --- |
| Satellites | Terra (Nov 2000), Aqua (Jul 2002) | S-NPP (Jan 2012 to 2 Nov 2026), NOAA-20 (Apr 2018), NOAA-21 (Mar 2023) |
| Pixel size | about 1 km | about 375 m |
| Sees small fires | often misses them | yes |
| Confidence format | number 0 to 100 | label: low, nominal, high |
| Status | nearing end of life | replacing MODIS |

**Why raw counts cannot be compared:**

1. VIIRS has smaller pixels, so it detects more fires than MODIS for the same real fire activity.
2. The number of satellites changes over time. More satellites means more detections with no change in real fire activity.
3. The confidence columns use different formats.

Harmonization means fixing all three so the series is consistent.

**Time of day and orbit drift.** Terra is the only morning satellite, passing about three hours before Aqua. Aqua, NOAA-20 and NOAA-21 fly in the afternoon, and S-NPP did too ([NASA FIRMS team, Oct 2026](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)). Terra and Aqua also stopped orbit-maintenance maneuvers (Aqua in 2021, Terra in 2022), and the drift since then has changed pixel size, scan gaps and time-of-day sampling ([NASA LDOPE](https://landweb.modaps.eosdis.nasa.gov/displayissue?id=1254)). So Aqua is the fair partner for VIIRS, and calibration should use the years before the drift.

## 3. Decisions at a glance

| # | Decision | Choice | Why |
| --- | --- | --- | --- |
| 1 | Final series from 2012 on | VIIRS only (S-NPP, NOAA-20, NOAA-21 combined) | One sensor, no mixing of different sensitivities |
| 2 | Final series before 2012 | Aqua converted to VIIRS-equivalent (Jul 2002 to Dec 2011); Terra chained through Aqua (Nov 2000 to Jun 2002) | Aqua shares the afternoon orbit of VIIRS; Terra is the only satellite until Aqua launches |
| 3 | How to convert | Two regressions on overlap years: Aqua to VIIRS and Terra to Aqua | Each pair watched the same places |
| 4 | Calibration windows | Aqua to VIIRS: 2012 to 2019. Terra to Aqua: Aug 2002 to Dec 2011 | Stays clear of orbit-drift years; adjustable on the command line |
| 5 | Unit of analysis | Counts per grid cell per month (0.25 deg cells) | Compact, easy to compare, easy to query |
| 6 | Changing satellite count | Divide counts by number of satellites observing, per series | Removes fake jumps when satellites join or leave |
| 7 | Confidence | Convert to 3 labels, drop low | Common scale, fewer false alarms |
| 8 | Fire type (archive files) | Keep type 0 only (vegetation fires) | Excludes volcanoes, gas flares, offshore |
| 9 | No data vs no fires | NaN vs 0 | A satellite that was not flying is not the same as zero fires |
| 10 | Anomaly metric | Value divided by median of the same calendar month | Answers: is this month normal? |
| 11 | Data sources | Archive (science quality) for history, NRT for recent months, flagged provisional | NRT is replaced usually after 2 to 3 months, up to 5 |
| 12 | Validation | Hold-out test built into the pipeline | Shows whether a conversion generalizes beyond its fitting years |

## 4. Architecture overview

```
FIRMS archive CSVs (MODIS: Terra, Aqua)     FIRMS archive CSVs (VIIRS)
              |                                    |
              +----------------+-------------------+
                               v
        [1 LOAD + UNIFY]   one schema, one confidence scale
                               v
        [2 FILTER]         drop low confidence, keep vegetation fires
                               v
        [3 GRID + COUNT]   detections per cell per month, per series (Terra, Aqua, VIIRS)
                               v
        [4 NORMALIZE]      count divided by number of satellites observing
                               v
        [5 CALIBRATE]      fit Aqua -> VIIRS (2012-2019) and Terra -> Aqua (2002-2011)
                               v
        [6 HARMONIZE]      VIIRS, else calibrated Aqua, else Terra chained via Aqua
                               v
        [7 CALENDAR]       year x month table + anomaly table
                               v
        WEB APP            map, heatmap, charts, CSV + chart download
```

Each box is one function in `harmonize.py`. Each stage can be tested on its own. Output files:

| File | Contents |
| --- | --- |
| `unified.csv` | every detection, one schema |
| `cell_month.csv` | per cell and month: counts per sensor, harmonized value, source |
| `calibration.json` | both fits (slope, intercept, bias factor, correlation, window) and hold-out errors |
| `calendar.csv` | year x month harmonized counts for the whole area |
| `calendar_anomaly.csv` | same, divided by the median for that calendar month |

## 5. Data layer

### 5.1 Inputs

We have two kinds of FIRMS files. We have samples of NRT; we will get the archive on the 13th.

|  | NRT text files (our samples) | Archive CSVs (real data) |
| --- | --- | --- |
| `acq_time` | text like `02:06` | integer like `206` |
| VIIRS confidence | `low`, `nominal`, `high` | `l`, `n`, `h` |
| `type` column | absent | present (0 = vegetation fire) |
| `instrument` column | absent | present |
| Quality | provisional | science quality |

The loader accepts both. If the real files differ from this, the loader is the first thing to fix.

### 5.2 Unified schema

Every detection from either sensor becomes one row with the same columns:

```
sensor        MODIS | VIIRS
platform      Terra | Aqua | SNPP | NOAA-20 | NOAA-21
lat, lon      degrees
date          calendar date
time_utc      HH:MM
t_fire_K      brightness temperature of the fire pixel (MODIS: brightness, VIIRS: bright_ti4)
frp           fire radiative power, MW
conf_class    low | nominal | high
daynight      D | N
pixel_km2     scan x track (approximate pixel footprint)
type          0 = vegetation fire (archive only; defaults to 0)
```

### 5.3 Column mapping

| MODIS | VIIRS | Meaning |
| --- | --- | --- |
| `brightness` | `bright_ti4` | fire pixel temperature (K) |
| `bright_t31` | `bright_ti5` | second thermal channel (K) |
| `confidence` (0 to 100) | `confidence` (label) | needs conversion |
| `satellite` = T or A | `satellite` = N, N20, N21 | needs a name lookup |

All other columns (lat, lon, scan, track, acq\_date, acq\_time, version, frp, daynight) are shared.

## 6. Pipeline stages

### 6.1 Load and unify

```
def load_firms_file(file_path):
    raw_table = read_csv(file_path, keep acq_time, satellite, confidence as text)
    if 'bright_t31' in raw_table.columns:   sensor = 'MODIS'
    elif 'bright_ti4' in raw_table.columns: sensor = 'VIIRS'
    else: raise error('not a FIRMS fire file')

    unified_table.platform   = SATELLITE_NAME_LOOKUP[raw_table.satellite]
    unified_table.time_utc   = normalize_time_to_HH_MM(raw_table.acq_time)
    unified_table.conf_class = convert_confidence(raw_table.confidence, sensor)
    unified_table.type       = raw_table.type if column exists else 0
    return unified_table
```

The sensor is detected from column names, not file names, so renamed files still work.

### 6.2 Confidence harmonization

```
def modis_confidence_to_class(confidence_number):
    if confidence_number < 30: return 'low'
    if confidence_number < 80: return 'nominal'
    return 'high'

def viirs_confidence_to_class(confidence_label):
    first_letter = confidence_label.lower()[0]   # works for 'n' and 'nominal'
    return {'l': 'low', 'n': 'nominal', 'h': 'high'}[first_letter]
```

The 30 and 80 thresholds follow the FIRMS convention as we remember it. **To verify** against the user guides linked on the FIRMS page.

### 6.3 Filter

```
kept_detections = all_detections where
    conf_class != 'low'      # low confidence is more likely a false alarm
    and type == 0            # vegetation fires only
```

### 6.4 Grid and count

Points are hard to compare across years, so we count them per grid square per month.

```
CELL_SIZE_DEGREES = 0.25     # roughly 25 km

cell_lat = floor(lat / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES + CELL_SIZE_DEGREES / 2
cell_lon = floor(lon / CELL_SIZE_DEGREES) * CELL_SIZE_DEGREES + CELL_SIZE_DEGREES / 2
month    = date.to_month()

detection_count = group_by(sensor, month, cell_lat, cell_lon).count()
frp_total       = group_by(sensor, month, cell_lat, cell_lon).sum(frp)

# group_by only returns groups that exist, so add the missing ones explicitly
for every (month, cell) not present: detection_count = 0
```

If we skip the last step, quiet cells vanish from the table, and the regression only ever sees cells with fires.

### 6.5 Normalize by number of satellites

More satellites means more detections, even if real fire activity is unchanged. We divide by how many satellites were observing.

```
def satellites_observing(sensor, month):
    total = 0
    for satellite in SATELLITES_OF[sensor]:
        days_active = days of the month inside [satellite.start_date, satellite.end_date]
        total += days_active / days_in_month
    return total

count_per_satellite = detection_count / satellites_observing(sensor, month)
# if satellites_observing == 0, result is NaN (no data), NOT 0 (no fires)
```

Satellite timeline used (from the FIRMS archive page):

| Period | MODIS satellites | VIIRS satellites |
| --- | --- | --- |
| Nov 2000 to Jun 2002 | Terra | none |
| Jul 2002 to Dec 2011 | Terra + Aqua | none |
| Jan 2012 to Mar 2018 | Terra + Aqua | S-NPP |
| Apr 2018 to Feb 2023 | Terra + Aqua | S-NPP + NOAA-20 |
| Mar 2023 to 2 Nov 2026 | Terra + Aqua | S-NPP + NOAA-20 + NOAA-21 |
| After 2 Nov 2026 | Terra + Aqua (while operating) | NOAA-20 + NOAA-21 |

Partial months (a satellite starting or ending mid-month) get fractional weights. This assumes every satellite sees about the same amount of fire, which is only approximately true.

Normalization is done per series: Terra and Aqua are counted separately, and all VIIRS satellites are counted together.

### 6.6 Calibrate: learn the conversions

We learn two conversions. Each comes from a pair of satellites that watched the same places at similar times of day.

1. **Aqua to VIIRS**, fitted on 2012 to 2019. Aqua and the VIIRS satellites all pass in the early afternoon, so their counts differ mainly by sensitivity.
2. **Terra to Aqua**, fitted on Aug 2002 to Dec 2011, when both MODIS satellites flew before any drift. It is used only for Nov 2000 to Jun 2002, when Terra is the only satellite.

Both windows are command-line settings. The defaults are conservative: the last orbit-maintenance maneuvers were in 2021 for Aqua and 2022 for Terra, and large drift effects were reported by late 2024 ([NASA LDOPE](https://landweb.modaps.eosdis.nasa.gov/displayissue?id=1254)). Check the drift dates against the data before widening a window.

```
def fit_conversion(source_counts, target_counts, window_start, window_end):
    rows = months in the window where both series have data, excluding cells where both are zero
    if len(rows) < 30 or distinct_months(rows) < 12:
        return None                                   # not enough evidence
    x = log(1 + source_counts)                        # log compresses big counts; the 1 allows zeros
    y = log(1 + target_counts)
    slope, intercept = fit_straight_line(x, y)        # ordinary least squares
    predicted = exp(intercept + slope * x) - 1
    bias_factor = sum(target_counts) / sum(predicted)
    return slope, intercept, bias_factor

def apply_conversion(source_count):
    return (exp(intercept + slope * log(1 + source_count)) - 1) * bias_factor

aqua_to_viirs = fit_conversion(aqua_per_satellite, viirs_per_satellite, '2012-01', '2019-12')
terra_to_aqua = fit_conversion(terra_per_satellite, aqua_per_satellite, '2002-08', '2011-12')
```

**Why the bias factor exists:** fitting in log space and converting back systematically underestimates totals. On synthetic data this made the pre-2012 years sit visibly lower than 2012 on, a fake step at the handover. Rescaling so the converted total matches the real total over the fitting window fixed it.

**Why the guard exists:** our sample files cover one day. A fit on one day is meaningless, so the code refuses.

**Hold-out check:** for each fit, the code trains on the first 70% of the window's months and tests on the rest. It reports the correlation and the mean absolute percentage error of the monthly totals. On synthetic data the Aqua to VIIRS fit gave a correlation of 0.996 and an error of about 17%. Those numbers say nothing about real fire data; the real values will be our main evidence.

We save both fits and the hold-out results in `calibration.json` to report in the presentation.

### 6.7 Harmonize

```
for each (month, cell):
    if viirs_per_satellite exists:                  # Jan 2012 onward
        harmonized_count = viirs_per_satellite
        source = 'VIIRS'
    elif aqua_per_satellite exists:                 # Jul 2002 to Dec 2011
        harmonized_count = aqua_to_viirs(aqua_per_satellite)
        source = 'AQUA_calibrated'
    elif terra_per_satellite exists:                # Nov 2000 to Jun 2002
        harmonized_count = aqua_to_viirs(terra_to_aqua(terra_per_satellite))
        source = 'TERRA_chained'
```

From Jan 2012 on, VIIRS always exists, so MODIS never appears in the final numbers after that; it is used only to calibrate. From Jul 2002 to Dec 2011 we use Aqua alone and ignore Terra, so the pre-VIIRS record comes from one afternoon pass. Terra is used only for the first 20 months, through the two-step chain, so that segment is the least certain. We deliberately do not average sensors after 2012: that would mix different sensitivities and bring back the problem we are solving.

The `source` column is kept so the app can shade the converted years and mark the chained segment as lower confidence.

### 6.8 Calendar and anomalies

```
monthly_total[month] = sum of harmonized_count over cells in the selected area
calendar_table[year][month_of_year] = monthly_total

typical_for_month[m] = median(calendar_table[all years][m])
anomaly_table[year][m] = calendar_table[year][m] / typical_for_month[m]
```

Reading the anomaly: 1.0 is a normal month, 2.0 is twice the usual fire activity, 0.5 is half. This directly gives the challenge's "compare the current month against the historical median".

## 7. Validation plan

The synthetic test only proves the code runs and the splice logic works. It does not prove the science. On the real archive data we will check:

1. **Overlap check:** plot converted Aqua against actual VIIRS inside the fitting window. Report the correlation. This is our main evidence.
2. **Splice checks:** look at the calendar around Jul 2002 (Terra chain hands over to Aqua) and Jan 2012 (Aqua hands over to VIIRS). There must be no step at either. Both are clean on synthetic data.
3. **Hold-out test:** built into the pipeline. Each fit trains on the first 70% of its window and is tested on the rest. Read the errors in `calibration.json`.
4. **Drift check:** compare converted Aqua with actual VIIRS for 2020 onward. If the gap grows, drift is affecting Aqua, which supports ending the fitting window at 2019.
5. **Sanity check:** for the test region, known bad fire seasons should show high anomaly values.
6. **Report numbers honestly:** correlation, bias factors, hold-out errors, and the cases where a fit is weak.

## 8. Web app design (proposed)

The stack is open for the team to decide. A reasonable default is a Python backend reusing the functions from `harmonize.py`, a Leaflet or MapLibre map with a draw tool, and a charting library for the heatmap.

```
Browser
  map: draw polygon or box, OR type lat/lon bounds
  date range picker
        |
        v  request: area_of_interest + start_month + end_month
Backend API
  1. select rows of cell_month where cell is inside area_of_interest
  2. sum harmonized_count per month
  3. build calendar_table and anomaly_table
  4. return JSON
        |
        v
Browser: calendar heatmap, anomaly heatmap, summary numbers, download buttons
```

**Design choices:**

- **Precompute once.** Run the pipeline offline and keep `cell_month` in a table. The app only filters and sums, so it responds fast.
- **Calibrate once on a large region, then reuse the line for any area.** Fitting on a tiny user-selected area would give a noisy, unreliable line.
- **Area snaps to cells.** With 0.25 degree cells, a drawn area is rounded to whole cells. We will say so in the UI.
- **Current month is incomplete.** Comparing a half-finished month to a full-month median is misleading. Either compare to the same day-of-month window or label it partial.
- **Provisional flag.** The latest 2 to 5 months are NRT and will be replaced, so mark them as provisional.
- **Three downloads:** the harmonized monthly table for the selected area, the charts as PNG or SVG (the challenge asks for downloadable visualizations too), and the raw detections inside the area (from `unified.csv`; may need partitioning by year or a spatial index if the file is large).

**Colors (accessibility):**

- Counts: a sequential colorblind-safe ramp such as viridis or cividis.
- Anomaly: a diverging ramp centered on 1.0 (blue for below normal, orange for above).
- Never rely on color alone: show the number on hover or in the cell.

**Possible extras:** total FRP per month (already computed as `frp_total`), a line chart of the current year against the historical median, and a top-N table of the most active months.

## 9. What the two sample files told us

Both files are one day only (10 Sep 2026), South Asia region.

|  | MODIS sample | VIIRS sample (NOAA-20) |
| --- | --- | --- |
| Rows | 24 | 523 |
| Missing values or duplicates | none | none |
| Pixel footprint (scan x track) | 1.0 to 8.8 km2 | 0.14 to 0.59 km2 |
| Median FRP | 9.8 MW | 2.3 MW |
| Night detections | 12.5% | 62% |
| Confidence | numeric | labels |

Conclusions: the MODIS file is a tiny subset, so the row-count gap says nothing about real activity. Pixel size grows toward the swath edge on both sensors, so detections are not perfectly uniform. One day cannot calibrate anything, which is why we need the archive.

## 10. Assumptions and known limitations

- Confidence thresholds (30 and 80) are from memory. Verify against the user guides.
- NOAA-21 start date differs between two FIRMS pages (17 Jan 2024 vs 1 Mar 2023). We use the archive date, 1 Mar 2023.
- S-NPP stopped producing new FIRMS data on 2 Nov 2026 ([NASA FIRMS team](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know)). Its history stays in the archive; from now on VIIRS means NOAA-20 and NOAA-21.
- Our calibration windows rest on one NASA note about drift timing. Check the dates against the data, and widen a window only if the fit holds.
- Terra's morning orbit has no VIIRS counterpart, so the Nov 2000 to Jun 2002 segment is chained through Aqua. It is the least certain part of the calendar.
- One regression line per satellite pair for the whole region. The real relationship probably differs by land cover and region (forest fires vs crop burning).
- Fitting at cell level is noisy. Fitting on region-month totals may be more stable. Compare both.
- Satellite normalization assumes equal sensitivity, but satellites pass overhead at different times of day.
- We count detections only. Pixel size and scan angle are not corrected for.
- Sparse areas give noisy calendars. Show a warning when counts are very low.
- NRT and science-quality data may differ slightly. Recent months can change.
- The LANCE archive path (nrt3 primary, nrt4 backup) is not verified as a source of full history. The FIRMS Active Fire page describes it as the last two months. Use the Archive Download tool for history until we test it.
- Everything so far is tested on synthetic data only.

## 11. Open questions and plan for the 13th

Open questions for the team:

- Cell size: 0.25 or 0.5 degrees?
- Calibrate globally, per region, or per land cover?
- Do we include FRP as a second metric?
- Where do we host the data and the app?

Checklist once the real data is released:

1. **Now:** sign in with Earthdata Login and submit a small FIRMS Archive Download request. The FIRMS team approves requests, so it may not be instant. Ask for MODIS Terra and Aqua, VIIRS S-NPP and NOAA-20, one small region, 2002 to 2019 at least.
2. Test whether the LANCE archive path holds enough history for bulk download. If not, use the Archive Download tool only.
3. Run `python harmonize.py --modis "modis*.csv" --viirs "viirs*.csv" --res 0.25 --out out/`.
4. Read `calibration.json`: correlation, bias factors and hold-out errors for both fits.
5. Inspect `calendar.csv` around Jul 2002 and Jan 2012 for steps.
6. Compare converted Aqua with real VIIRS after 2019 to see whether drift is already affecting Aqua.
7. Build the web app on top of `cell_month.csv`.
8. Extend to the full 2000 to now range and the target region.

## 12. Glossary

- **Hotspot:** a satellite pixel flagged as burning.
- **FRP:** fire radiative power, the energy a fire radiates, in megawatts.
- **MODIS / VIIRS:** the two sensor families on the satellites.
- **NRT:** near real time data, provisional, replaced later by science-quality data.
- **AOI:** area of interest, the region the user selects.
- **Harmonization:** making data from different sensors comparable.
- **Regression:** fitting a line to paired data to predict one value from another.
- **Anomaly:** how far a value is from typical, here a ratio to the median.
- **NaN:** not a number, used here for missing data, different from zero.

## Sources

- [NASA FIRMS team: Transitioning from Suomi NPP VIIRS (27 Oct 2026)](https://www.earthdata.nasa.gov/news/blog/transitioning-from-suomi-npp-viirs-omps-what-firms-users-need-know): S-NPP end date, orbit and overpass notes, replacement satellites.
- [NASA LDOPE: MODIS Terra/Aqua Drift (8 Jan 2026)](https://landweb.modaps.eosdis.nasa.gov/displayissue?id=1254): last maneuvers and drift effects.
- FIRMS Active Fire Data and Archive Download pages (saved by the team): satellite availability dates and NRT replacement.
