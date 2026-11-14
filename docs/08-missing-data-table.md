# NASA FIRMS – Missing Data Table

**FIRMS:** Fire Information for Resource Management System  
**Page:** API / missing_dates  
**Version:** 2.13.6

## 1. Missing Data Table Information

This table provides a list of days where data is missing from the NASA FIRMS database.

- Each entry represents one day with missing data for a particular satellite and data type.
- Multiple entries may exist for the same day, differentiated by satellite or data type.
- Near Real Time (NRT) data is displayed **only after the last available date of standard data for each satellite**.
- If an error message appears, wait a few hours and try again.

## 2. Standard Data – Missing Dates

| Date Missing | Satellite (Sensor) |
|---|---|
| 2026-07-16 | Suomi NPP (VIIRS) |
| 2026-07-15 | Suomi NPP (VIIRS) |
| 2026-07-14 | Suomi NPP (VIIRS) |
| 2026-07-13 | Suomi NPP (VIIRS) |
| 2026-07-12 | Suomi NPP (VIIRS) |
| 2026-07-11 | Suomi NPP (VIIRS) |
| 2026-06-02 | Suomi NPP (VIIRS) |
| 2026-06-01 | Suomi NPP (VIIRS) |
| 2026-05-31 | Suomi NPP (VIIRS) |
| 2026-05-30 to 2026-04-28 | Suomi NPP (VIIRS) |
| 2026-03-12 to 2026-03-10 | Suomi NPP (VIIRS) |
| 2026-01-12 | Terra (MODIS) |
| 2024-11-05 to 2024-11-03 | Suomi NPP (VIIRS) |
| 2024-09-26 | Suomi NPP (VIIRS) |
| 2024-07-28 to 2024-07-26 | Suomi NPP (VIIRS) |
| 2024-07-15 to 2024-07-10 | Suomi NPP (VIIRS) |
| 2024-06-03 to 2024-05-30 | Suomi NPP (VIIRS) |
| 2024-02-04 | NOAA-20 (VIIRS) |
| 2023-09-30 | NOAA-20 (VIIRS) |
| 2023-07-22 to 2023-07-19 | NOAA-20 (VIIRS) |
| 2022-10-22 to 2022-10-11 | Terra (MODIS) |
| 2022-08-10 to 2022-07-27 | Suomi NPP (VIIRS) |
| 2022-04-16 to 2022-04-01 | Aqua (MODIS) |
| 2016-02-27 to 2016-02-19 | Terra (MODIS) |
| 2012-03-25 | Suomi NPP (VIIRS) |
| 2008-12-22 to 2008-12-21 | Terra (MODIS) |
| 2003-12-23 to 2003-12-17 | Terra (MODIS) |
| 2002-09-13 | Aqua (MODIS) |
| 2002-08-07 to 2002-07-30 | Aqua (MODIS) |
| 2002-04-15 | Terra (MODIS) |
| 2002-03-27 to 2002-03-20 | Terra (MODIS) |
| 2001-07-02 to 2001-06-16 | Terra (MODIS) |

## 3. Near Real Time (NRT) Data – Missing Dates

| Date Missing | Satellite (Sensor) |
|---|---|
| 2024-03-06 | NOAA-21 (VIIRS) |
| 2024-03-05 | NOAA-21 (VIIRS) |
| 2024-03-04 | NOAA-21 (VIIRS) |
| 2024-03-03 | NOAA-21 (VIIRS) |
| 2024-03-02 | NOAA-21 (VIIRS) |
| 2024-03-01 | NOAA-21 (VIIRS) |
| 2024-02-29 | NOAA-21 (VIIRS) |
| 2024-02-28 | NOAA-21 (VIIRS) |
| 2024-02-27 | NOAA-21 (VIIRS) |

## 4. Satellite and Sensor Reference

| Satellite | Sensor |
|---|---|
| Terra | MODIS |
| Aqua | MODIS |
| Suomi NPP | VIIRS |
| NOAA-20 | VIIRS |
| NOAA-21 | VIIRS |

## 5. FIRMS Resources

- Global Fire Map
- US & Canada Fire Map
- Fire Alerts
- Download Archived Data
- Web Services
- MODIS Active Fire Data
- VIIRS Active Fire Data
- LANCE
- Tutorials
- Fire Data Academy
- Satellite Imagery
- FIRMS Blog
- FAQ
- Additional Resources
- Acknowledgements & Citation

**Available Formats:** SHP, TXT, KML

---

**NASA Official:** Sadashiva Devadiga  
**Website:** NASA FIRMS – Fire Information for Resource Management System  
**Version:** 2.13.6
---

## 6. Checked against our raw files (14 Nov 2026)

*Added by the team, not part of the FIRMS page.* For every listed day, we counted that satellite's detections in `data/raw/` (India) and compared them with the days around it.

**Confirmed:** every standard-data row except the two below has **zero** detections on the listed days in our data, while the neighbouring days have detections.

**Copy errors or mismatches. Recheck these against the FIRMS page:**

| Row in section 2 | What our data shows |
|---|---|
| 2026-05-30 to 2026-04-28 (Suomi NPP) | Only **2026-04-28 to 2026-04-30** are empty. 1 to 30 May has normal detections (81,601 in total). The row probably should read "2026-04-30 to 2026-04-28". |
| 2026-05-31 (Suomi NPP) | 1,264 detections, which is normal for the period. Possibly a partial day. Not empty in our data. |

