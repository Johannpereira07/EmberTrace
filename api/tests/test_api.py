"""Endpoints against the API spec: §4, §5, §6, §7 and every case in §10 (API-2 to API-8)."""
import csv
import io
import math

import pytest

from .conftest import SAMPLE_BBOX, TOY_BBOX, client_for


def cal(client, **body):
    return client.post("/api/calendar", json={"aoi": SAMPLE_BBOX, **body})


def by_month(resp):
    return {m["month"]: m for m in resp.json()["months"]}


def error_code(resp):
    return resp.json()["error"]["code"]


# ---- GET endpoints ----

def test_health(sample):
    assert sample.get("/api/health").json() == {
        "status": "ok", "data_kind": "real", "pipeline_version": "0.1-standin-central-india"}


def test_meta_returns_spec_shape(sample, sample_ds):
    body = sample.get("/api/meta").json()
    assert body == sample_ds.meta
    assert set(body) == {"data_kind", "pipeline_version", "cell_size_deg", "coverage",
                         "data_through", "provisional_from", "grid_extent"}


# ---- §10: Normal area ----

def test_normal_area(sample):
    r = cal(sample)
    assert r.status_code == 200
    body = r.json()
    assert len(body["months"]) == 312   # one per month, 2000-12..2026-11
    assert body["meta"]["aoi_analyzed"] == {"type": "bbox", "min_lat": 20.75, "max_lat": 21.75,
                                            "min_lon": 78.5, "max_lon": 79.5}
    assert body["meta"]["snapped"] is True and body["meta"]["n_cells"] == 16
    codes = [w["code"] for w in body["warnings"]]
    assert "SNAPPED_AOI" in codes and "SYNTHETIC_DATA" not in codes   # stand-in is data_kind real
    months = by_month(r)
    assert months["2002-11"]["source"] == "TERRA_chained"   # sample quirk, see contracts/samples/README
    assert months["2002-12"]["source"] == "AQUA_calibrated"
    assert months["2012-01"]["source"] == "VIIRS"
    assert months["2026-08"]["provisional"] and not months["2026-07"]["provisional"]


def test_values_are_the_sum_of_cells(sample, sample_ds):
    months = by_month(cal(sample))
    assert months["2012-02"]["value"] == pytest.approx(float(sample_ds.value[134].sum()))
    assert str(sample_ds.months[134]) == "2012-02"


def test_unsnapped_area_has_no_snap_warning(sample):
    body = cal(sample, **{"aoi": {"type": "bbox", "min_lat": 20.75, "max_lat": 21.0,
                                  "min_lon": 78.5, "max_lon": 78.75}}).json()
    assert body["meta"]["snapped"] is False and body["meta"]["n_cells"] == 1
    assert "SNAPPED_AOI" not in [w["code"] for w in body["warnings"]]


def test_date_range_selects_months_and_keeps_full_record_baseline(sample):
    full = cal(sample).json()
    part = cal(sample, start_month="2015-01", end_month="2015-12").json()
    assert [m["month"] for m in part["months"]] == [f"2015-{k:02d}" for k in range(1, 13)]
    assert part["meta"]["baseline"] == full["meta"]["baseline"]
    assert part["months"] == [m for m in full["months"] if m["month"].startswith("2015")]


# ---- §10: Sparse area, zero median ----

def test_sparse_area_low_count(sample):
    body = cal(sample, aoi={"type": "bbox", "min_lat": 20.8, "max_lat": 20.9,
                            "min_lon": 78.55, "max_lon": 78.7}).json()
    assert body["meta"]["n_cells"] == 1
    assert any(m["low_count"] for m in body["months"])
    assert "LOW_COUNT" in [w["code"] for w in body["warnings"]]


def test_zero_median_is_not_defined(toy):
    body = toy.post("/api/calendar", json={"aoi": TOY_BBOX}).json()
    assert body["meta"]["baseline"]["median_by_calendar_month"][6] == 0   # July
    for m in body["months"]:
        if m["month"].endswith("-07") and m["state"] != "unavailable":
            assert m["anomaly_state"] == "not_defined" and m["anomaly"] is None


def test_zero_value_with_positive_median_is_ok_zero(toy):
    zeros = [m for m in toy.post("/api/calendar", json={"aoi": TOY_BBOX}).json()["months"]
             if m["state"] == "zero" and m["anomaly_state"] == "ok"]
    assert zeros and all(m["anomaly"] == 0 for m in zeros)


def test_no_infinity_or_nan_anywhere(toy):
    for m in toy.post("/api/calendar", json={"aoi": TOY_BBOX}).json()["months"]:
        for k in ("value", "anomaly"):
            assert m[k] is None or math.isfinite(m[k])


# ---- §10: Zero versus unavailable ----

