# EmberTrace tasks

Task IDs and "done when" are in `docs/03-implementation-plan.md` §5. Tick **your own lines only**; file bugs under the owner's name.

## Person 1: Ingest (stages 1-4)
- [x] ING-1 split `harmonize.py` into `ingest/` + `model/`; H1 (byte-identical outputs)
- [x] ING-2 config corrections → `pipeline/config.yaml` (`test_no_step_when_noaa21_joins`)
- [x] ING-3 loader, both formats (all 8 files in `data/raw/` load, docs/09; the two one-day sample files are no longer in the repo)
- [x] ING-4 `scripts/profile_raw.py` → docs/07
- [x] ING-5 filter + grid, unit tests
- [x] ING-6 normalize with observed days (outages)
- [x] ING-7 synthetic demo generator (`make synthetic`)
- [x] ING-8 `data_through`, `provisional_from` in H1
- [x] ING-11 NRT static-source mask (±4%, docs/10)
- [x] ING-9 `make pipeline` (about 2 min, 4.6 GB, docs/09)
- [x] ING-10 real archive, small region then full (docs/09)
- [ ] Submission: README (drafted; needs app run steps now `api/` + `web/` exist, and a teammate review)

## Person 2: Calibration & data (stages 5-7)
- [ ] CAL-1 H2 schemas + sample `cell_month.parquet` + `meta.json`
- [ ] CAL-2 calibrate
- [ ] CAL-3 harmonize
- [ ] CAL-4 export
- [ ] CAL-5 splice check
- [ ] CAL-6 cell size check
- [ ] CAL-7 hero figure
- [ ] CAL-8 real-data runbook
- [ ] CAL-9 run runbook, 12:00 go/no-go
- [ ] CAL-10 explainer text
- [ ] Submission: 2 slides

## Person 3: Backend API
- [x] API-1 `Makefile` targets, H3 (`contracts/api/types.ts` + `contracts/fixtures/`, generated from the stand-in sample)
- [x] API-2 FastAPI app, data loaded in one place (`api/dataset.py`), `GET /api/meta`, `GET /api/health`
- [x] API-3 input checks and error codes
- [x] API-4 snap outward, select cells, sum, `state`
- [x] API-5 anomaly states
- [x] API-6 flags and warnings
- [x] API-7 monthly CSV; detections 501
- [x] API-8 contract tests + `make fixtures` (`make contract-test` green)
- [ ] API-9 deploy to Cloud Run (blocked: `web/` and `data/cell_month.parquet` don't exist yet; GCP project setup)
- [ ] API-10 polygon (Block D, after all Musts are live)
- [ ] Submission: submission page

## Person 4: Frontend app & map
- [ ] APP-1 … APP-9 (see plan)
- [ ] Submission: demo video

## Person 5: Frontend charts
- [x] CHT-1 … CHT-9 (see plan; CHT-1 playground, CHT-2 to 6 heatmaps & quality, CHT-7 app integration, CHT-8 SVG/PNG export, CHT-9 top-5 anomalies; 19 tests passing)
- [x] Submission: slide deck + presenting (docs/submission/presentation_deck.md and showcase_script.md ready for 15:00 Showcase)
