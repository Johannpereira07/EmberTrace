# EmberTrace Makefile. Owner: Person 3.
# Deployment targets only for now; pipeline/api/web/test targets from docs/03 §6 get added as those layers land.

PROJECT ?= embertrace-nasa26
REGION  ?= asia-south1
SERVICE ?= embertrace
IMAGE   ?= embertrace:local
PYTHON  ?= python
OUT     ?= out

.PHONY: pipeline pipeline-test synthetic export check-data docker-build docker-run deploy demo-on demo-off url logs

# ---- Pipeline (Person 1, ING-9). Full India run: about 2 min, peak about 4.6 GB RAM (docs/09).
# Writes $(OUT)/ (gitignored). Exporting data/cell_month.parquet + data/meta.json for the app is CAL-4 (Person 2).
pipeline:
	$(PYTHON) pipeline/run.py --modis "data/raw/DL_FIRE_M-C61_*/fire_*.csv" \
	  --viirs "data/raw/DL_FIRE_*V-C2_*/fire_*.csv" --out $(OUT)

# Export the app's data (CAL-4, contracts/cell_month.schema.md): $(OUT)/ -> data/cell_month.parquet, data/meta.json
export:
	$(PYTHON) pipeline/export.py --run $(OUT) --out data

pipeline-test:
	$(PYTHON) -m pytest pipeline/tests -q

# Synthetic data with a planted answer (ING-7): generate into $(OUT)/synthetic/raw, run the pipeline into
# $(OUT)/synthetic, then compare with the planted truth. About 20 s, no real data needed.
synthetic:
	$(PYTHON) tools/synthetic/generate.py --out $(OUT)/synthetic/raw
	$(PYTHON) pipeline/run.py --modis "$(OUT)/synthetic/raw/DL_FIRE_M-C61_*/fire_*.csv" \
	  --viirs "$(OUT)/synthetic/raw/DL_FIRE_*V-C2_*/fire_*.csv" --out $(OUT)/synthetic
	$(PYTHON) tools/synthetic/check.py $(OUT)/synthetic


check-data:
	@test -f data/cell_month.parquet || (echo "data/cell_month.parquet missing: run 'make pipeline && make export' first" && exit 1)
	@test -f data/meta.json || (echo "data/meta.json missing: run 'make pipeline && make export' first" && exit 1)

# Build and run the production container locally (http://localhost:8080)
docker-build: check-data
	docker build -t $(IMAGE) .

docker-run: docker-build
	docker run --rm -p 8080:8080 -e PORT=8080 $(IMAGE)

# Build on Cloud Build and deploy to Cloud Run
deploy: check-data
	gcloud run deploy $(SERVICE) --source . \
	  --project $(PROJECT) --region $(REGION) \
	  --allow-unauthenticated \
	  --memory 2Gi --cpu 1 \
	  --min-instances 0 --max-instances 3 \
	  --concurrency 40 --timeout 60
	@$(MAKE) --no-print-directory url

# Keep one instance warm during the Showcase (no cold starts), then turn it back off
demo-on:
	gcloud run services update $(SERVICE) --project $(PROJECT) --region $(REGION) --min-instances 1

demo-off:
	gcloud run services update $(SERVICE) --project $(PROJECT) --region $(REGION) --min-instances 0

url:
	@gcloud run services describe $(SERVICE) --project $(PROJECT) --region $(REGION) --format 'value(status.url)'

logs:
	gcloud run services logs read $(SERVICE) --project $(PROJECT) --region $(REGION) --limit 100
