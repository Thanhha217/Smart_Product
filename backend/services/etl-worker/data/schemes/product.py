from sqlmodel import Field, SQLModel

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