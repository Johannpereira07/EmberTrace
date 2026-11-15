"""Stage 5: fit the Aqua -> VIIRS and Terra -> Aqua conversions, with a hold-out check.

Three fit forms are available (select via `method`):

  * Default "monthly_ratio" (Calendar-month factors, Jun-Sep pooled): fits one
    multiplicative ratio-of-totals factor per calendar month on the overlap window,
    pooling monsoon months June-September (6, 7, 8, 9) into one shared factor.
    A raw 0 stays exactly 0 (0 * factor = 0). NaN stays NaN.
  * "ratio_of_totals" (Option C, single factor): one multiplicative factor per pair
    from the overlap window, factor = sum(y) / sum(x). Zero stays zero. NaN stays NaN.
  * "intercept" (Option B): log1p(y) = slope * log1p(x) + intercept, with
    apply_log_line pinning exactly-0 inputs to exactly-0 output.

All forms keep NaN as NaN (never confused with 0).
"""
import numpy as np
import pandas as pd

POOLED_MONSOON = (6, 7, 8, 9)


def _month_numbers(months):
    """Extract integer calendar month (1..12) from a Series/Index/array of Period or YYYY-MM str."""
    if isinstance(months, pd.Series):
        if isinstance(months.dtype, pd.PeriodDtype):
            return months.dt.month.to_numpy()
        s = months.astype(str)
        return s.str.slice(5, 7).astype(int).to_numpy()
    if isinstance(months, pd.PeriodIndex):
        return months.month.to_numpy()
    arr = pd.Series(months).astype(str)
    return arr.str.slice(5, 7).astype(int).to_numpy()


def _prep(cm, x_col, y_col, window, min_rows=30, min_months=12):
    """Common filtering for all fit forms. Returns both_df in original space."""
    both = cm.dropna(subset=[x_col, y_col]).copy()
    # month may be Period (in-memory) or str (read back from CSV)
    if not isinstance(both["month"].dtype, pd.PeriodDtype):
        both["month"] = pd.PeriodIndex(both["month"], freq="M")
    both = both[(both["month"] >= pd.Period(window[0], "M")) &
                (both["month"] <= pd.Period(window[1], "M"))]
    both = both[(both[x_col] > 0) | (both[y_col] > 0)]   # ignore fully-empty cells
    if len(both) < min_rows or both["month"].nunique() < min_months:
        return None
    return both


def fit_ratio_totals(cm, x_col, y_col, window, min_rows=30, min_months=12):
    """Option C (single factor): pure ratio-of-totals. factor = sum(y) / sum(x) over overlap window."""
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


def fit_monthly_ratio(cm, x_col, y_col, window, min_rows=30, min_months=12,
                      pooled_months=POOLED_MONSOON):
    """Calendar-month ratio-of-totals, with `pooled_months` (Jun-Sep) sharing one factor."""
    both = _prep(cm, x_col, y_col, window, min_rows, min_months)
    if both is None:
        return None
    x_sum = float(both[x_col].sum())
    y_sum = float(both[y_col].sum())
    global_factor = y_sum / max(x_sum, 1e-9)
    corr = float(np.corrcoef(both[x_col], both[y_col])[0, 1]) if len(both) > 1 else float("nan")

    cal_m = both["month"].dt.month
    pool_set = set(pooled_months)
    bucket = np.where(cal_m.isin(pool_set), min(pool_set), cal_m)
    grouped = both.assign(_bucket=bucket).groupby("_bucket")[[x_col, y_col]].sum()

    bucket_factors = {}
    for b, row in grouped.iterrows():
        bx, by = float(row[x_col]), float(row[y_col])
        bucket_factors[int(b)] = (by / bx) if bx > 0 else global_factor

    pool_key = min(pool_set)
    monthly_factors = {}
    for m in range(1, 13):
        b = pool_key if m in pool_set else m
        monthly_factors[str(m)] = float(bucket_factors.get(b, global_factor))

    return {
        "method": "monthly_ratio",
        "factor": global_factor,
        "monthly_factors": monthly_factors,
        "pooled_months": list(pooled_months),
        "slope": None, "intercept": None,
        "pearson_r": corr, "ratio_y_to_x": global_factor,
        "n_cell_months": int(len(both)), "n_months": int(both["month"].nunique()),
        "window": list(window),
    }


