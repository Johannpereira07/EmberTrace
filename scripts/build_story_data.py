"""Build the small JSON the story page reads (web/public/story.json).

Everything comes from data/cell_month.parquet + data/meta.json + pipeline/config.yaml, so the
story's numbers change whenever the pipeline output changes. Rerun after `make export`:

    python scripts/build_story_data.py
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
# Optional worldwide context layer: FIRMS global 7-day VIIRS file, downloaded by hand into data/raw/global_7d/
# (https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_7d.csv).
WORLD_GLOB = "data/raw/global_7d/*_Global_7d.csv"
WORLD_CELL_DEG = 0.5
RAW_COLUMN = {"TERRA_chained": "terra", "AQUA_calibrated": "aqua", "VIIRS": "viirs"}  # columns of `monthly` below


def main() -> None:
    meta = json.loads((ROOT / "data/meta.json").read_text())
    config = yaml.safe_load((ROOT / "pipeline/config.yaml").read_text())
    calibration = json.loads((ROOT / "data/calibration.json").read_text())
    df = pd.read_parquet(ROOT / "data/cell_month.parquet")

    monthly = df.groupby("month").agg(
        harmonized=("harmonized_count", "sum"),
        terra=("terra_count", "sum"),
        aqua=("aqua_count", "sum"),
        viirs=("viirs_count", "sum"),
        source=("source", "first"),
        observed=("source", lambda s: s.notna().any()),
    )
    unknown = set(monthly["source"].dropna()) - set(RAW_COLUMN)
    if unknown:
        raise SystemExit(f"unknown source values: {sorted(unknown)}")
    if not monthly["observed"].all():
        print(f"warning: {int((~monthly['observed']).sum())} months have no observing satellite; left out of the totals")
        monthly = monthly[monthly["observed"]]

    # "Naive splice": the raw count of whichever sensor the harmonized series uses that month,
    # i.e. what you get by stitching the raw FIRMS records end to end.
    monthly["naive_raw"] = [row[RAW_COLUMN[row["source"]]] for _, row in monthly.iterrows()]
    monthly["year"] = monthly.index.str[:4].astype(int)

    # Overlap-ratio conversion: total VIIRS / total Aqua (and Aqua / Terra) over the fit windows,
    # from the pipeline's calibration.json. It keeps 0 at 0, so it shows the record without the
    # zero-to-positive issue of the log-line fit (AGENTS.md, Known issues). VIIRS months are unchanged.
    a2v = calibration["aqua_to_viirs"]["ratio_y_to_x"]
    t2a = calibration["terra_to_aqua"]["ratio_y_to_x"]
    factor = {"VIIRS": None, "AQUA_calibrated": a2v, "TERRA_chained": t2a * a2v}
    monthly["ratio_converted"] = [
        row["harmonized"] if factor[row["source"]] is None else row[RAW_COLUMN[row["source"]]] * factor[row["source"]]
        for _, row in monthly.iterrows()
    ]
    # Check: Aqua converted the same way, in the months VIIRS also flew.
    monthly["aqua_converted"] = monthly["aqua"] * a2v

    years = []
    for year, g in monthly.groupby("year"):
        years.append(
            {
                "year": int(year),
                "months": int(len(g)),
                "naive_raw": int(g["naive_raw"].sum()),
                "viirs_raw": int(g["viirs"].sum()),
                "harmonized": round(float(g["harmonized"].sum())),
                "ratio_converted": round(float(g["ratio_converted"].sum())),
                "aqua_converted": round(float(g["aqua_converted"].sum())) if (g["source"] == "VIIRS").all() else None,
                "sources": sorted(g["source"].unique().tolist()),
            }
        )

    # Globe points: mean yearly harmonized detections per cell over the full VIIRS years.
    viirs_years = [y["year"] for y in years if y["sources"] == ["VIIRS"] and y["months"] == 12]
    recent = df[df["month"].str[:4].astype(int).isin(viirs_years)]
    per_cell = recent.groupby(["cell_lat", "cell_lon"])["harmonized_count"].sum() / len(viirs_years)
    per_cell = per_cell[per_cell > 0]
    cells = [[round(lat, 3), round(lon, 3), round(float(v), 1)] for (lat, lon), v in per_cell.items()]

    world = build_world_layer(cells, meta["cell_size_deg"])

    out = {
        "generated_from": "data/cell_month.parquet",
        "data_kind": meta["data_kind"],
        "pipeline_version": meta["pipeline_version"],
        "coverage": meta["coverage"],
        "cell_size_deg": meta["cell_size_deg"],
        "conversion": {
            "aqua_to_viirs": a2v,
            "terra_to_aqua": t2a,
            "aqua_to_viirs_window": calibration["aqua_to_viirs"]["window"],
            "terra_to_aqua_window": calibration["terra_to_aqua"]["window"],
        },
        "satellites": {name: {"series": s["series"], "start": s["start"]} for name, s in config["satellites"].items()},
        "years": years,
        "cells_years": [min(viirs_years), max(viirs_years)],
        "cells": cells,
        **({"world": world} if world else {}),
    }
    path = ROOT / "web/public/story.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path.relative_to(ROOT)}: {len(years)} years, {len(cells)} cells, {path.stat().st_size / 1024:.0f} KB")


def build_world_layer(india_cells: list, india_cell_deg: float) -> dict | None:
    """Worldwide detections from the FIRMS 7-day file, counted on a coarse grid. India's own cells are
    left out (the India layer shows them). NRT files have no `type`, so static heat sources are included."""
    files = sorted(ROOT.glob(WORLD_GLOB))
    if not files:
        print(f"note: no file matches {WORLD_GLOB}; story.json has no world layer")
        return None
    w = pd.concat([pd.read_csv(f) for f in files], ignore_index=True)
    n = len(w)
    known = {"l", "n", "h", "low", "nominal", "high"}
    unknown = set(w["confidence"].astype(str).str.lower()) - known
    if unknown:
        raise SystemExit(f"unrecognised confidence codes in the world file: {sorted(unknown)}")
    w = w[~w["confidence"].astype(str).str.lower().isin({"l", "low"})]
    print(f"world layer: {n} detections, dropped {n - len(w)} low-confidence")

    w["glat"] = (w["latitude"] // WORLD_CELL_DEG) * WORLD_CELL_DEG + WORLD_CELL_DEG / 2
    w["glon"] = (w["longitude"] // WORLD_CELL_DEG) * WORLD_CELL_DEG + WORLD_CELL_DEG / 2
    counts = w.groupby(["glat", "glon"]).size()
    india = {
        ((lat - india_cell_deg / 2) // WORLD_CELL_DEG * WORLD_CELL_DEG + WORLD_CELL_DEG / 2,
         (lon - india_cell_deg / 2) // WORLD_CELL_DEG * WORLD_CELL_DEG + WORLD_CELL_DEG / 2)
        for lat, lon, _ in india_cells
    }
    counts = counts[[key not in india for key in counts.index]]
    return {
        "satellites": sorted(w["satellite"].astype(str).unique().tolist()),
        "dates": [str(w["acq_date"].min()), str(w["acq_date"].max())],
        "detections": int(len(w)),
        "cell_size_deg": WORLD_CELL_DEG,
        "cells": [[float(lat), float(lon), int(c)] for (lat, lon), c in counts.items()],
    }


if __name__ == "__main__":
    main()
