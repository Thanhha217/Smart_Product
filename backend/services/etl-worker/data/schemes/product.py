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
    co2e_source: Optional[str] = Field(default=None)  # llm_estimate | neighbor_fallback
    co2e_confidence: Optional[float] = Field(default=None)
    co2e_explanation: Optional[str] = Field(default=None)
