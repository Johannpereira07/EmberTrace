"""ING-7: the synthetic generator writes real-looking FIRMS files, and the pipeline recovers the planted answer."""
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

from pipeline.ingest import load

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools" / "synthetic"))
import generate  # noqa: E402


@pytest.fixture(scope="module")
def synthetic(tmp_path_factory):
    out = tmp_path_factory.mktemp("synthetic")
    generate.generate(out / "raw")
    return out


def test_files_look_like_real_downloads(synthetic):
    raw = synthetic / "raw"
    for product in ("M-C61", "SV-C2", "J1V-C2", "J2V-C2"):
        folder = raw / f"DL_FIRE_{product}_synthetic"
        assert (folder / "SYNTHETIC.txt").exists()
        archive = pd.read_csv(folder / f"fire_archive_{product}_synthetic.csv", nrows=5)
        nrt = pd.read_csv(folder / f"fire_nrt_{product}_synthetic.csv", nrows=5)
        assert "type" in archive.columns and "type" not in nrt.columns     # as in the real files
        assert {"brightness", "bright_t31"} <= set(archive.columns)        # MODIS-style names, VIIRS too
    viirs = load(raw / "DL_FIRE_J1V-C2_synthetic" / "fire_nrt_J1V-C2_synthetic.csv")
    assert set(viirs["sensor"]) == {"VIIRS"} and set(viirs["platform"]) == {"NOAA-20"} and viirs["is_nrt"].all()
    modis = load(raw / "DL_FIRE_M-C61_synthetic" / "fire_archive_M-C61_synthetic.csv")
    assert set(modis["platform"]) == {"Terra", "Aqua"} and set(modis["conf_class"]) == {"low", "nominal", "high"}


def test_pipeline_recovers_planted_answer(synthetic):
    raw = synthetic / "raw"
    run = subprocess.run([sys.executable, str(ROOT / "pipeline" / "run.py"),
                          "--modis", str(raw / "DL_FIRE_M-C61_*" / "fire_*.csv"),
                          "--viirs", str(raw / "DL_FIRE_*V-C2_*" / "fire_*.csv"), "--out", str(synthetic)],
                         capture_output=True, text=True)
    assert run.returncode == 0, run.stdout + run.stderr
    assert "SYNTHETIC demonstration data" in run.stdout
    check = subprocess.run([sys.executable, str(ROOT / "tools" / "synthetic" / "check.py"), str(synthetic)],
                           capture_output=True, text=True)
    assert check.returncode == 0, check.stdout + check.stderr
    assert "ALL INGEST CHECKS PASS" in check.stdout


def test_run_refuses_to_mix_synthetic_and_real(tmp_path, synthetic):
    real = tmp_path / "real"
    real.mkdir()
    (real / "fire_archive_x.csv").write_text(
        (synthetic / "raw" / "DL_FIRE_SV-C2_synthetic" / "fire_archive_SV-C2_synthetic.csv").read_text())
    run = subprocess.run([sys.executable, str(ROOT / "pipeline" / "run.py"),
                          "--modis", str(synthetic / "raw" / "DL_FIRE_M-C61_*" / "fire_*.csv"),
                          "--viirs", str(real / "fire_*.csv"), "--out", str(tmp_path / "o")],
                         capture_output=True, text=True)
    assert run.returncode != 0 and "Don't mix synthetic and real data" in run.stdout + run.stderr
