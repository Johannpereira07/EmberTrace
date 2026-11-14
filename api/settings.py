"""Server settings. Paths come from the environment (docs/06); thresholds from api/config.json.

Env vars:
  DATA_DIR             folder with the pipeline outputs (default: data)
  CELL_MONTH_FILE      cell_month table in DATA_DIR, .parquet or .csv (default: cell_month.parquet)
  META_FILE            meta.json in DATA_DIR (default: meta.json)
  STATIC_DIR           built frontend (default: static); not mounted if missing
  LOW_COUNT_THRESHOLD  overrides config.json (provisional)
  MIN_BASELINE_YEARS   overrides config.json (provisional)
"""
import json
import os
from dataclasses import dataclass
from pathlib import Path

CONFIG_FILE = Path(__file__).with_name("config.json")


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    cell_month_file: str
    meta_file: str
    static_dir: Path
    low_count_threshold: float
    min_baseline_years: int

    @property
    def cell_month_path(self) -> Path:
        return self.data_dir / self.cell_month_file

    @property
    def meta_path(self) -> Path:
        return self.data_dir / self.meta_file


def load_settings() -> Settings:
    cfg = json.loads(CONFIG_FILE.read_text())
    env = os.environ
    return Settings(
        data_dir=Path(env.get("DATA_DIR", "data")),
        cell_month_file=env.get("CELL_MONTH_FILE", "cell_month.parquet"),
        meta_file=env.get("META_FILE", "meta.json"),
        static_dir=Path(env.get("STATIC_DIR", "static")),
        low_count_threshold=float(env.get("LOW_COUNT_THRESHOLD", cfg["low_count_threshold"])),
        min_baseline_years=int(env.get("MIN_BASELINE_YEARS", cfg["min_baseline_years"])),
    )
