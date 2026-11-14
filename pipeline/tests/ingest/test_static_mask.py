"""ING-11: NRT detections at known static sources are dropped; archive rows are untouched."""
import pandas as pd

from pipeline.ingest import (aggregate, build_static_mask, in_static_mask, restrict_to_loaded_data,
                             satellites)

CELL = 0.005


def _row(lat, lon, day, sensor="VIIRS", platform="NOAA-20", type_=0, nrt=False, conf="nominal"):
    return {"sensor": sensor, "platform": platform, "lat": lat, "lon": lon, "date": pd.Timestamp(day),
            "frp": 1.0, "conf_class": conf, "type": type_, "is_nrt": nrt}


def _factory(hits, lat=22.7001, lon=86.2001, sensor="VIIRS", platform="NOAA-20"):
    """`hits` archive detections of type 2 (static land source) at one place."""
    return [_row(lat, lon, f"2026-0{1 + k % 6}-1{k % 9}", sensor, platform, type_=2) for k in range(hits)]


def test_config_values():
    assert satellites.NRT_MASK == {"cell_deg": 0.005, "min_hits": 5, "dilate": 0}


def test_min_hits_and_sensors():
    u = pd.DataFrame(_factory(5) + _factory(4, lat=23.5001)
                     + _factory(5, lat=24.5001, sensor="MODIS", platform="Aqua"))
    mask = build_static_mask(u, CELL, min_hits=5)
    probe = pd.DataFrame([_row(22.7012, 86.2033, "2026-09-01", nrt=True),        # same 0.005 square: masked
                          _row(23.5002, 86.2002, "2026-09-01", nrt=True),        # only 4 hits: not masked
                          _row(24.5002, 86.2002, "2026-09-01", nrt=True),        # MODIS source, VIIRS row: no
                          _row(24.5002, 86.2002, "2026-09-01", "MODIS", "Aqua", nrt=True)])  # MODIS row: yes
    assert in_static_mask(probe, mask, CELL).tolist() == [True, False, False, True]


def test_neighbour_square_only_with_dilate():
    u = pd.DataFrame(_factory(5))
    probe = pd.DataFrame([_row(22.7051, 86.2001, "2026-09-01", nrt=True)])       # next square north
    assert not in_static_mask(probe, build_static_mask(u, CELL, 5, dilate=0), CELL).iloc[0]
    assert in_static_mask(probe, build_static_mask(u, CELL, 5, dilate=1), CELL).iloc[0]


def test_mask_ignores_nrt_rows_and_respects_before():
    nrt_static = [dict(r, is_nrt=True) for r in _factory(5)]   # NRT rows carry type 0 anyway; never a source
    assert len(build_static_mask(pd.DataFrame(nrt_static), CELL, 5).get("VIIRS", [])) == 0
    u = pd.DataFrame(_factory(5))
    assert len(build_static_mask(u, CELL, 5, before=pd.Timestamp("2026-01-01")).get("VIIRS", [])) == 0


def test_aggregate_drops_only_nrt_rows_in_mask():
    # factory at 22.7, a farm fire elsewhere; archive Jul (type 0 at the factory square too), NRT Aug
    rows = _factory(5)
    rows += [_row(22.7003, 86.2003, f"2026-07-{d:02d}") for d in range(1, 32)]           # archive veg, factory square
    rows += [_row(22.7003, 86.2003, f"2026-08-{d:02d}", nrt=True) for d in range(1, 32)] # NRT, factory square
    rows += [_row(21.1, 78.6, f"2026-08-{d:02d}", nrt=True) for d in range(1, 32)]        # NRT, farm
    u = pd.DataFrame(rows)
    restrict_to_loaded_data(u)
    mask = build_static_mask(u, CELL, 5)
    exclude = u["is_nrt"] & in_static_mask(u, mask, CELL)
    cm = aggregate(u, 0.25, exclude=exclude).set_index(["month", "cell_lat"])
    jul, aug = pd.Period("2026-07", "M"), pd.Period("2026-08", "M")
    assert cm.loc[(jul, 22.625), "viirs_count"] == 31   # archive type 0 kept (mask is NRT-only)
    assert cm.loc[(aug, 22.625), "viirs_count"] == 0    # NRT at the factory dropped
    assert cm.loc[(aug, 21.125), "viirs_count"] == 31   # NRT farm fire kept
