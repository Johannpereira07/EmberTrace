# Synthetic FIRMS data (ING-7)

**SYNTHETIC demonstration data. Not real fire history.** Use it to test the pipeline (and anything downstream) without the 1.4 GB real archive, or to check that a change still gets the right answer.

```bash
make synthetic          # generate + run the pipeline + compare with the planted truth (about 6 s)
```

or step by step:

```bash
python tools/synthetic/generate.py --out out/synthetic/raw          # about 2 s, 22 MB, 268k detections
python pipeline/run.py --modis "out/synthetic/raw/DL_FIRE_M-C61_*/fire_*.csv" \
                       --viirs "out/synthetic/raw/DL_FIRE_*V-C2_*/fire_*.csv" --out out/synthetic
python tools/synthetic/check.py out/synthetic
```

## What you get

- **Files laid out like the real download:** `DL_FIRE_<product>_synthetic/fire_{archive,nrt}_<product>_synthetic.csv` for `M-C61` (Terra, Aqua), `SV-C2` (S-NPP), `J1V-C2` (NOAA-20) and `J2V-C2` (NOAA-21). Same columns, satellite codes, confidence formats and `version` values. Archive files have `type`, NRT files don't. `acq_time` is `HHMM` in archive files and `HH:MM` in NRT files.
- **A `SYNTHETIC.txt` marker in every folder.** `pipeline/run.py` sees it, prints a banner, and writes `"data_kind": "synthetic"` in `normalized.meta.json`. It refuses to mix synthetic and real folders.
- **The planted answer** in `raw/truth.csv` (true fire activity `true_viirs_equiv` per cell and month) and `raw/truth.json` (all settings).

## The planted answer

Each cell-month has a true fire activity F (expected VIIRS detections per satellite). Each satellite sees a fixed share: **VIIRS 1.0, Aqua 0.25, Terra 0.20**. So a correct pipeline gives:

- `viirs_count_norm ≈ F`, `aqua_count_norm ≈ 0.25 F`, `terra_count_norm ≈ 0.20 F`
- VIIRS / Aqua = **4** (2012 to 2019) and Aqua / Terra = **1.25** (2002-08 to 2011-12)
- a harmonized series equal to F, with **no step** at the handovers

## Features (5–40 N, 60–100 E; 133 cells)

| Feature | Where |
|---|---|
| Normal fire regions | `central` (20.75–22.25 N, 78.25–79.75 E, spring peak), `crop` (30–31 N, 75–76 E, Oct–Nov crop burning), 80 `scattered` cells |
| Bad fire season | `central`, Mar to May 2016, ×2.5 |
| Sparse area, zero-median months | one cell 12.0–12.25 N, 76.0–76.25 E (the API spec's sparse example): fires only in Mar–Apr, so every other calendar month has a median of 0. Aug 2019 has a small fire (value > 0 with a zero median) |
| Partial current month | data through 2026-11-13; VIIRS NRT from 2026-08, MODIS NRT from 2026-09 |
| Handovers and satellite counts | satellites fly on their `pipeline/config.yaml` dates; S-NPP until 2026-11-02 13:00 |
| Outage days | days listed in `docs/08` get no detections for that satellite. That includes the suspect row "2026-05-30 to 2026-04-28", so S-NPP is empty in May 2026 here, and the pipeline warns about it |
| Static sources | 10 fixed points: `type 2` in archive files, untagged in NRT files (the NRT mask must drop them) |
| False alarms | +5% low-confidence detections (the confidence filter must drop them) |

## What `check.py` reports (seed 7)

- **Ingest (stages 1–4): all PASS within 3%.** Terra 1.001, Aqua 1.005, VIIRS 0.998, NRT months after the mask 1.013. Planted ratios 4.007 and 1.251.
- **End product (stages 5–7, Person 2), as of 14 Nov:**
  - `TERRA_chained` is 1.45× the truth and `AQUA_calibrated` 1.17×.
  - Cells with 0 true fires come out as 4.9 / 2.2 instead of 0, the known zero-to-positive issue (AGENTS.md, Known issues).
  - Handovers: harmonized ×0.43 vs true ×0.20 at 2002-07, and ×0.42 vs true ×0.64 at 2012-01.

  CAL-2 / CAL-3 can use this as their known-answer test: after the fix, these should match the truth.

Change the seed with `--seed`, the period with `--start` / `--end`.
