"""ING-5: filter (stage 2) and grid + count (stage 3), each on its own."""
import pandas as pd

from pipeline.ingest import filter_detections, grid_counts, restrict_to_loaded_data


def _row(conf="nominal", type_=0, nrt=False, sensor="VIIRS", platform="NOAA-20", lat=21.1, lon=78.6,
         day="2020-03-10"):
    return {"sensor": sensor, "platform": platform, "lat": lat, "lon": lon, "date": pd.Timestamp(day),
            "frp": 2.0, "conf_class": conf, "type": type_, "is_nrt": nrt}


def test_filter_rules_and_report(capsys):
    u = pd.DataFrame([_row(), _row(conf="high"),                      # kept
                      _row(conf=None),                                # unrecognised confidence
                      _row(conf="low"), _row(conf="low", type_=2),    # low confidence (counted once)
                      _row(type_=2), _row(type_=3),                   # not vegetation fire
                      _row(nrt=True),                                 # NRT, type defaults to 0: kept
                      _row(nrt=True),                                 # NRT inside the static mask
                      _row(sensor="MODIS", platform="Aqua", conf="low")])
    exclude = pd.Series([False] * 8 + [True, False])
    kept, report = filter_detections(u, exclude)
    assert len(kept) == 3 and set(kept.index) == {0, 1, 7}
    assert report["VIIRS"] == {"in": 9, "unrecognised confidence": 1, "low confidence": 2,
                               "not vegetation fire (type != 0)": 2, "NRT static source": 1, "kept": 3}
    assert report["MODIS"]["low confidence"] == 1 and report["MODIS"]["kept"] == 0
    out = capsys.readouterr().out
    assert "filter VIIRS: 9 rows; dropped unrecognised confidence 1, low confidence 2" in out   # never silent


def test_every_row_is_accounted_for():
    u = pd.DataFrame([_row(conf=c, type_=t) for c in ("low", "nominal", "high") for t in (0, 1, 2)])
    _, report = filter_detections(u)
    r = report["VIIRS"]
    assert r["in"] == sum(v for k, v in r.items() if k != "in")


def test_grid_fills_empty_months_with_zero_and_uses_cell_centres():
    u = pd.DataFrame([_row(lat=21.1, lon=78.6, day="2020-01-05"), _row(lat=21.1, lon=78.6, day="2020-01-20"),
                      _row(lat=25.3, lon=80.4, day="2020-03-02")])
    restrict_to_loaded_data(u)
    counts, cells, months = grid_counts(u, 0.25)
    assert list(months.astype(str)) == ["2020-01", "2020-02", "2020-03"]       # no gap months
    assert set(map(tuple, cells[["cell_lat", "cell_lon"]].values)) == {(21.125, 78.625), (25.375, 80.375)}
    v = counts["VIIRS"]["count"]
    first = cells.set_index(["cell_lat", "cell_lon"]).loc[(21.125, 78.625), "i"]
    assert v[(pd.Period("2020-01", "M"), first)] == 2
    assert v[(pd.Period("2020-02", "M"), first)] == 0                          # quiet month: 0, not missing
    assert v[(pd.Period("2020-03", "M"), first)] == 0
    assert len(v) == len(months) * len(cells)                                  # every cell x every month
    assert counts["Terra"]["count"].sum() == 0                                 # other series: all 0 rows
    assert counts["VIIRS"]["frp_sum"].sum() == 6.0
