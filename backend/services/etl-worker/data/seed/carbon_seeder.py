import json
from pathlib import Path

from sqlmodel import Session, delete, func, select

from data import engine
from data.schemes.carbon_reference import CarbonReference

# 1,450 products with manufacturer figures (121 original + Boavizta + EcoAmazon EPD + hand-collected reports)
SEED_FILE = Path(__file__).parent / "carbon_reference_seed_expanded.json"


def seed_carbon_reference() -> None:
    """Load the reference catalog; reload it when the seed file has a different row count."""
    with open(SEED_FILE, encoding="utf-8") as file:
        rows = json.load(file)
    with Session(engine) as session:
        count = session.exec(select(func.count()).select_from(CarbonReference)).one()
        if count == len(rows):
            return
        if count:
            session.exec(delete(CarbonReference))
        session.add_all(CarbonReference(**row) for row in rows)
        session.commit()
        print(f"Seeded {len(rows)} carbon reference products (was {count}).", flush=True)