def test_zero_versus_unavailable(toy):
    months = by_month(toy.post("/api/calendar", json={"aoi": TOY_BBOX}))
    for name in ("2000-09", "2000-10", "2005-05"):   # before Terra; outage inside coverage
        m = months[name]
        assert m == {**m, "value": None, "state": "unavailable", "anomaly": None,
                     "anomaly_state": "unavailable", "source": None, "low_count": False}
    zero = months["2001-07"]
    assert zero["value"] == 0 and zero["state"] == "zero" and zero["source"] == "TERRA_chained"


def test_unavailable_months_not_in_baseline(toy_ds, tmp_path):
    with client_for(toy_ds, tmp_path, min_years=1) as c:
        body = c.post("/api/calendar", json={"aoi": TOY_BBOX}).json()
    may = [m["value"] for m in body["months"] if m["month"].endswith("-05") and m["value"] is not None]
    may.sort()
    mid = len(may) // 2
    expected = may[mid] if len(may) % 2 else (may[mid - 1] + may[mid]) / 2
    assert body["meta"]["baseline"]["median_by_calendar_month"][4] == pytest.approx(expected)


# ---- §10: Partial month, provisional ----

def test_partial_month(toy):
    body = toy.post("/api/calendar", json={"aoi": TOY_BBOX}).json()
    last = body["months"][-1]
    assert last["month"] == "2013-02" and last["partial"] is True
    assert last["anomaly_state"] == "non_comparable_partial" and last["anomaly"] is None
    assert not any(m["partial"] for m in body["months"][:-1])
    warnings = {w["code"]: w["ranges"] for w in body["warnings"]}
    assert warnings["PARTIAL_MONTH"] == [{"from": "2013-02", "to": "2013-02"}]
    assert warnings["PROVISIONAL"] == [{"from": "2012-12", "to": "2013-02"}]
    assert warnings["CHAINED_SEGMENT"] == [{"from": "2000-11", "to": "2002-06"}]
    assert warnings["SYNTHETIC_DATA"] == []


def test_partial_month_not_in_baseline(toy_ds, tmp_path):
    with client_for(toy_ds, tmp_path, min_years=1) as c:
        body = c.post("/api/calendar", json={"aoi": TOY_BBOX}).json()
    feb = sorted(m["value"] for m in body["months"]
                 if m["month"].endswith("-02") and not m["partial"])
    mid = len(feb) // 2
    expected = feb[mid] if len(feb) % 2 else (feb[mid - 1] + feb[mid]) / 2
    assert body["meta"]["baseline"]["median_by_calendar_month"][1] == pytest.approx(expected)


def test_not_enough_history(toy_ds, tmp_path):
    with client_for(toy_ds, tmp_path, min_years=50) as c:
        months = c.post("/api/calendar", json={"aoi": TOY_BBOX}).json()["months"]
    states = {m["anomaly_state"] for m in months}
    assert states == {"not_enough_history", "unavailable", "non_comparable_partial"}


def test_low_count_threshold_from_settings(toy_ds, tmp_path):
    with client_for(toy_ds, tmp_path, low_count=0) as c:
        body = c.post("/api/calendar", json={"aoi": TOY_BBOX}).json()
    assert not any(m["low_count"] for m in body["months"])
    assert "LOW_COUNT" not in [w["code"] for w in body["warnings"]]


# ---- §10: Input errors ----

@pytest.mark.parametrize("aoi, field", [
    ({**SAMPLE_BBOX, "min_lat": -100}, "aoi.min_lat"),               # latitude out of range
    ({**SAMPLE_BBOX, "max_lon": 181}, "aoi.max_lon"),
    ({**SAMPLE_BBOX, "min_lat": 25, "max_lat": 20}, "aoi.min_lat"),  # reversed bounds
    ({**SAMPLE_BBOX, "min_lon": 79.5, "max_lon": 79.5}, "aoi.min_lon"),
    ({**SAMPLE_BBOX, "min_lat": "20"}, "aoi.min_lat"),
    ({**SAMPLE_BBOX, "min_lat": True}, "aoi.min_lat"),
    ({k: v for k, v in SAMPLE_BBOX.items() if k != "max_lat"}, "aoi.max_lat"),
    ({**SAMPLE_BBOX, "type": "circle"}, "aoi.type"),
    ({"type": "polygon", "geometry": {}}, "aoi.type"),                # API-10 not built yet
])
def test_invalid_aoi(sample, aoi, field):
    r = sample.post("/api/calendar", json={"aoi": aoi})
    assert r.status_code == 400 and error_code(r) == "INVALID_AOI"
    assert r.json()["error"]["details"]["field"] == field


def test_reversed_bounds_matches_spec_a3(sample):
    r = sample.post("/api/calendar", json={"aoi": {**SAMPLE_BBOX, "min_lat": 25, "max_lat": 20}})
    assert r.json() == {"error": {"code": "INVALID_AOI", "message": "min_lat must be less than max_lat.",
                                  "details": {"field": "aoi.min_lat",
                                              "received": {"min_lat": 25, "max_lat": 20}}}}


