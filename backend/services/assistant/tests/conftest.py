"""Run the assistant tests without Docker: green is the shared package of etl-worker."""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.append(str(HERE.parent.parent / "etl-worker"))  # in Docker, green is copied next to main.py
os.environ.setdefault("DB_SEARCH_URL", "http://db-search.test")
os.environ.pop("POSTGRES_URL", None)
os.environ["CHECKOUT_MODE"] = "test"
