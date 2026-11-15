"""Stage 5: fit the Aqua -> VIIRS and Terra -> Aqua conversions, with a hold-out check.

Two fit forms are available (select via `method`):

  * Default "ratio_of_totals" (Option C): one multiplicative factor per pair
    from the overlap window, factor = sum(y) / sum(x). No intercept, no log
    transform. A raw 0 stays exactly 0 (0 * factor = 0). NaN stays NaN.
  * "intercept" (Option B): log1p(y) = slope * log1p(x) + intercept, with
    apply_log_line pinning exactly-0 inputs to exactly-0 output. The bias
    factor is a ratio-of-totals multiplicative rescaling on the overlap window.

Both forms keep NaN as NaN (never confused with 0).
"""
import numpy as np
import pandas as pd


def _prep(cm, x_col, y_col, window, min_rows=30, min_months=12):
    """Common filtering for all fit forms. Returns both_df in original space."""
    both = cm.dropna(subset=[x_col, y_col]).copy()
    # month may be Period (in-memory) or str (read back from CSV)
    if both["month"].dtype == object:
        both["month"] = pd.PeriodIndex(both["month"], freq="M")
    both = both[(both["month"] >= pd.Period(window[0], "M")) &
                (both["month"] <= pd.Period(window[1], "M"))]
    both = both[(both[x_col] > 0) | (both[y_col] > 0)]   # ignore fully-empty cells
    if len(both) < min_rows or both["month"].nunique() < min_months:
        return None
    return both


def fit_ratio_totals(cm, x_col, y_col, window, min_rows=30, min_months=12):
    """Option C: pure ratio-of-totals. factor = sum(y) / sum(x) over overlap window."""
    both = _prep(cm, x_col, y_col, window, min_rows, min_months)
    if both is None:
        return None
    x_sum = float(both[x_col].sum())
    y_sum = float(both[y_col].sum())
    factor = y_sum / max(x_sum, 1e-9)
    corr = float(np.corrcoef(both[x_col], both[y_col])[0, 1]) if len(both) > 1 else float("nan")
    return {
        "method": "ratio_of_totals",
        "factor": factor, "slope": None, "intercept": None,
        "pearson_r": corr, "ratio_y_to_x": y_sum / max(x_sum, 1e-9),
        "n_cell_months": int(len(both)), "n_months": int(both["month"].nunique()),
        "window": list(window),
    }


def fit_log_line(cm, x_col, y_col, window, min_rows=30, min_months=12,
                 method="ratio_of_totals"):
    """Fit a conversion from x to y over months inside `window`.

    method="ratio_of_totals" (Option C, default): factor = sum(y) / sum(x),
    no intercept, no log transform. Zero stays zero.
    method="intercept" (Option B): log1p(y) = slope * log1p(x) + intercept,
    then apply_log_line pins exactly-0 inputs to exactly-0 output.
    Returns a dict with fit parameters; None if not enough data.
    """
    if method == "ratio_of_totals":
        return fit_ratio_totals(cm, x_col, y_col, window, min_rows, min_months)

    # method == "intercept": full log1p line with intercept (Option B).
    both = _prep(cm, x_col, y_col, window, min_rows, min_months)
    if both is None:
        return None
    x = np.log1p(both[x_col].to_numpy(dtype=float))
    y = np.log1p(both[y_col].to_numpy(dtype=float))
    ok = np.isfinite(x) & np.isfinite(y)
    both, x, y = both[ok], x[ok], y[ok]
    if len(both) < min_rows or x.std() == 0:
        return None
    slope, intercept = np.polyfit(x, y, 1)
    x_vals = both[x_col].to_numpy(dtype=float)
    y_vals = both[y_col].to_numpy(dtype=float)
    pred_raw = np.maximum(np.expm1(intercept + slope * x), 0)
    pred_raw = np.where(x_vals == 0, 0.0, pred_raw)
    bias = float(y_vals.sum() / max(pred_raw.sum(), 1e-9))
    return {
        "method": "intercept",
        "slope": float(slope), "intercept": float(intercept), "bias_factor": bias,
        "pearson_r_log": float(np.corrcoef(x, y)[0, 1]),
        "ratio_y_to_x": float(y_vals.sum() / max(x_vals.sum(), 1e-9)),
        "n_cell_months": int(len(both)), "n_months": int(both["month"].nunique()),
        "window": list(window),
    }


