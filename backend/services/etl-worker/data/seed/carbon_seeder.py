import hashlib
import json
from pathlib import Path

from sqlmodel import Session, delete, select

from data import engine
from data.schemes.carbon_reference import CarbonReference

# 1,450 products with manufacturer figures (121 original + Boavizta + EcoAmazon EPD + hand-collected reports)
SEED_FILE = Path(__file__).parent / "carbon_reference_seed_expanded.json"


FIELDS = ("name", "category", "brand", "co2e_kg", "scope", "source", "source_url", "verification")


def _fingerprint(rows) -> str:
    """Hash of the catalogue content, so editing one value (not only adding rows) reloads it."""
    canon = sorted(json.dumps([r.get(f) if isinstance(r, dict) else getattr(r, f, None) for f in FIELDS],
                              ensure_ascii=False, default=str) for r in rows)
    return hashlib.sha256("\n".join(canon).encode("utf-8")).hexdigest()


def seed_carbon_reference() -> None:
    """Load the reference catalog; reload it when the seed file content differs from the table."""
    with open(SEED_FILE, encoding="utf-8") as file:
        rows = json.load(file)
    rows = [{**row, "co2e_kg": float(row["co2e_kg"])} for row in rows]
    with Session(engine) as session:
        existing = session.exec(select(CarbonReference)).all()
        if len(existing) == len(rows) and _fingerprint(existing) == _fingerprint(rows):
            return
        if existing:
            session.exec(delete(CarbonReference))
        session.add_all(CarbonReference(**{k: v for k, v in row.items() if k in FIELDS}) for row in rows)
        session.commit()
        print(f"Seeded {len(rows)} carbon reference products (was {len(existing)}).", flush=True)
