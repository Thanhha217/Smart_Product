"""Pytest bootstrap for the ETL worker.

Lives at the service root so pytest puts that directory on sys.path, making
`taxonomy`, `data` and `worker` importable exactly as they are at runtime.
"""

import os
import sys
from pathlib import Path

# data/__init__.py builds the SQLAlchemy engine at import time and raises
# without this. SQLite keeps it dependency-free -- no Postgres driver, no
# server -- and nothing in the test suite actually executes a query.
os.environ.setdefault("POSTGRES_URL", "sqlite://")

sys.path.insert(0, str(Path(__file__).parent))
