"""Stage 6: pick the source per cell-month and apply the conversions."""
import numpy as np
import pandas as pd

from .calibrate import _call_apply, apply_log_line


def harmonize(cm, a2v, t2a, apply_fn=apply_log_line):
    nan = pd.Series(np.nan, index=cm.index)
    months = cm["month"] if "month" in cm.columns else None
    viirs = cm["viirs_count_norm"]
    aqua_eq = _call_apply(apply_fn, cm["aqua_count_norm"], a2v, months) if a2v else nan
    terra_eq = (_call_apply(apply_fn, _call_apply(apply_fn, cm["terra_count_norm"], t2a, months), a2v, months)
                if (a2v and t2a) else nan)
    cm["harmonized_count"] = viirs.fillna(aqua_eq).fillna(terra_eq)
    cm["source"] = np.select([viirs.notna(), aqua_eq.notna(), terra_eq.notna()],
                             ["VIIRS", "AQUA_calibrated", "TERRA_chained"], "none")
    return cm
