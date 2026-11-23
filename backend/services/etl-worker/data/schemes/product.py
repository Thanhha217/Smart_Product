from sqlmodel import Field, SQLModel
from sqlalchemy import Column

from typing import List, Optional
class ProductBase(SQLModel):
    name: str
    product_url: str
    original_price: float
    final_price: float
    description: str
    product_rating: float
    review_count: int
    scraped_at: float # timestamp with ms after the coma
    # The category label exactly as the source sent it, kept so a bad mapping
    # can be found and audited without replaying Kafka.
    raw_category: str = ""

class ProductImages(ProductBase):
    files_urls: list[str]
    files: list[str]

class Product(ProductBase, table=True):
    id: int = Field(default=None, primary_key=True)
    
    platform_id: int = Field(default=None, foreign_key="platform.id")
    seller_id: int = Field(default=None, foreign_key="seller.id")
    return_policy_id: int = Field(default=None, foreign_key="return_policy.id")
    category_id: int = Field(default=None, foreign_key="category.id")

    # Carbon footprint (kg CO2e); filled by carbon_estimator, NULL until then.
    co2e_kg: Optional[float] = Field(default=None)
    # neighbor_average | category_model | lifecycle_formula | eeio_price
    # (older rows: llm_estimate | neighbor_fallback). See green/fallback.py.
    co2e_source: Optional[str] = Field(default=None)
    co2e_confidence: Optional[float] = Field(default=None)
    co2e_explanation: Optional[str] = Field(default=None)
    co2e_explanation_vi: Optional[str] = Field(default=None)
    # Reference category the number was computed in (for the 0-5 green score) and the
    # reference products used, as a JSON list of {name, co2e_kg, cosine}.
    co2e_category: Optional[str] = Field(default=None)
    co2e_references: Optional[str] = Field(default=None)
    # JSON: the numbers of the method (category median, slope, kWh/year...) so the web can
    # show the formula with values substituted, and the lifecycle split (green/lifecycle.py).
    co2e_detail: Optional[str] = Field(default=None)
    co2e_breakdown: Optional[str] = Field(default=None)
