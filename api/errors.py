"""The one error envelope (API spec §6): {"error": {"code", "message", "details"}}."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.message, self.details = status, code, message, details or {}


def invalid_aoi(message, field, received=None):
    return ApiError(400, "INVALID_AOI", message, {"field": field, "received": received})


def invalid_dates(message, field, coverage):
    return ApiError(400, "INVALID_DATES", message, {"field": field, "coverage": coverage})


def _envelope(status, code, message, details):
    return JSONResponse(status_code=status,
                        content={"error": {"code": code, "message": message, "details": details}})


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, e: ApiError):
        return _envelope(e.status, e.code, e.message, e.details)

    @app.exception_handler(RequestValidationError)
    async def bad_body(_: Request, e: RequestValidationError):
        # Body shape errors map onto the spec's codes: anything about the dates is INVALID_DATES,
        # everything else (missing body, missing or malformed aoi) is INVALID_AOI.
        err = e.errors()[0]
        loc = [str(p) for p in err.get("loc", []) if p != "body"]
        field = ".".join(loc) or "body"
        if loc and loc[0] in ("start_month", "end_month"):
            return _envelope(400, "INVALID_DATES", f"{field} must be a YYYY-MM string.", {"field": field})
        if not loc or err.get("type") == "json_invalid":
            return _envelope(400, "INVALID_AOI", "The request body must be a JSON object with an 'aoi'.",
                             {"field": "body"})
        return _envelope(400, "INVALID_AOI", f"{field}: {err.get('msg', 'invalid')}.", {"field": field})
