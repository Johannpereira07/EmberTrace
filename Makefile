# EmberTrace Makefile. Owner: Person 3.
# Deployment targets only for now; pipeline/api/web/test targets from docs/03 §6 get added as those layers land.

PROJECT ?= embertrace-nasa26
REGION  ?= asia-south1
SERVICE ?= embertrace
IMAGE   ?= embertrace:local

.PHONY: check-data docker-build docker-run deploy demo-on demo-off url logs

check-data:
	@test -f data/cell_month.parquet || (echo "data/cell_month.parquet missing: run 'make pipeline' first" && exit 1)
	@test -f data/meta.json || (echo "data/meta.json missing: run 'make pipeline' first" && exit 1)

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
