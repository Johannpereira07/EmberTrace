# Deployment: Google Cloud Run

**Owner:** Person 3 (API-9) · **Decision:** closes PRD D7 / API Spec O8 (hosting)

## Decision

One container on **Cloud Run** serves both the FastAPI backend under `/api` and the built React frontend at `/`. This follows the Implementation Plan's single-container choice (docs/03 §4).

| Setting | Value |
|---|---|
| GCP project | `embertrace-nasa26` *(fill in the real ID if taken)* |
| Region | `asia-south1` (Mumbai) |
| Service | `embertrace` |
| Public URL | *(fill in after first deploy)* |
| Backup | Frontend in mock mode on GitHub Pages (docs/03 §7) |

```
GitHub repo ──► Cloud Build ──► Artifact Registry ──► Cloud Run (asia-south1)
                                                      ├── FastAPI   /api/*
                                                      ├── React build at /
                                                      └── data/cell_month.parquet + meta.json (baked in)

Cloud Storage bucket (private, optional): raw FIRMS archive + pipeline outputs. Never in git or the image.
```

**Why these choices:**

- **Data baked into the image.** `cell_month.parquet` is expected to be small (tens of MB at 0.25° over the study region) and is loaded at startup. Code and data deploy together, so there are no bucket permissions to manage at runtime. If it grows past a few hundred MB, move it to Cloud Storage and download at startup.
- **The pipeline runs offline** (laptop or Cloud Shell), never on Cloud Run. Earthdata credentials stay with the pipeline and never reach the deployed app.
- **Same origin.** The frontend calls `/api/...` relatively, so CORS is not needed in production.

## One-time setup (before Sat 20:00)

Do this early. Billing problems are what block a 2 AM deploy.

```bash
gcloud auth login
gcloud projects create embertrace-nasa26          # must be globally unique
gcloud config set project embertrace-nasa26
# Link a billing account in the console: Billing → Link a billing account
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

Give teammates access (Person 3 + one backup, e.g. Person 4 for hotfixes):

```bash
gcloud projects add-iam-policy-binding embertrace-nasa26 \
  --member="user:TEAMMATE_EMAIL" --role="roles/run.admin"
gcloud projects add-iam-policy-binding embertrace-nasa26 \
  --member="user:TEAMMATE_EMAIL" --role="roles/cloudbuild.builds.editor"
```

Set a budget alert (Billing → Budgets & alerts, e.g. $10) so nothing surprises you.

## Deploying

```bash
make pipeline       # produces data/cell_month.parquet + data/meta.json
make docker-run     # optional: test the production container at http://localhost:8080
make deploy         # Cloud Build builds the Dockerfile, Cloud Run serves it, prints the URL
```

Smoke test after every deploy:

```bash
curl "$(make -s url)/api/health"
curl "$(make -s url)/api/meta"
```

Showcase (Sun 15:00): run `make demo-on` beforehand to keep one instance warm and avoid cold starts. Run `make demo-off` afterwards.

Rollback: Cloud Run console → service → Revisions → route 100% traffic to the previous revision.

## What the code must do to run on Cloud Run

These are contracts on the `api/` and `web/` code (the Dockerfile depends on them):

| Requirement | Who |
|---|---|
| `api/main.py` exposes a FastAPI `app`; dependencies in `api/requirements.txt` (`fastapi`, `uvicorn`, `pandas`, `pyarrow`) | Person 3 |
| All routes under `/api` (the API Spec uses this prefix) | Person 3 |
| `GET /api/health` returns 200 once the data is loaded | Person 3 |
| Read the data path from `DATA_DIR` and the frontend build path from `STATIC_DIR`; never write to disk | Person 3 |
| Mount the frontend **after** the API routes (see snippet) | Person 3 |
| `web/` builds with `npm run build` into `web/dist`, with a committed `package-lock.json` | Person 4 |
| `web/src/api/client.ts` uses relative `/api/...` URLs; mock mode via `VITE_USE_MOCKS` | Person 4 |
| Vite dev proxy `/api` → `http://localhost:8000`, so local dev also needs no CORS | Person 4 |
| `data/cell_month.parquet` and `data/meta.json` exist before deploy (`make check-data`) | Person 2 |

**API environment** (all optional; `api/settings.py`):

| Variable | Default | Notes |
|---|---|---|
| `DATA_DIR` | `data` (`/app/data` in the image) | Folder with the pipeline outputs |
| `CELL_MONTH_FILE` | `cell_month.parquet` | `.parquet` or `.csv` |
| `META_FILE` | `meta.json` | |
| `STATIC_DIR` | `static` (`/app/static` in the image) | Not mounted if the folder is missing (API-only local runs) |
| `LOW_COUNT_THRESHOLD`, `MIN_BASELINE_YEARS` | from `api/config.json` | **Provisional** placeholders (PRD D5) |

If the data is missing or breaks the contract, the server refuses to start, so a bad deploy fails instead of serving wrong numbers. Locally, `make api` serves the stand-in sample from `contracts/samples/` until H2 lands.

FastAPI static mount (end of `api/main.py`):

```python
import os
from fastapi.staticfiles import StaticFiles

# after all /api routes are registered
app.mount("/", StaticFiles(directory=os.environ.get("STATIC_DIR", "static"), html=True), name="web")
```

Vite dev proxy (`web/vite.config.ts`):

```ts
server: { proxy: { "/api": "http://localhost:8000" } }
```

## Optional: deploy on merge to `main`

When there's time (Block D), add `.github/workflows/deploy.yml` using `google-github-actions/auth` with **Workload Identity Federation** (no JSON key in GitHub secrets) and `google-github-actions/deploy-cloudrun`. Until then, `make deploy` from a laptop is fine.

## Costs

Cloud Run bills per request-second and scales to zero, so a hackathon's traffic should fit within the free tier. A warm instance (`demo-on`) costs a little per hour, so turn it off after the Showcase. Cloud Build and Artifact Registry usage at this scale is negligible.
