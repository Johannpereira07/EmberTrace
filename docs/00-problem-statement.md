# Problem Statement — NASA Space Apps Challenge 2026

**Challenge 15: Harmonization of MODIS and VIIRS Hot Spots**
Difficulty: Intermediate / Advanced · Subjects: Earth Science, Software
Our project: **EmberTrace**

## Goal

Build a **web application** that harmonizes MODIS and VIIRS active fire hotspot records into a single consistent **burning activity calendar** (early 2000s → present) for a user-selected area of interest.

Target users: early warning and emergency responders, firefighters, land managers, scientists.

## Why it's hard

- Satellites have tracked active fire hotspots for 20+ years, but the record is split across sensors that **cannot be compared directly**.
- **MODIS** (Terra & Aqua): 20+ year historical series, nearing end of life.
- **VIIRS**: the successor — continuity and greater detail.
- They differ in **spatial resolution, sensitivity, and observation schedule** (overpass times). Naively stitching them creates false trends/anomalies.
- Hotspots include wildfires and anthropogenic burning (agriculture, land clearing, waste, industry). Detection relies on mid-infrared (MIR) and thermal infrared (TIR) signals.

## Suggested data source

NASA Earthdata **FIRMS** hotspots (MODIS + VIIRS). Check the challenge's Resources tab for more.

## Two-part approach

### Part 1 — Harmonization
Combine MODIS's long history with VIIRS's continuity and detail so that **the sensor of origin no longer matters** — patterns, trends, and anomalies become the focus.

### Part 2 — Web application
Takes harmonized hotspot data as input. A user can:
- Select a **region** and a **date range**
- View visualizations of fire activity
- **Download analytics/visualizations** and a **CSV of hotspots** found in the search

## Core feature: burning activity calendar

Shows the number of hotspots over time so users can quickly see:
- Which **periods of the year** have the most fires (seasonality)
- Which **years** had the most burning activity
- How a **current fire / current month compares to the historical median** for the area

Use **color ramps** to represent differences in hotspot counts across months — must be **accessible** (colorblind-safe).

## Optional considerations (not required)

- Interactive map: **draw an area of interest** or **enter lat/lon**
- Accessible color ramps
- Focus on a few key indices and figures, e.g.:
  - Historical comparisons, including **anomalies vs multi-year averages**
  - Number of fires detected and reported

## Definition of done (for judging)

1. A harmonized MODIS + VIIRS hotspot time series
2. A web app with region + date-range selection
3. A burning activity calendar (month × year view) with an accessible color ramp
4. Comparison of current activity vs the historical median/average (anomalies)
5. CSV export of hotspots for the search
