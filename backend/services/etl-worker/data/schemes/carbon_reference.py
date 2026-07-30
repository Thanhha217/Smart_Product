from typing import Optional

from sqlmodel import Field, SQLModel


# Ground-truth catalog of products with known carbon footprints (from EPDs).
class CarbonReferenceBase(SQLModel):
    name: str
    category: str
    brand: Optional[str] = None
    co2e_kg: float
    scope: str = "cradle-to-grave"
    source: str  # EPD / report citation, for traceability


class CarbonReference(CarbonReferenceBase, table=True):
    id: int = Field(default=None, primary_key=True)
