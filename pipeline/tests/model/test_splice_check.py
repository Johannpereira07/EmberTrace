"""CAL-5: the splice check passes when the conversions are right and fails when they cause a jump."""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "science"))
import splice_check as sc  # noqa: E402

# a log1p line with slope 1, intercept 0 and bias b is exactly "multiply by b"
EXACT = {"aqua_to_viirs": {"slope": 1.0, "intercept": 0.0, "bias_factor": 4.0},
         "terra_to_aqua": {"slope": 1.0, "intercept": 0.0, "bias_factor": 1.25}}


def _cell_month(months, aqua_share=0.25, terra_share=0.20):
    """Two cells with seasonal fire F; each series sees its share, sources as in the pipeline."""
    rows = []
    for m in months:
        p = pd.Period(m, "M")
        for k, lat in enumerate((21.125, 21.375)):
            F = (5 + 3 * np.sin(p.month / 12 * 2 * np.pi)) * (1 + k)
            terra = F * terra_share
            aqua = F * aqua_share if p >= pd.Period("2002-07", "M") else np.nan
            viirs = F if p >= pd.Period("2012-01", "M") else np.nan
            src = "VIIRS" if not np.isnan(viirs) else "AQUA_calibrated" if not np.isnan(aqua) else "TERRA_chained"
            rows.append({"month": m, "cell_lat": lat, "cell_lon": 78.625, "terra_count_norm": terra,
                         "aqua_count_norm": aqua, "viirs_count_norm": viirs, "harmonized_count": F, "source": src})
    cm = pd.DataFrame(rows)
    cm["_m"] = pd.PeriodIndex(cm["month"], freq="M")
    return cm


MONTHS = [str(m) for m in pd.period_range("2000-11", "2026-11", freq="M")]
META = {"data_through": "2026-11-13", "provisional_from": "2026-08"}


@pytest.mark.parametrize("h", ["2002-07", "2012-01"])
def test_exact_conversions_pass(h):
    r = sc.check_source_handover(_cell_month(MONTHS), EXACT, h, sc.excluded_months(META), 12, 0.05)
    assert r["result"] == "PASS" and r["step"] == pytest.approx(1.0)


def test_wrong_conversion_fails_with_the_right_step():
    wrong = json.loads(json.dumps(EXACT))
    wrong["aqua_to_viirs"]["bias_factor"] = 5.0          # Aqua converted 25% too high
    r = sc.check_source_handover(_cell_month(MONTHS), wrong, "2012-01", sc.excluded_months(META), 12, 0.05)
    assert r["result"] == "FAIL" and r["step"] == pytest.approx(0.8)   # VIIRS / (1.25 x VIIRS)


def test_zero_floor_is_eliminated():
    # Core fix: apply_log_line(0) = 0 even with a positive intercept cal.
    # The old code returned (e^intercept - 1) * bias > 0 for zero.
    from pipeline.model.calibrate import apply_log_line  # noqa: E402
    import numpy as np
    floor = {"slope": 1.0, "intercept": 0.5, "bias_factor": 1.0}
    assert apply_log_line(np.array([0.0]), floor)[0] == 0.0
    assert apply_log_line(np.array([1.0]), floor)[0] > 0  # nonzero still maps positively


def test_provisional_and_partial_months_are_skipped():
    skip = sc.excluded_months(META)
    assert pd.Period("2026-08", "M") in skip and pd.Period("2026-11", "M") in skip
    assert pd.Period("2026-07", "M") not in skip


def test_satellite_handover_compares_with_other_years():
    cm = _cell_month(MONTHS)
    assert sc.check_satellite_handover(cm, "2023-03", sc.excluded_months(META))["result"] == "PASS"
    cm.loc[cm["_m"] >= pd.Period("2023-03", "M"), "harmonized_count"] *= 3     # a step when NOAA-21 joins
    assert sc.check_satellite_handover(cm, "2023-03", sc.excluded_months(META))["result"] == "FAIL"


def test_truth_check():
    cm = _cell_month(MONTHS)
    truth = cm[["month", "cell_lat", "cell_lon"]].assign(true_viirs_equiv=cm["harmonized_count"])
    assert sc.check_truth(cm, truth, "2002-07", set(), 12, 0.05)["result"] == "PASS"
    cm.loc[cm["_m"] < pd.Period("2002-07", "M"), "harmonized_count"] *= 1.5     # Terra chain too high
    assert sc.check_truth(cm, truth, "2002-07", set(), 12, 0.05)["result"] == "FAIL"
