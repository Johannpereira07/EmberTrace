"""EmberTrace API (docs/04-api-spec.md). Run: uvicorn api.main:app

Loads the precomputed pipeline output once at startup; if it is missing or breaks the contract the
server does not start (so Cloud Run never serves a wrong answer). Serves the built frontend at /.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

from . import errors
from .csv_export import filename, monthly_csv
from .dataset import Dataset, load_dataset
from .errors import ApiError
from .models import CalendarRequest, CalendarResponse, ErrorResponse, HealthResponse, MetaResponse
from .query import build_calendar
from .settings import Settings, load_settings

log = logging.getLogger("embertrace.api")
ERRORS = {s: {"model": ErrorResponse} for s in (400, 422)}


def create_app(settings: Settings | None = None, dataset: Dataset | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.ds = dataset or load_dataset(settings.cell_month_path, settings.meta_path)
        log.info("thresholds (PROVISIONAL): low_count < %s raw detections, min %s baseline years",
                 settings.low_count_threshold, settings.min_baseline_years)
        yield

    app = FastAPI(title="EmberTrace API", version="0.1", lifespan=lifespan)
    errors.install(app)

    def calendar_for(req: CalendarRequest, request: Request) -> dict:
        return build_calendar(req, request.app.state.ds, settings.low_count_threshold,
                              settings.min_baseline_years)

    @app.get("/api/health", response_model=HealthResponse)
    def health(request: Request):
        ds = request.app.state.ds
        return {"status": "ok", "data_kind": ds.data_kind, "pipeline_version": ds.meta["pipeline_version"]}

    @app.get("/api/meta", response_model=MetaResponse)
    def meta(request: Request):
        return request.app.state.ds.meta

    @app.post("/api/calendar", response_model=CalendarResponse, responses=ERRORS)
    def calendar(req: CalendarRequest, request: Request):
        return calendar_for(req, request)

    @app.post("/api/download/monthly.csv", response_class=Response, responses=ERRORS)
    def monthly(req: CalendarRequest, request: Request):
        cal = calendar_for(req, request)
        return Response(monthly_csv(cal), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{filename(cal)}"'})

    @app.post("/api/download/detections.csv", responses={501: {"model": ErrorResponse}})
    def detections():
        raise ApiError(501, "NOT_AVAILABLE", "Raw detections download is not available yet.")

    # Frontend last, so it never shadows an /api route (docs/06).
    if settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="web")
    else:
        log.info("no frontend build at %s; serving the API only", settings.static_dir)
    return app


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
app = create_app()
