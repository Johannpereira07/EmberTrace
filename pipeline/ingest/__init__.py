"""Pipeline stages 1-4 (Person 1): load, filter, grid + count, normalize."""
from .aggregate import aggregate, platform_weight, restrict_to_loaded_data
from .load import load, load_many
