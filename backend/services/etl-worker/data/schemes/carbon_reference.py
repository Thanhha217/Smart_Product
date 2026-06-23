from typing import Optional

from sqlmodel import Field, SQLModel


# A curated catalog of products whose carbon footprint is already known
# (taken from manufacturer Environmental Product Declarations / reports).
# It is the "ground truth" the carbon estimator compares new products against.
class CarbonReferenceBase(SQLModel):
    name: str
    category: str
    brand: Optional[str] = None

    # Verified product carbon footprint, in kg CO2-equivalent.
    co2e_kg: float

    # Life-cycle boundary the value covers. Keep it consistent across rows
    # so comparisons stay fair (see ISO 14067 "cradle-to-grave").
    scope: str = "cradle-to-grave"

    # Where the value comes from (EPD / environmental report URL or citation),
    # so every number can be traced back and verified.
    source: str


class CarbonReference(CarbonReferenceBase, table=True):
    id: int = Field(default=None, primary_key=True)
