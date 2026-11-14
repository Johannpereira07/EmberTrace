"""Stage 7: year x month calendar and anomaly (ratio to the calendar-month median)."""
import pandas as pd


def calendar(cm):
    s = cm.groupby("month")["harmonized_count"].sum(min_count=1).dropna()
    cal = pd.DataFrame({"year": s.index.year, "m": s.index.month, "v": s.values})
    mat = cal.pivot(index="year", columns="m", values="v").round(1)
    return mat, (mat / mat.median(axis=0)).round(2)
