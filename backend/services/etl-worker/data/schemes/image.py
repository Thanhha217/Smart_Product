from sqlmodel import Field, SQLModel
from sqlalchemy import Column
from pgvector.sqlalchemy import Vector
from typing import List
class ImageBase(SQLModel):
    image_url: str
    image_path: str

class Image(ImageBase, table=True):
    id: int = Field(default=None, primary_key=True)
    
    product_id: int = Field(default=None, foreign_key="product.id")

    embedding: List[float] = Field(default=None, sa_column=Column(Vector(512)))