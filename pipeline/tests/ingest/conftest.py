import copy
import os
import sys

import pytest

# make `import pipeline...` work when running `pytest pipeline/tests` from the repo root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from pipeline.ingest import satellites  # noqa: E402


@pytest.fixture(autouse=True)
def restore_satellite_globals():
    """restrict_to_loaded_data() narrows START/END/SERIES in place; undo it after each test."""
    saved = {k: copy.deepcopy(getattr(satellites, k)) for k in ("START", "END", "SERIES")}
    yield
    for k, v in saved.items():
        d = getattr(satellites, k)
        d.clear()
        d.update(v)
