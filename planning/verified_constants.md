# Verified constants (Role 2 draft, 13 Nov 2026)

Status key: **VERIFIED** = confirmed in an official or primary source. **CORRECTION** = the design doc disagrees with the source. **UNVERIFIED** = not confirmed; keep labeled in all docs.

| # | Constant | Design doc value | Status | Evidence |
|---|---|---|---|---|
| 1 | MODIS confidence classes | low < 30, nominal 30 to < 80, high >= 80 | **VERIFIED** | MODIS C6 Active Fire User's Guide Rev B, Table 10 (modis-fire.umd.edu/files/MODIS_C6_Fire_User_Guide_B.pdf). Code boundaries (`< 30`, `< 80`) match. |
| 2 | VIIRS confidence classes | low / nominal / high | **VERIFIED** | Earthdata FIRMS attribute page: VIIRS confidence is set to low, nominal, high. |
| 3 | VIIRS archive letters `l/n/h` | letters in archive CSV | **UNVERIFIED** | From design doc only. Check the header and values of the first real archive file. |
| 4 | Type 0 = presumed vegetation fire | filter `type == 0` | **VERIFIED** (meaning) | Earthdata attribute page. That page says Type is only available for MCD14ML standard-quality MODIS data. |
| 5 | VIIRS archive has a `type` column | assumed | **UNVERIFIED** | If absent, the loader defaults to 0, so VIIRS is not filtered like MODIS. Check the first real VIIRS file. |
| 6 | Terra start | Nov 2000 | **VERIFIED** (month) | FIRMS Archive Download: MODIS C6.1 from 1 Nov 2000. |
| 7 | Aqua start | Jul 2002 | **UNVERIFIED** (day) | Month only, from a secondary source. Exact day not confirmed. |
| 8 | S-NPP start | Jan 2012 | **VERIFIED** | FIRMS Archive Download: 20 Jan 2012. January 2012 is a partial month. |
| 9 | NOAA-20 start | Apr 2018 | **VERIFIED** | FIRMS Archive Download: 1 Apr 2018. |
| 10 | NOAA-21 start | 1 Mar 2023 | **CORRECTION** | FIRMS Archive Download and the NASA ARSET FIRMS Q&A both give 17 Jan 2024. FIRMS announced NOAA-21 data in Feb 2024. Nothing found supports 1 Mar 2023. |
| 11 | S-NPP end | 2 Nov 2026 | **VERIFIED** | NASA Earthdata blog, 27 Oct 2026: new FIRMS S-NPP data stops 2 Nov 2026 13:00 UTC. History stays available. |
| 12 | Terra and Aqua end dates | "while operating" | **UNVERIFIED** | Sources conflict (NSIDC: Terra Dec 2025, Aqua Aug 2026; CAMS: Terra Jan 2027, Aqua about Sep 2027). Do not hard-code. |
| 13 | Orbit-maintenance end dates | Aqua 2021, Terra 2022 | **VERIFIED** | NASA SPIE paper (Twedt et al.): Aqua last inclination maneuver 18 Mar 2021; Terra last 27 Feb 2020, constellation exit Oct 2022. |
| 14 | Aqua to VIIRS window 2012 to 2019 | before drift | **VERIFIED** (dates) / **pending real data** (effect) | Window ends before Aqua's last maneuver. Whether 2020 onward is already biased needs the real archive. |
| 15 | Terra to Aqua window Aug 2002 to Dec 2011 | before drift | **VERIFIED** (dates) | Ends well before either drift began. |

## Impact of row 10

If the code counts NOAA-21 from Mar 2023 but FIRMS has no NOAA-21 detections until 17 Jan 2024, then for Mar 2023 to Jan 2024 the VIIRS per-satellite count is divided by 3 instead of 2. That makes those months about one third too low and creates a fake dip (and a fake step in Jan 2024), which breaks the "no visible jump" success test. Proposed fix: change the NOAA-21 start date in config, or confirm a source for the earlier date. This does not affect the calibration windows (2012 to 2019).

## Still needs real archive data
- Overlap plot: converted Aqua vs actual VIIRS, 2012 to 2019
- Drift check: converted Aqua vs actual VIIRS from 2020 onward
- Known bad fire seasons show high anomaly values
- Real hold-out errors and correlations