def apply_ratio(values, cal):
    """Option C application: y = x * factor. Zero stays zero, NaN stays NaN."""
    is_series = isinstance(values, pd.Series)
    v = np.asarray(values, dtype=float)
    factor = cal["factor"]
    result = v * factor
    result = np.where(v == 0, 0.0, result)
    result = np.where(np.isnan(v), np.nan, result)
    if is_series:
        result = pd.Series(result, index=values.index, name=values.name)
    return result


def apply_log_line(values, cal):
    """Apply a calibration.

    Dispatches based on cal["method"]:
    - "ratio_of_totals" (Option C): y = x * factor
    - "intercept" (Option B): expm1(intercept + slope * log1p(v)) * bias_factor
    - No "method" key (backward compat): Option B behaviour.

    A raw 0 stays exactly 0; NaN stays NaN. Preserves pandas Series input type.
    """
    method = cal.get("method")
    if method == "ratio_of_totals" or method is None and "factor" in cal and "slope" not in cal:
        return apply_ratio(values, cal)

    # Option B: expm1(intercept + slope * log1p(v)) * bias_factor
    is_series = isinstance(values, pd.Series)
    v = np.asarray(values, dtype=float)
    pred = np.maximum(np.expm1(cal["intercept"] + cal["slope"] * np.log1p(v)), 0)
    pred = np.where(v == 0, 0.0, pred)   # pin: zero input -> zero output
    result = pred * cal["bias_factor"]
    if is_series:
        result = pd.Series(result, index=values.index, name=values.name)
    return result


def holdout_check(cm, x_col, y_col, window, train_fraction=0.7,
                  apply_fn=apply_log_line, method="ratio_of_totals"):
    """Fit on the first part of the window, test on the rest (monthly AOI totals).

    `method` selects which fit form to use (passed through to fit_log_line).
    `apply_fn` selects which application form to use.

    MAPE is computed at MONTHLY TOTAL level over months with nonzero actuals
    only (a zero actual makes the percentage undefined, not infinity).
    """
    cm = cm.copy()
    # month may be Period (in-memory) or str (read back from CSV)
    if cm["month"].dtype == object:
        cm["month"] = pd.PeriodIndex(cm["month"], freq="M")
    months = sorted(cm.dropna(subset=[x_col, y_col])["month"].unique())
    months = [m for m in months if pd.Period(window[0], "M") <= m <= pd.Period(window[1], "M")]
    if len(months) < 24:
        return None
    split = int(len(months) * train_fraction)
    cal = fit_log_line(cm, x_col, y_col, (str(months[0]), str(months[split - 1])),
                       method=method)
    if cal is None:
        return None
    test = cm[cm["month"].isin(months[split:])].dropna(subset=[x_col, y_col]).copy()
    test.loc[:, "pred"] = apply_fn(test[x_col], cal)
    tot = test.groupby("month")[[y_col, "pred"]].sum()
    nonzero = tot[tot[y_col] > 0]
    if len(nonzero) == 0:
        mape = float("nan")
    else:
        mape = float((abs(nonzero["pred"] - nonzero[y_col]) / nonzero[y_col]).mean())
    return {
        "train_months": split, "test_months": len(months) - split,
        "method": method,
        "monthly_total_corr": float(tot.corr().iloc[0, 1]) if len(tot) > 1 else float("nan"),
        "monthly_total_mean_abs_pct_error": mape,
        "mape_over_nonzero_actuals": int(len(nonzero)),
    }