import pandas as pd


def window_ratio(tot, m, n=12):
    before = [m - k for k in range(n, 0, -1)]
    after = [m + k for k in range(n)]
    for x in before + after:
        if x not in tot.index or pd.isna(tot[x]):
            return None
    b = tot[before].sum()
    if b <= 0:
        return None
    return tot[after].sum() / b


def placebo_ratios(tot, avoid, n=12):
    out = {}
    for m in tot.index:
        span = set(pd.period_range(m - n, m + n - 1, freq="M"))
        if span & avoid:
            continue
        r = window_ratio(tot, m, n)
        if r is not None:
            out[m] = r
    return pd.Series(out, dtype=float)