def fit_log_line(cm, x_col, y_col, window, min_rows=30, min_months=12,
                 method="monthly_ratio"):
    """Fit a conversion from x to y over months inside `window`.

    method="monthly_ratio" (default): one factor per calendar month (Jun-Sep pooled),
      zero stays zero, NaN stays NaN.
    method="ratio_of_totals" (Option C): single factor = sum(y) / sum(x).
    method="intercept" (Option B): log1p(y) = slope * log1p(x) + intercept,
      then apply_log_line pins exactly-0 inputs to exactly-0 output.
    Returns a dict with fit parameters; None if not enough data.
    """
    if method == "monthly_ratio":
        return fit_monthly_ratio(cm, x_col, y_col, window, min_rows, min_months)
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


def apply_ratio(values, cal, months=None):
    """Apply single or calendar-month multiplicative factor. Zero stays zero, NaN stays NaN."""
    is_series = isinstance(values, pd.Series)
    v = np.asarray(values, dtype=float)
    mf = cal.get("monthly_factors")
    if cal.get("method") == "monthly_ratio" and mf and months is not None:
        m_nums = _month_numbers(months)
        default_f = float(cal["factor"])
        factors = np.array([float(mf.get(str(int(m)), mf.get(int(m), default_f))) for m in m_nums], dtype=float)
        result = v * factors
    else:
        factor = float(cal["factor"])
        result = v * factor
    result = np.where(v == 0, 0.0, result)
    result = np.where(np.isnan(v), np.nan, result)
    if is_series:
        result = pd.Series(result, index=values.index, name=values.name)
    return result


def apply_log_line(values, cal, months=None):
    """Apply a calibration.

    Dispatches based on cal["method"]:
    - "monthly_ratio": y = x * monthly_factors[month] (falls back to cal["factor"] if months is None)
    - "ratio_of_totals" (Option C): y = x * factor
    - "intercept" (Option B) or legacy dict: expm1(intercept + slope * log1p(v)) * bias_factor

    A raw 0 stays exactly 0; NaN stays NaN. Preserves pandas Series input type.
    """
    method = cal.get("method")
    if method in ("monthly_ratio", "ratio_of_totals") or (method is None and "factor" in cal and "slope" not in cal):
        return apply_ratio(values, cal, months=months)

    # Option B: expm1(intercept + slope * log1p(v)) * bias_factor
    is_series = isinstance(values, pd.Series)
    v = np.asarray(values, dtype=float)
    pred = np.maximum(np.expm1(cal["intercept"] + cal["slope"] * np.log1p(v)), 0)
    pred = np.where(v == 0, 0.0, pred)   # pin: zero input -> zero output
    result = pred * cal["bias_factor"]
    if is_series:
        result = pd.Series(result, index=values.index, name=values.name)
    return result


def _call_apply(apply_fn, values, cal, months):
    """Call apply_fn with `months` if supported, else fallback to 2-arg call."""
    try:
        return apply_fn(values, cal, months=months)
    except TypeError:
        return apply_fn(values, cal)


def holdout_check(cm, x_col, y_col, window, train_fraction=0.7,
                  apply_fn=apply_log_line, method="monthly_ratio"):
    """Fit on the first part of the window, test on the rest (monthly AOI totals)."""
    cm = cm.copy()
    # month may be Period (in-memory) or str (read back from CSV)
    if not isinstance(cm["month"].dtype, pd.PeriodDtype):
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
    test.loc[:, "pred"] = _call_apply(apply_fn, test[x_col], cal, test["month"])
    tot = test.groupby("month")[[y_col, "pred"]].sum()
    nonzero = tot[tot[y_col] > 0]
    if len(nonzero) == 0:
        mape = float("nan")
        med_err = float("nan")
        mean_bias = float("nan")
    else:
        abs_pct = abs(nonzero["pred"] - nonzero[y_col]) / nonzero[y_col]
        mape = float(abs_pct.mean())
        med_err = float(abs_pct.median())
        mean_bias = float((nonzero["pred"] / nonzero[y_col]).mean())
    return {
        "train_months": split, "test_months": len(months) - split,
        "method": method,
        "monthly_total_corr": float(tot.corr().iloc[0, 1]) if len(tot) > 1 else float("nan"),
        "monthly_total_mean_abs_pct_error": mape,
        "monthly_total_median_abs_pct_error": med_err,
        "monthly_total_mean_pred_over_actual": mean_bias,
        "mape_over_nonzero_actuals": int(len(nonzero)),
    }
