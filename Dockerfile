# EmberTrace: one container serving the FastAPI backend (/api) and the built React frontend (/).
# Deployed to Cloud Run (see docs/06-deployment.md). Owner: Person 3.
#
# Expects (per docs/03 §2):
#   web/package.json + package-lock.json, `npm run build` -> web/dist
#   api/requirements.txt, api/main.py exposing `app`
#   data/cell_month.parquet, data/meta.json (pipeline outputs, `make pipeline`)

# ---- Stage 1: build the frontend ----
FROM node:20-alpine AS web
# Keep the repo layout: web/ imports ../contracts/api/types.ts and ../contracts/fixtures/*.json.
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY contracts/api/ /src/contracts/api/
COPY contracts/fixtures/ /src/contracts/fixtures/
COPY web/ ./
# The deployed app always talks to the live API on the same origin.
ENV VITE_USE_MOCKS=false
RUN npm run build

# ---- Stage 2: runtime ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/static
WORKDIR /app

COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

COPY api/ api/
COPY data/cell_month.parquet data/meta.json data/
COPY --from=web /src/web/dist static/

RUN useradd --create-home appuser
USER appuser

# Cloud Run sets $PORT; shell form so it expands.
CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --workers 1
