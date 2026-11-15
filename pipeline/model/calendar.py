"""Stage 7: year x month calendar and anomaly (ratio to the calendar-month median)."""
import pandas as pd


def calendar(cm):
    s = cm.groupby("month")["harmonized_count"].sum(min_count=1).dropna()
    months = s.index
    if not isinstance(months.dtype, pd.PeriodDtype):
        months = pd.PeriodIndex(months, freq="M")
    cal = pd.DataFrame({"year": months.year, "m": months.month, "v": s.values})
    mat = cal.pivot(index="year", columns="m", values="v").round(1)
    med = mat.median(axis=0)
    # Zero median -> not_defined (blank), never inf/NaN (AGENTS.md invariant).
    med = med.replace(0, float("nan"))
    anom = (mat.div(med, axis=1)).round(2)
    return mat, anom
