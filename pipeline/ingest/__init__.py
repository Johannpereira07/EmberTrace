"""Pipeline stages 1-4 (Person 1): load, filter, grid + count, normalize."""
from .aggregate import aggregate, platform_weight, restrict_to_loaded_data
from .coverage import coverage_info
from .outages import daily_counts, find_outages, outage_days_by_month, read_firms_table
from .load import load, load_many