@pytest.mark.parametrize("body", [None, [], {"start_month": "2001-01"}, {"aoi": "box"}])
def test_malformed_body_is_invalid_aoi(sample, body):
    r = sample.post("/api/calendar", json=body)
    assert r.status_code == 400 and error_code(r) == "INVALID_AOI"


def test_unparseable_json_is_invalid_aoi(sample):
    r = sample.post("/api/calendar", content=b"not json", headers={"content-type": "application/json"})
    assert r.status_code == 400 and r.json()["error"]["details"] == {"field": "body"}


@pytest.mark.parametrize("dates", [
    {"start_month": "2020-01", "end_month": "2019-12"},   # reversed dates
    {"start_month": "2000-05"},                            # before coverage
    {"end_month": "2026-12"},                              # after coverage
    {"start_month": "2020-13"},
    {"start_month": "2020-1"},
    {"start_month": 202001},
])
def test_invalid_dates(sample, dates):
    r = cal(sample, **dates)
    assert r.status_code == 400 and error_code(r) == "INVALID_DATES"


def test_invalid_dates_reports_coverage(sample):
    details = cal(sample, start_month="2000-05").json()["error"]["details"]
    assert details == {"field": "start_month", "coverage": {"first_month": "2000-12", "last_month": "2026-11"}}


def test_outside_the_grid(sample):
    r = cal(sample, aoi={"type": "bbox", "min_lat": 40, "max_lat": 41, "min_lon": 10, "max_lon": 11})
    assert r.status_code == 422 and error_code(r) == "OUT_OF_COVERAGE"
    assert r.json()["error"]["details"]["grid_extent"]["min_lat"] == 20.75


def test_touching_the_grid_edge_is_outside(sample):
    r = cal(sample, aoi={"type": "bbox", "min_lat": 21.75, "max_lat": 22, "min_lon": 78.5, "max_lon": 79})
    assert error_code(r) == "OUT_OF_COVERAGE"


def test_area_inside_extent_without_cells_is_empty(sample_ds, tmp_path):
    from dataclasses import replace
    ds = replace(sample_ds, meta={**sample_ds.meta, "grid_extent": {
        "min_lat": 20.0, "max_lat": 22.0, "min_lon": 78.0, "max_lon": 80.0}})
    with client_for(ds, tmp_path) as c:
        r = c.post("/api/calendar", json={"aoi": {"type": "bbox", "min_lat": 20.1, "max_lat": 20.2,
                                                  "min_lon": 78.1, "max_lon": 78.2}})
    assert r.status_code == 422 and error_code(r) == "EMPTY_AREA"
    assert r.json()["error"]["details"]["aoi_analyzed"] == {
        "type": "bbox", "min_lat": 20.0, "max_lat": 20.25, "min_lon": 78.0, "max_lon": 78.25}


# ---- §7: downloads ----

def read_csv(text):
    comments = [l for l in text.splitlines() if l.startswith("#")]
    rows = list(csv.DictReader(io.StringIO("\n".join(l for l in text.splitlines() if not l.startswith("#")))))
    return comments, rows


def as_csv(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    return v


@pytest.mark.parametrize("which", ["sample", "toy"])
def test_csv_matches_calendar(which, request):
    client = request.getfixturevalue(which)
    bbox = SAMPLE_BBOX if which == "sample" else TOY_BBOX
    body = {"aoi": bbox}
    months = client.post("/api/calendar", json=body).json()["months"]
    r = client.post("/api/download/monthly.csv", json=body)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    _, rows = read_csv(r.text)
    assert len(rows) == len(months)
    for row, m in zip(rows, months):
        for k, v in m.items():
            if isinstance(v, float):
                assert float(row[k]) == v, (m["month"], k)
            else:
                assert row[k] == as_csv(v), (m["month"], k)
        if m["state"] == "unavailable":
            assert row["value"] == ""   # never 0


def test_csv_header(sample):
    r = sample.post("/api/download/monthly.csv",
                    json={"aoi": SAMPLE_BBOX, "start_month": "2012-01", "end_month": "2012-03"})
    comments, rows = read_csv(r.text)
    assert comments == ["# data_kind: real",
                        "# unit: VIIRS-equivalent detections per satellite",
                        "# aoi_analyzed: min_lat=20.75 max_lat=21.75 min_lon=78.5 max_lon=79.5",
                        "# cell_size_deg: 0.25",
                        "# range: 2012-01 to 2012-03"]
    assert list(rows[0]) == ["month", "value", "state", "anomaly", "anomaly_state", "source",
                             "provisional", "partial", "low_count"]


def test_csv_errors_use_the_envelope(sample):
    r = sample.post("/api/download/monthly.csv", json={"aoi": {**SAMPLE_BBOX, "min_lat": -100}})
    assert r.status_code == 400 and error_code(r) == "INVALID_AOI"


def test_detections_not_available(sample):
    r = sample.post("/api/download/detections.csv", json={"aoi": SAMPLE_BBOX})
    assert r.status_code == 501 and error_code(r) == "NOT_AVAILABLE"
