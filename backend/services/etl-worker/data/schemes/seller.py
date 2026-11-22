from sqlmodel import Field, SQLModel

class SellerBase(SQLModel):
    name: str
    seller_rating: float

class Seller(SellerBase, table=True):
    id: int = Field(default=None, primary_key=True)