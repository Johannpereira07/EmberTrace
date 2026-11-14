# EmberTrace

**NASA Space Apps Challenge 2026 · Challenge 15: Harmonization of MODIS and VIIRS Hot Spots**

EmberTrace harmonizes NASA FIRMS active-fire hotspots from MODIS (Terra, Aqua) and VIIRS (S-NPP, NOAA-20, NOAA-21) into one consistent, VIIRS-equivalent monthly record, from November 2000 to today. A web app lets you pick any area and date range. It then shows:

- a **burning activity calendar** (year × month heatmap)
- an **anomaly calendar** comparing each month with the historical median
- **data-quality markers**: converted years, provisional and partial months, low counts
- a **CSV download** of the monthly data

**Success test:** no visible jump in the calendar at the sensor handovers (Jul 2002, Jan 2012).

> ⚠️ Until the real FIRMS archive is processed, all numbers are **synthetic demonstration data**.

## Documentation

Start at [`docs/README.md`](docs/README.md). Key docs:

- [Problem Statement](docs/00-problem-statement.md)
- [PRD](docs/01-prd.md)
- [Implementation Plan](docs/03-implementation-plan.md) (current build plan)
- [API Spec](docs/04-api-spec.md)

## Data credits

Fire detections from NASA FIRMS ([firms.modaps.eosdis.nasa.gov](https://firms.modaps.eosdis.nasa.gov/)), MODIS Collection 6.1 and VIIRS 375 m active fire products.
