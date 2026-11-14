# EmberTrace tasks

Task IDs and "done when" are in `docs/03-implementation-plan.md` §5. Tick **your own lines only**; file bugs under the owner's name.

## Person 1: Ingest (stages 1-4)
- [ ] ING-1 split `harmonize.py` into `ingest/` + `model/`; H1
- [ ] ING-2 config corrections → `pipeline/config.yaml`
- [ ] ING-3 loader, both formats
- [ ] ING-4 `scripts/profile_raw.py` → docs/07
- [ ] ING-5 filter + grid, unit tests
- [ ] ING-6 normalize with observed days (outages)
- [ ] ING-7 synthetic demo generator
- [ ] ING-8 `data_through`, `provisional_from` in H1
- [ ] ING-11 NRT static-source mask
- [ ] ING-9 `make pipeline`
- [ ] ING-10 real archive, small region then full
- [ ] Submission: README

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
- [ ] CHT-1 … CHT-9 (see plan)
- [ ] Submission: slide deck + presenting
