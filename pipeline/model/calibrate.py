"""Stage 5: fit the Aqua -> VIIRS and Terra -> Aqua conversions, with a hold-out check."""
import numpy as np
import pandas as pd


def fit_log_line(cm, x_col, y_col, window, min_rows=30, min_months=12):
    """log1p-log1p line predicting y from x over months inside `window`."""
    both = cm.dropna(subset=[x_col, y_col])
    both = both[(both["month"] >= pd.Period(window[0], "M")) &
                (both["month"] <= pd.Period(window[1], "M"))]
    both = both[(both[x_col] > 0) | (both[y_col] > 0)]   # ignore empty cells
    if len(both) < min_rows or both["month"].nunique() < min_months:
        return None
    x, y = np.log1p(both[x_col]), np.log1p(both[y_col])
    ok = np.isfinite(x) & np.isfinite(y)
    both, x, y = both[ok], x[ok], y[ok]
    if len(both) < min_rows or x.std() == 0:   # no spread in the input: a line is meaningless
        return None
    slope, intercept = np.polyfit(x, y, 1)
    pred = np.expm1(intercept + slope * x).clip(lower=0)
    # back-transforming a log fit under-estimates totals; rescale to match
    bias = float(both[y_col].sum() / max(pred.sum(), 1e-9))
    return {"slope": float(slope), "intercept": float(intercept), "bias_factor": bias,
            "pearson_r_log": float(np.corrcoef(x, y)[0, 1]),
            "ratio_y_to_x": float(both[y_col].sum() / max(both[x_col].sum(), 1e-9)),
            "n_cell_months": int(len(both)), "n_months": int(both["month"].nunique()),
            "window": list(window)}


def apply_log_line(values, cal):
    return (np.expm1(cal["intercept"] + cal["slope"] * np.log1p(values))
            .clip(lower=0) * cal["bias_factor"])


def holdout_check(cm, x_col, y_col, window, train_fraction=0.7):
    """Fit on the first part of the window, test on the rest (monthly AOI totals)."""
    months = sorted(cm.dropna(subset=[x_col, y_col])["month"].unique())
    months = [m for m in months if pd.Period(window[0], "M") <= m <= pd.Period(window[1], "M")]
    if len(months) < 24:
        return None
    split = int(len(months) * train_fraction)
    cal = fit_log_line(cm, x_col, y_col, (str(months[0]), str(months[split - 1])))
    if cal is None:
        return None
    test = cm[cm["month"].isin(months[split:])].dropna(subset=[x_col, y_col])
    tot = test.assign(pred=apply_log_line(test[x_col], cal)).groupby("month")[[y_col, "pred"]].sum()
    mape = float((abs(tot["pred"] - tot[y_col]) / tot[y_col].replace(0, np.nan)).mean())
    return {"train_months": split, "test_months": len(months) - split,
            "monthly_total_corr": float(tot.corr().iloc[0, 1]),
            "monthly_total_mean_abs_pct_error": mape}
