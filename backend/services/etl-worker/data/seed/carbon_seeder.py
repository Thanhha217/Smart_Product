import json
from pathlib import Path

from sqlmodel import Session, select

from data import engine
from data.schemes.carbon_reference import CarbonReference

SEED_FILE = Path(__file__).parent / "carbon_reference_seed.json"


def seed_carbon_reference() -> None:
    """Load the reference catalog once (no-op if the table already has rows)."""
    with Session(engine) as session:
        already_seeded = session.exec(select(CarbonReference).limit(1)).first()
        if already_seeded:
            return

        with open(SEED_FILE, encoding="utf-8") as file:
            rows = json.load(file)

        session.add_all(CarbonReference(**row) for row in rows)
        session.commit()
        print(f"Seeded {len(rows)} carbon reference products.", flush=True)
