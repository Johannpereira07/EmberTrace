"""POST /api/download/monthly.csv (API spec 7.1). Written from the same dict as /api/calendar,
so the rows always match the display. Unavailable months have an empty value, never 0."""
import csv
import io

COLUMNS = ["month", "value", "state", "anomaly", "anomaly_state", "source",
           "provisional", "partial", "low_count"]


def _cell(v):
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)   # floats unrounded (repr precision)


def monthly_csv(cal: dict) -> str:
    meta, box = cal["meta"], cal["meta"]["aoi_analyzed"]
    months = cal["months"]
    out = io.StringIO()
    out.write(f"# data_kind: {meta['data_kind']}\n")
    out.write(f"# unit: {meta['unit']}\n")
    out.write("# aoi_analyzed: " + " ".join(f"{k}={_cell(box[k])}"
              for k in ("min_lat", "max_lat", "min_lon", "max_lon")) + "\n")
    out.write(f"# cell_size_deg: {_cell(meta['cell_size_deg'])}\n")
    out.write(f"# range: {months[0]['month']} to {months[-1]['month']}\n")
    w = csv.writer(out, lineterminator="\n")
    w.writerow(COLUMNS)
    for m in months:
        w.writerow([_cell(m[c]) for c in COLUMNS])
    return out.getvalue()


def filename(cal: dict) -> str:
    b, months = cal["meta"]["aoi_analyzed"], cal["months"]
    area = "_".join(_cell(b[k]) for k in ("min_lat", "max_lat", "min_lon", "max_lon"))
    return f"embertrace_monthly_{area}_{months[0]['month']}_{months[-1]['month']}.csv"
