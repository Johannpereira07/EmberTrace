"""ING-2: satellite dates and thresholds come from config.yaml, and the dates are right."""
import numpy as np
import pandas as pd
import pytest

from pipeline.ingest import aggregate, load, platform_weight, restrict_to_loaded_data, satellites


def test_config_dates_match_verified_constants():
    assert satellites.START == {"Terra": "2000-11-01", "Aqua": "2002-07-04", "SNPP": "2012-01-20",
                                "NOAA-20": "2018-04-01", "NOAA-21": "2023-03-01"}
    assert satellites.END == {"SNPP": "2026-11-02 13:00"}   # no Terra / Aqua end (sources conflict)
    assert satellites.SERIES == {"Terra": ["Terra"], "Aqua": ["Aqua"],
                                 "VIIRS": ["SNPP", "NOAA-20", "NOAA-21"]}
    assert satellites.CELL_SIZE_DEG == 0.25


def _viirs_detections(platforms_from, last_day, per_day=10):
    """One cell, `per_day` VIIRS detections per satellite per day while it flies."""
    rows = []
    for platform, first_day in platforms_from.items():
        for day in pd.date_range(first_day, last_day):
            rows += [{"sensor": "VIIRS", "platform": platform, "lat": 21.1, "lon": 78.6,
                      "date": day, "frp": 1.0, "conf_class": "nominal", "type": 0}] * per_day
    return pd.DataFrame(rows)


def _per_day_viirs(u):
    restrict_to_loaded_data(u)
    cm = aggregate(u, 0.25).set_index("month")
    return cm["viirs_count_norm"] / cm.index.days_in_month   # detections per satellite per day


def test_no_step_when_noaa21_joins():
    # same fire rate per satellite every day; NOAA-21 data starts 2023-03-01, as in the real archive
    u = _viirs_detections({"SNPP": "2023-01-01", "NOAA-20": "2023-01-01", "NOAA-21": "2023-03-01"}, "2023-05-31")
    per_day = _per_day_viirs(u)
    assert np.allclose(per_day.values, 10.0), per_day.to_dict()


def test_superseded_noaa21_date_would_create_a_step():
    # shows the test above can catch a wrong date: with 2024-01-17, March 2023 counts 3 satellites' fires
    # but divides by 2, a 1.5x jump
    satellites.START["NOAA-21"] = "2024-01-17"
    u = _viirs_detections({"SNPP": "2023-01-01", "NOAA-20": "2023-01-01", "NOAA-21": "2023-03-01"}, "2023-05-31")
    per_day = _per_day_viirs(u)
    assert per_day[pd.Period("2023-02", "M")] == pytest.approx(10.0)
    assert per_day[pd.Period("2023-03", "M")] == pytest.approx(15.0)


def test_snpp_end_counts_until_1300_utc():
    nov = pd.Period("2026-11", "M")
    month = nov.end_time - nov.start_time
    snpp = (pd.Timestamp("2026-11-02 13:00") - nov.start_time) / month   # 1 day 13 h of S-NPP
    assert platform_weight("VIIRS", nov) == pytest.approx(2 + snpp)       # + NOAA-20 + NOAA-21


def test_modis_confidence_thresholds_from_config(tmp_path):
    f = tmp_path / "modis.csv"
    pd.DataFrame({"latitude": 21.1, "longitude": 78.6, "brightness": 320.0, "scan": 1.0, "track": 1.0,
                  "acq_date": "2010-01-01", "acq_time": "0510", "satellite": "Aqua",
                  "confidence": ["29", "30", "79", "80"], "version": "6.03", "bright_t31": 290.0,
                  "frp": 5.0, "daynight": "D", "type": 0}).to_csv(f, index=False)
    assert load(f)["conf_class"].tolist() == ["low", "nominal", "nominal", "high"]


@pytest.mark.parametrize("bad, message", [
    ("satellites:\n  Terra: {series: Terra, start: '2000-11-01', end: '1999-01-01'}\n", "ends before it starts"),
    ("satellites:\n  Terra: {series: MODIS, start: '2000-11-01'}\n", "has series"),
    ("satellites:\n  Terra: {series: Terra}\n", "no start date"),
])
def test_bad_config_fails_loudly(tmp_path, bad, message):
    f = tmp_path / "config.yaml"
    f.write_text(bad)
    with pytest.raises(ValueError, match=message):
        satellites.load_config(f)
