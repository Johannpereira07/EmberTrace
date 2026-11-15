"""CAL-2/CAL-3: calibration and harmonization tests.

Covers: zero stays zero after calibration, NaN vs 0 stay distinct,
calibration recovers a planted synthetic relationship, tiny samples refused.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "science"))

from pipeline.model.calibrate import (  # noqa: E402
    fit_log_line, fit_monthly_ratio, apply_log_line, apply_ratio, holdout_check
)
from pipeline.model.harmonize import harmonize  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _synth_cm(months, base_f=10.0):
    """Two cells, exact relationships: viirs = F, aqua = 0.25*F, terra = 0.20*F.
    Cell 0: always quiet (all zero). Cell 1: fires (varies by month).
    Pre-2012: viirs_count_norm is NaN (VIIRS not yet flying).
    """
    rows = []
    for m in months:
        p = pd.Period(m, "M")
        F = base_f * (1 + 0.5 * np.sin(p.month / 12 * 2 * np.pi))
        for k in range(2):
            f = 0.0 if k == 0 else F
            viirs = f if p >= pd.Period("2012-01", "M") else np.nan
            rows.append({
                "month": m, "cell_lat": 21.125 + k * 0.25, "cell_lon": 78.625,
                "terra_count_norm": f * 0.20, "aqua_count_norm": f * 0.25,
                "viirs_count_norm": viirs,
            })
    cm = pd.DataFrame(rows)
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")
    return cm


A2V_WINDOW = ["2012-01", "2019-12"]
T2A_WINDOW = ["2002-08", "2011-12"]
A2V_MONTHS = [str(m) for m in pd.period_range("2012-01", "2019-12", freq="M")]
T2A_MONTHS = [str(m) for m in pd.period_range("2002-08", "2011-12", freq="M")]

META = {"data_through": "2026-11-13", "provisional_from": "2026-08"}

EXACT = {"aqua_to_viirs": {"slope": 1.0, "intercept": 0.0, "bias_factor": 4.0},
         "terra_to_aqua": {"slope": 1.0, "intercept": 0.0, "bias_factor": 1.25}}


# ---------------------------------------------------------------------------
# 1. Zero stays zero after calibration
# ---------------------------------------------------------------------------

def test_apply_log_line_zero_stays_exactly_zero():
    cal = {"slope": 1.5, "intercept": 0.7, "bias_factor": 3.0}
    out = apply_log_line(np.array([0.0, 1.0, 10.0]), cal)
    assert out[0] == 0.0, f"zero input gave {out[0]}, expected exactly 0.0"
    assert out[1] > 0 and out[2] > out[1]


def test_apply_log_line_nan_stays_nan():
    cal = {"slope": 1.5, "intercept": 0.7, "bias_factor": 3.0}
    out = apply_log_line(np.array([np.nan, 1.0]), cal)
    assert np.isnan(out[0]), "NaN input should stay NaN"
    assert out[1] > 0


def test_apply_log_line_preserves_series():
    cal = {"slope": 1.0, "intercept": 0.0, "bias_factor": 1.0}
    s = pd.Series([0.0, 1.0, np.nan], index=["a", "b", "c"], name="vals")
    out = apply_log_line(s, cal)
    assert isinstance(out, pd.Series)
    assert out.index.equals(s.index)
    assert out.name == s.name
    assert out["a"] == 0.0
    assert np.isnan(out["c"])


# ---------------------------------------------------------------------------
# 2. fit_log_line through_origin makes 0 -> 0
# ---------------------------------------------------------------------------

def test_fit_log_line_through_origin_zero_predicts_zero():
    cm = _synth_cm(A2V_MONTHS)
    cal = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", A2V_WINDOW,
                       method="ratio_of_totals")
    assert cal is not None
    assert cal["method"] == "ratio_of_totals", "ratio_of_totals should have no intercept"
    assert cal["intercept"] is None, "ratio_of_totals should have intercept None"
    out = apply_log_line(np.array([0.0, 5.0]), cal)
    assert out[0] == 0.0, "ratio_of_totals: zero input must give zero output"


# ---------------------------------------------------------------------------
# 3. Tiny sample refused
# ---------------------------------------------------------------------------

def test_fit_log_line_refuses_tiny_sample():
    few = [str(m) for m in pd.period_range("2012-01", "2012-02", freq="M")]
    cm = _synth_cm(few)
    cal = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", ["2012-01", "2012-02"])
    assert cal is None, "should refuse a window with too few months"


def test_fit_log_line_refuses_too_few_rows():
    # 2 cells x 10 months = 20 cell-months, below min_rows=30
    few_months = [str(m) for m in pd.period_range("2012-01", "2012-10", freq="M")]
    rows = []
    for m in few_months:
        for k in range(2):
            rows.append({"month": m, "cell_lat": 21.125 + k * 0.25, "cell_lon": 78.625,
                         "terra_count_norm": 2.0, "aqua_count_norm": 5.0,
                         "viirs_count_norm": 20.0})
    cm = pd.DataFrame(rows)
    cal = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", ["2012-01", "2012-10"])
    assert cal is None, "should refuse too few cell-months (20 < min_rows=30)"


# ---------------------------------------------------------------------------
# 4. Calibration recovers the planted synthetic relationship
# ---------------------------------------------------------------------------

def test_calibration_recovers_planted_ratio():
    """Synthetic data: viirs = 4 * aqua exactly. Through-origin fit should
    recover a relationship where applying it to aqua tracks viirs closely."""
    cm = _synth_cm(A2V_MONTHS)
    cal = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", A2V_WINDOW,
                       method="ratio_of_totals")
    assert cal is not None
    aligned = cm.dropna(subset=["aqua_count_norm", "viirs_count_norm"])
    pred = apply_log_line(aligned["aqua_count_norm"], cal)
    actual = aligned["viirs_count_norm"]
    zero_mask = aligned["aqua_count_norm"] == 0
    assert (pred[zero_mask] == 0.0).all(), "zero aqua cells must predict zero viirs"
    # Nonzero cells: predictions should track actuals (high correlation)
    nz_pred = pred[~zero_mask]
    nz_actual = actual[~zero_mask]
    corr = float(np.corrcoef(nz_pred, nz_actual)[0, 1])
    assert corr > 0.9, f"prediction-actual correlation {corr:.3f} should be high"


# ---------------------------------------------------------------------------
# 5. Hold-out MAPE excludes zero actuals
# ---------------------------------------------------------------------------

def test_holdout_mape_excludes_zero_actuals():
    cm = _synth_cm(A2V_MONTHS)
    test_months = A2V_MONTHS[int(len(A2V_MONTHS) * 0.7):]
    cm.loc[cm["month"].isin(test_months), "viirs_count_norm"] = 0.0
    result = holdout_check(cm, "aqua_count_norm", "viirs_count_norm", A2V_WINDOW,
                           train_fraction=0.7)
    assert result is not None
    assert result["mape_over_nonzero_actuals"] == 0
    assert np.isnan(result["monthly_total_mean_abs_pct_error"]), \
        "MAPE should be NaN with no nonzero actuals"


# ---------------------------------------------------------------------------
# 6. Zero vs NaN stay distinct in harmonized output
# ---------------------------------------------------------------------------

def test_harmonize_zero_vs_nan_distinct():
    """Quiet observed cell (0 counts) -> harmonized 0 with source label.
    Unobserved cell (all-NaN inputs) -> harmonized NaN with source 'none'.
    Uses mock cal dicts; month 2003-01 has Aqua but no VIIRS."""
    rows = []
    for k, lat in enumerate((21.125, 21.375)):
        rows.append({"month": "2003-01", "cell_lat": lat, "cell_lon": 78.625,
                     "terra_count_norm": 0.0 if k == 0 else np.nan,
                     "aqua_count_norm": 0.0 if k == 0 else np.nan,
                     "viirs_count_norm": np.nan})
    cm = pd.DataFrame(rows)
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")

    a2v = {"slope": 1.0, "intercept": 0.0, "bias_factor": 4.0}
    t2a = {"slope": 1.0, "intercept": 0.0, "bias_factor": 1.25}
    cm2 = harmonize(cm.copy(), a2v, t2a)

    # Quiet observed cell: 0 detections -> harmonized 0, source not "none"
    quiet = cm2[cm2["cell_lat"] == 21.125]
    assert quiet["harmonized_count"].iloc[0] == 0.0, "quiet cell should be 0"
    assert quiet["source"].iloc[0] != "none", "quiet cell should have a source label"

    # Unobserved cell: NaN inputs -> harmonized NaN, source none
    unobs = cm2[cm2["cell_lat"] == 21.375]
    assert pd.isna(unobs["harmonized_count"].iloc[0]), "unobserved cell should be NaN"
    assert unobs["source"].iloc[0] == "none", "unobserved cell source should be none"


# ---------------------------------------------------------------------------
# 7. Existing splice_check tests still pass (regression)
# ---------------------------------------------------------------------------

def test_exact_conversions_pass_zero_stays_zero():
    import splice_check as sc  # noqa: E402
    cm = _synth_cm(A2V_MONTHS)
    cm["harmonized_count"] = cm["viirs_count_norm"]
    cm["source"] = np.where(cm["viirs_count_norm"].notna(), "VIIRS", "none")
    r = sc.check_source_handover(cm, EXACT, "2012-01", sc.excluded_months(META), 12, 0.05)
    assert r["result"] == "PASS" and r["step"] == pytest.approx(1.0)


def test_zero_pinning_prevents_false_floor():
    """Core fix: a cal dict with positive intercept gives zero for zero input.
    The old code returned (e^intercept - 1) * bias > 0 for zero."""
    cal = {"slope": 1.0, "intercept": 0.5, "bias_factor": 1.0}
    assert apply_log_line(np.array([0.0]), cal)[0] == 0.0
    # nonzero inputs still map positively (intercept only shifts the curve)
    assert apply_log_line(np.array([1.0]), cal)[0] > 0


def test_calendar_zero_median_not_inf():
    """Calendar month with 0 median produces NaN (blank in CSV), never inf or TypeError."""
    from pipeline.model.calendar import calendar  # noqa: E402
    cm = pd.DataFrame({
        "month": ["2020-01", "2021-01", "2022-01", "2020-02", "2021-02", "2022-02"],
        "harmonized_count": [0.0, 0.0, 5.0, 10.0, 20.0, 30.0],
    })
    mat, anom = calendar(cm)
    assert mat.loc[2022, 1] == 5.0
    assert pd.isna(anom.loc[2022, 1]), "zero-median month must produce NaN (blank), not inf"
    assert not np.isinf(anom.to_numpy(dtype=float, na_value=0.0)).any()
    assert anom.loc[2021, 2] == 1.0


# ---------------------------------------------------------------------------
# 8. Calendar-month ratio calibration (monthly_ratio, Jun-Sep pooled)
# ---------------------------------------------------------------------------

def _synth_seasonal_cm(months):
    """Two cells where target/source ratio varies by season:
    - March (month 3): y = 8 * x
    - October (month 10): y = 4 * x
    - Monsoon (months 6, 7, 8, 9): y = 12 * x, with different x totals per month
    - All other months: y = 6 * x
    Cell 0 is always 0.0; Cell 1 has positive detections.
    """
    rows = []
    for m in months:
        p = pd.Period(m, "M")
        cal_m = p.month
        if cal_m == 3:
            x_val, ratio = 10.0, 8.0
        elif cal_m == 10:
            x_val, ratio = 5.0, 4.0
        elif cal_m in (6, 7, 8, 9):
            # Vary x across 6..9 and make individual month ratios slightly different
            # so pooling is distinguishable from unpooled per-month ratios
            x_val = float(cal_m)
            ratio = 10.0 if cal_m in (6, 7) else 14.0
        else:
            x_val, ratio = 8.0, 6.0
        for k in range(2):
            xv = 0.0 if k == 0 else x_val
            yv = 0.0 if k == 0 else x_val * ratio
            rows.append({
                "month": m,
                "cell_lat": 21.125 + k * 0.25,
                "cell_lon": 78.625,
                "terra_count_norm": xv * 0.5,
                "aqua_count_norm": xv,
                "viirs_count_norm": yv,
            })
    cm = pd.DataFrame(rows)
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")
    return cm


def test_monthly_ratio_zero_stays_zero():
    """Under monthly_ratio, 0.0 stays exactly 0.0 and NaN stays NaN across all calendar months."""
    cm = _synth_seasonal_cm(A2V_MONTHS)
    cal = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", A2V_WINDOW)
    assert cal is not None
    assert cal["method"] == "monthly_ratio"
    test_x = pd.Series([0.0, np.nan, 0.0, 5.0], index=[0, 1, 2, 3])
    test_m = pd.Series(["2015-03", "2015-07", "2015-10", "2015-03"], index=[0, 1, 2, 3])
    out = apply_log_line(test_x, cal, months=test_m)
    assert out.iloc[0] == 0.0, "zero in March must stay 0.0"
    assert np.isnan(out.iloc[1]), "NaN in July must stay NaN"
    assert out.iloc[2] == 0.0, "zero in October must stay 0.0"
    assert out.iloc[3] == pytest.approx(40.0), "positive March value should scale by March factor (8.0)"


def test_monthly_ratio_picks_factor_by_calendar_month():
    """apply_log_line and apply_ratio pick the calendar-month factor matching each row's month."""
    cm = _synth_seasonal_cm(A2V_MONTHS)
    cal = fit_log_line(cm, "aqua_count_norm", "viirs_count_norm", A2V_WINDOW)
    assert cal["monthly_factors"]["3"] == pytest.approx(8.0)
    assert cal["monthly_factors"]["10"] == pytest.approx(4.0)
    assert cal["monthly_factors"]["1"] == pytest.approx(6.0)

    s_val = pd.Series([10.0, 10.0, 10.0])
    s_mon = pd.Series(["2016-03", "2016-10", "2016-01"])
    pred = apply_log_line(s_val, cal, months=s_mon)
    assert pred.iloc[0] == pytest.approx(80.0)
    assert pred.iloc[1] == pytest.approx(40.0)
    assert pred.iloc[2] == pytest.approx(60.0)


def test_monthly_ratio_pooled_monsoon_shares_factor():
    """Monsoon months (Jun-Sep: 6, 7, 8, 9) share one identical pooled factor sum(y_6..9)/sum(x_6..9)."""
    cm = _synth_seasonal_cm(A2V_MONTHS)
    cal = fit_monthly_ratio(cm, "aqua_count_norm", "viirs_count_norm", A2V_WINDOW)
    assert cal is not None
    mf = cal["monthly_factors"]
    # Months 6, 7 have x=6,7 with ratio=10 -> y=60,70; months 8, 9 have x=8,9 with ratio=14 -> y=112,126
    # Pooled factor = (60 + 70 + 112 + 126) / (6 + 7 + 8 + 9) = 368 / 30 = 12.266667
    expected_pooled = (60.0 + 70.0 + 112.0 + 126.0) / (6.0 + 7.0 + 8.0 + 9.0)
    for m_str in ("6", "7", "8", "9"):
        assert mf[m_str] == pytest.approx(expected_pooled), f"month {m_str} must share pooled monsoon factor"
    assert mf["6"] == mf["7"] == mf["8"] == mf["9"]


