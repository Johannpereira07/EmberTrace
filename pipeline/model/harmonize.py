"""Stage 6: pick the source per cell-month and apply the conversions."""
import numpy as np
import pandas as pd

from .calibrate import apply_log_line


def harmonize(cm, a2v, t2a):
    nan = pd.Series(np.nan, index=cm.index)
    viirs = cm["viirs_count_norm"]
    aqua_eq = apply_log_line(cm["aqua_count_norm"], a2v) if a2v else nan
    terra_eq = (apply_log_line(apply_log_line(cm["terra_count_norm"], t2a), a2v)
                if (a2v and t2a) else nan)
    cm["harmonized_count"] = viirs.fillna(aqua_eq).fillna(terra_eq)
    cm["source"] = np.select([viirs.notna(), aqua_eq.notna(), terra_eq.notna()],
                             ["VIIRS", "AQUA_calibrated", "TERRA_chained"], "none")
    return cm
