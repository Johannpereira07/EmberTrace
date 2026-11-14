"""ING-6: outage days are removed from the observed days, so an outage never reads as zero fires."""
import numpy as np
import pandas as pd
import pytest

from pipeline.ingest import (aggregate, find_outages, outage_days_by_month, platform_weight,
                             read_firms_table, restrict_to_loaded_data, satellites)

D = pd.Timestamp


def test_firms_table_parses_real_doc():
    listed = read_firms_table(satellites.OUTAGE_TABLE)
    assert ("Terra", D("2001-06-16")) in listed and ("Terra", D("2001-07-02")) in listed
    assert ("SNPP", D("2026-05-10")) in listed        # "2026-05-30 to 2026-04-28": newest-first range
    assert ("NOAA-20", D("2024-02-04")) in listed
    assert ("NOAA-21", D("2024-03-01")) not in listed  # NRT section is not used


def _counts(values, start="2020-01-01"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values)))


def test_outage_rule():
    busy = [100] * 40
    busy[10] = 0      # unlisted, neighbours busy  -> outage
    busy[20] = 0      # listed                     -> outage
    busy[30] = 55     # listed but has detections  -> observed
    quiet = [2] * 40
    quiet[10] = 0     # unlisted, neighbours quiet -> natural zero, observed
    quiet[20] = 0     # listed                     -> outage
    counts = {"SNPP": _counts(busy), "Terra": _counts(quiet)}
    listed = {("SNPP", D("2020-01-21")), ("SNPP", D("2020-01-31")), ("Terra", D("2020-01-21"))}
    got = find_outages(counts, listed, min_neighbour_median=20, window_days=31)
    assert set(zip(got["platform"], got["date"], got["reason"])) == {
        ("SNPP", D("2020-01-11"), "unlisted_zero"),
        ("SNPP", D("2020-01-21"), "listed"),
        ("Terra", D("2020-01-21"), "listed"),
    }


def test_outage_days_lower_the_weight():
    june = pd.Period("2001-06", "M")
    no_outage = platform_weight("Terra", june)
    half = platform_weight("Terra", june, {"Terra": {june: 15}})
    assert no_outage == pytest.approx(1.0)
    assert half == pytest.approx(0.5, abs=1e-6)
    with pytest.raises(ValueError, match="more outage days"):
        platform_weight("Terra", june, {"Terra": {june: 31}})


def _terra_aqua(first="2002-05-01", last="2002-08-31", per_day=10, skip=()):
    rows = []
    for platform, start in (("Terra", first), ("Aqua", "2002-07-04")):
        for day in pd.date_range(start, last):
            if day in skip:
                continue
            rows += [{"sensor": "MODIS", "platform": platform, "lat": 21.1, "lon": 78.6, "date": day,
                      "frp": 1.0, "conf_class": "nominal", "type": 0}] * per_day
    # a second, quiet cell with one detection in May, so it exists in the table
    rows.append({"sensor": "MODIS", "platform": "Terra", "lat": 25.1, "lon": 80.1, "date": D(first),
                 "frp": 1.0, "conf_class": "nominal", "type": 0})
    return pd.DataFrame(rows)


def test_nan_when_not_flying_zero_when_quiet():
    u = _terra_aqua()
    restrict_to_loaded_data(u)
    cm = aggregate(u, 0.25).set_index(["month", "cell_lat"])
    busy, quiet = 21.125, 25.125
    assert np.isnan(cm.loc[(pd.Period("2002-06", "M"), busy), "aqua_count_norm"])   # Aqua not flying yet
    assert cm.loc[(pd.Period("2002-08", "M"), quiet), "aqua_count_norm"] == 0         # flying, no fires
    assert cm.loc[(pd.Period("2002-08", "M"), quiet), "terra_count_norm"] == 0


def test_outage_days_keep_the_per_day_rate():
    # Terra loses 2002-06-10..19 (no detections); with those days removed the rate stays 10/day
    gap = set(pd.date_range("2002-06-10", "2002-06-19"))
    u = _terra_aqua(skip=gap)
    restrict_to_loaded_data(u)
    outages = pd.DataFrame({"platform": "Terra", "date": sorted(gap), "reason": "listed", "neighbour_median": 10})
    june = pd.Period("2002-06", "M")
    without = aggregate(u, 0.25).set_index(["month", "cell_lat"]).loc[(june, 21.125), "terra_count_norm"]
    with_out = aggregate(u, 0.25, outage_days_by_month(outages)).set_index(["month", "cell_lat"]).loc[
        (june, 21.125), "terra_count_norm"]
    # values are full-month equivalents (count / satellites observing), so divide by June's 30 days
    assert without / 30 == pytest.approx(10 * 20 / 30)    # outage read as zero fires: rate too low
    assert with_out / 30 == pytest.approx(10, rel=1e-6)   # outage removed: rate correct


def test_month_fully_out_is_unavailable():
    may = pd.Period("2002-05", "M")
    gap = list(pd.date_range("2002-05-01", "2002-05-31"))
    u = _terra_aqua(first="2002-04-01", skip=set(gap))
    restrict_to_loaded_data(u)
    outages = pd.DataFrame({"platform": "Terra", "date": gap, "reason": "listed", "neighbour_median": 10})
    cm = aggregate(u, 0.25, outage_days_by_month(outages)).set_index(["month", "cell_lat"])
    assert np.isnan(cm.loc[(may, 21.125), "terra_count_norm"])   # NaN, not 0


def test_warns_when_data_starts_after_mission_start(capsys):
    u = _terra_aqua()   # Aqua data from 2002-07-04 = mission start: no warning for Aqua
    u = u[~((u["platform"] == "Aqua") & (u["date"] < D("2002-08-01")))]
    restrict_to_loaded_data(u)
    out = capsys.readouterr().out
    assert "WARNING Aqua: loaded data starts 2002-08-01" in out
