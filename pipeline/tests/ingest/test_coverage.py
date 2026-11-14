"""ING-8: data_through and provisional_from come from the loaded data."""
import pandas as pd
import pytest

from pipeline.ingest import coverage_info, load


def _rows(sensor, platform, first, last, nrt, conf="nominal"):
    return [{"sensor": sensor, "platform": platform, "date": d, "is_nrt": nrt, "conf_class": conf}
            for d in pd.date_range(first, last)]


def _like_real_data():
    # layout of our real files (docs/07): VIIRS archive to 07-31 and NRT 08-01..11-13;
    # MODIS archive to 08-31 and NRT from 09-01
    return pd.DataFrame(
        _rows("VIIRS", "NOAA-20", "2026-06-01", "2026-07-31", False)
        + _rows("VIIRS", "NOAA-20", "2026-08-01", "2026-11-13", True)
        + _rows("VIIRS", "SNPP", "2026-08-01", "2026-11-02", True)
        + _rows("MODIS", "Aqua", "2026-06-01", "2026-08-31", False)
        + _rows("MODIS", "Aqua", "2026-09-01", "2026-11-13", True))


def test_dates_from_viirs_like_real_data():
    info = coverage_info(_like_real_data(), 0.25)
    assert info["data_through"] == "2026-11-13"
    assert info["provisional_from"] == "2026-08"
    assert info["cell_size_deg"] == 0.25
    assert info["by_series"]["Aqua"]["first_nrt_month"] == "2026-09"
    assert info["by_series"]["VIIRS"]["archive_last_day"] == "2026-07-31"
    assert info["by_series"]["Terra"] is None


def test_low_confidence_rows_still_count_for_data_through():
    u = _like_real_data()
    u = pd.concat([u, pd.DataFrame(_rows("VIIRS", "NOAA-21", "2026-11-14", "2026-11-14", True, conf="low"))])
    assert coverage_info(u, 0.25)["data_through"] == "2026-11-14"


def test_no_nrt_gives_null_provisional_from_and_warns(capsys):
    u = pd.DataFrame(_rows("VIIRS", "SNPP", "2020-01-01", "2020-03-31", False))
    assert coverage_info(u, 0.25)["provisional_from"] is None
    assert "provisional_from is null" in capsys.readouterr().out


def test_archive_overlapping_nrt_warns(capsys):
    u = pd.concat([_like_real_data(), pd.DataFrame(_rows("VIIRS", "SNPP", "2026-08-10", "2026-08-10", False))])
    coverage_info(u, 0.25)
    assert "Archive and NRT overlap" in capsys.readouterr().out


def test_no_viirs_fails_loudly():
    u = pd.DataFrame(_rows("MODIS", "Terra", "2001-01-01", "2001-01-31", False))
    with pytest.raises(ValueError, match="no VIIRS detections"):
        coverage_info(u, 0.25)


def test_is_nrt_read_from_version(tmp_path):
    f = tmp_path / "viirs_nrt.csv"
    pd.DataFrame({"latitude": 21.1, "longitude": 78.6, "brightness": 330.0, "scan": 0.4, "track": 0.4,
                  "acq_date": ["2026-07-31", "2026-08-01"], "acq_time": "0800", "satellite": "N20",
                  "confidence": "n", "version": ["2", "2.0NRT"], "bright_t31": 290.0,
                  "frp": 3.0, "daynight": "D"}).to_csv(f, index=False)
    assert load(f)["is_nrt"].tolist() == [False, True]
