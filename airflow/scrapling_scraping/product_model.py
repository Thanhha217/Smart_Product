import re
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, HttpUrl

def keep_only_numbers(text):
    result = re.sub(r"\D", "", str(text))
    return int(result) if result else -2

class ProductModel(BaseModel):
    url: HttpUrl
    platform: str = "Lazada"
    seller: str
    seller_rating: float = Field(..., ge=0, le=1.0)
    name: str
    category: str
    file_urls: List[str] = []
    original_price: int
    final_price: int
    description: str
    short_description: str
    product_rating: float = Field(..., ge=0, le=1.0) # Ensures 0-1 range
    review_count: int
    free_delivery: bool = False
    days_for_return: int
    warranty_duration: int
    scraped_at: float

    @field_validator("original_price", "final_price", "review_count", 
                     "days_for_return", "warranty_duration", mode="before")
    @classmethod
    def clean_numbers(cls, v):
        return keep_only_numbers(v)

    @field_validator("product_rating", mode="before")
    @classmethod
    def clean_product_rating(cls, v):
        print("v = ",v)
        val = float(v) / 5.0
        return val

    @field_validator("seller_rating", mode="before")
    @classmethod
    def clean_seller_rating(cls, v):
        val = float(keep_only_numbers(v)) / 100.0
        return val
    
    @field_validator("description", "short_description", mode="before")
    @classmethod
    def clean_description(cls, v):
        return " ".join([item.strip() for item in v if item.strip()])