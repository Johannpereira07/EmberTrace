# CLAUDE.md

EmberTrace: NASA Space Apps 2026, Challenge 15 (harmonizing MODIS + VIIRS fire hotspots). An offline Python pipeline produces a VIIRS-equivalent monthly series per grid cell. A FastAPI backend sums it over a user-selected area. A React frontend shows a year × month calendar, an anomaly calendar and quality flags, and offers a CSV download.

## Docs (read before non-trivial work)

- `docs/README.md` is the index and sets precedence. **The Implementation Plan (`docs/03`) overrides the others**, then the API Spec, then the PRD, then the Architecture doc.
- `docs/02-architecture-methodology.md` is an **outdated draft**. Use it for the science, but check its banner for superseded facts.
- `docs/05-task-delegation-prep.md` is historical (pre-hackathon roles).

## Planned stack and layout (docs/03 §2)

- Pipeline: Python + pandas + pyarrow (`pipeline/ingest/` stages 1 to 4, `pipeline/model/` stages 5 to 7, `pipeline/config.yaml`)
- API: FastAPI in `api/`, contract in `contracts/api/types.ts` + `contracts/fixtures/*.json`
- Web: React + Vite + TypeScript, react-leaflet + leaflet-draw, D3 scales + SVG charts, in `web/`
- Deploy: one Docker container (root `Dockerfile`) on **Google Cloud Run**, `asia-south1`. API under `/api`, frontend at `/`, data baked into the image. See `docs/06-deployment.md`
- Commands: `make pipeline | api | web | web-live | test | contract-test | fixtures` (planned); `make docker-run | deploy | demo-on | demo-off | url | logs` (exist)

Each folder has a single owner (docs/03 §2). Handoff files in `contracts/` change only with team agreement.

## Invariants (do not break)

- **NaN ≠ 0.** NaN or `null` / `unavailable` means no satellite was observing. 0 / `zero` means observed with no fires. Keep this from the pipeline through the API, UI and CSV. Never write an unavailable month as 0.
- **Never blend sensors after Jan 2012.** Sources: `VIIRS` (2012-01+), `AQUA_calibrated` (2002-07 to 2011-12), `TERRA_chained` (2000-11 to 2002-06).
- **No per-request recalibration.** One fit per satellite pair, done offline.
- **Nothing hard-coded:** satellite dates, cell size, thresholds and provisional months come from config or `meta.json`.
- Anomaly = value ÷ full-record median for the same calendar month. A zero median gives `not_defined`, never infinity. A partial month gives `non_comparable_partial`.
- Colorblind-safe scales (Cividis/Viridis; diverging blue↔orange centered on 1.0). Never use color alone to carry information.
- Synthetic data is always labeled as demonstration data. Don't claim real-data validation until it has been done.

## Corrected constants (docs/03 §4)

NOAA-21 start **2024-01-17**. S-NPP end **2026-11-02 13:00 UTC**. MODIS confidence thresholds 30/80 verified. VIIRS archive `l/n/h` letters and the `type` column are still unverified.

## Git conventions

Branch `p<N>/<TASK-ID>-slug` (e.g. `p3/API-5-anomaly`). Commit `feat(api): ... [API-5]`. Keep PRs small, under about 300 lines. Never commit credentials (`.env`) or real archive data.