**NRT section:** it doesn't apply to us, because our NRT files start 2026-08. Our standard NOAA-21 data covers 2024-02-29 to 03-06 normally, but has **zero** detections on **2024-02-27 and 02-28**, which aren't in the standard list.

**Empty days in our standard data that the table doesn't list** (zero detections, neighbouring days' median in brackets):

- NOAA-21: 2024-02-27 (~1620), 2024-02-28 (~1795)
- Suomi NPP: 2023-07-26 (~62), 2025-07-07 (~49)
- Aqua: 2003-05-12 (~100), 2007-02-12 (~77), 2026-01-03 (~144); weaker: 2002-11-15 (~20), 2018-10-10 (~22)
- Terra: 2002-03-28 (~62, extends the listed 03-20..03-27 gap), 2004-02-19 (~58), 2017-04-24 (~243), 2023-01-01 (~68), 2026-03-27 (~158); weaker: 2001-10-07, 2003-02-01, 2008-12-20, 2008-12-23 (extends the listed gap), 2013-10-25, 2014-10-26, 2019-10-26 (~23 to ~42)

The "weaker" days have so few detections around them that a natural zero day is possible.

**Readme/FAQ dates in CLAUDE.md, checked:**

| Readme/FAQ | Our data |
|---|---|
| 2001-04-15 | 11 Terra detections, so not a full outage. Probably a typo for 2002-04-15, which is listed and is empty in our data. |
| 2001-06-15 to 07-03 | Empty from 06-15 to 07-03. The table says 06-16 to 07-02. The edges are ambiguous because the monsoon gives 1 to 6 detections a day. |
| 2002-03-19 to 28 | 03-19 has 268 detections. **03-20 to 03-28** is empty. |
| Mid-Aug 2007 | Detections present on most days for both Terra and Aqua. Not a full outage. |
| 2009-04-21/22 | Hundreds of detections on both days for both satellites. Not a full outage over India. |

### What the 21 unlisted empty days are

**They are gaps for one satellite, not days without fire.** On 19 of the 21, other satellites detected fires over India on the same day. Examples: Terra 2017-04-24 (usually ~243; Aqua 287 and S-NPP 3,199 that day), Terra 2026-03-27 (~158; VIIRS 5,000 to 7,000 per satellite), Aqua 2026-01-03 (~144; VIIRS ~900 to 1,100), NOAA-21 2024-02-27/28 (~1,700; S-NPP and NOAA-20 1,200 to 2,200). The other two days, Terra 2001-10-07 and 2002-03-28, can't be cross-checked because Terra was the only satellite flying.

**Some are edges of listed gaps that run a day longer than the table says:** Terra 2008-12-20 and 12-23 bracket the listed 12-21..22. Terra 2002-03-28 extends the listed 03-20..27. NOAA-21 has day detections but no night ones on 2024-02-26, then nothing on 02-27 and 02-28, so its outage probably began partway through 02-26. Because 02-26 has detections, it counts as observed (partial day).

**Likely reason they're not in the FIRMS list (unconfirmed):** the table lists days missing from the FIRMS database worldwide. If only the passes over India were lost, the day isn't missing globally, so only a regional check like this one finds it.

**Effect on the product:**

| Effect | Days |
|---|---|
| Changes calendar values | Terra 2001-10-07, 2002-03-28 (chained segment); Aqua 2002-11-15, 2003-05-12, 2007-02-12 (Aqua is the source); S-NPP 2023-07-26, 2025-07-07, NOAA-21 2024-02-27/28 (VIIRS months) |
| Changes calibration fits only | Terra 2003-02-01, 2004-02-19, 2008-12-20, 2008-12-23 (Terra to Aqua window); Aqua 2018-10-10 (Aqua to VIIRS window) |
| No effect (satellite not used then) | Terra 2013-10-25, 2014-10-26, 2017-04-24, 2019-10-26, 2023-01-01, 2026-03-27; Aqua 2026-01-03 |

### Days with no data from any satellite

The rule checks each satellite on its own, so on a day when every flying satellite is empty, every satellite gets an outage. In our data this happens on **28 days, all from the period when Terra was the only satellite**: 2001-06-16..07-02, 2001-10-07, 2002-03-20..28 and 2002-04-15. From July 2002 on, there are **64 days when both Terra and Aqua are empty**, all between 2002 and 2011 and all in June to September (the monsoon, when fires over India are rare). On none of them did the surrounding days clearly have detections (combined median below 20), so the rule counts them as "observed, zero fires", which is most likely correct. There's no all-empty day once VIIRS flies (2012 on). `scripts/check_outages.py` warns about an all-empty day with 2 or more satellites flying only when the surrounding days clearly have detections. Such a day would point to a problem with our download. Today there are none.

**NRT period:** the full pipeline run (`docs/09`), which also reads the NRT files, finds one more empty day: **S-NPP 2026-08-03** (0 detections, neighbouring days' median ~56, not in the FIRMS table). That makes 159 outage days in total.

**Rule for the pipeline (ING-6):** a satellite-day is an **outage** only if our data has **zero detections** for that satellite that day **and** (FIRMS lists it **or** the neighbouring days are clearly non-zero). Any day with at least one detection is observed, even if FIRMS lists it. Partial days (fewer detections than usual) count as fully observed, which is a known limitation of at most about 3% of a month's weight per day. The cut-off for "clearly non-zero" is a config value, labeled provisional. The rule is coded once in `pipeline/ingest/outages.py`: `pipeline/run.py` applies it (and writes `outages.csv`), and `scripts/check_outages.py` regenerates the lists above.
