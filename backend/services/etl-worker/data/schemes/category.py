from sqlmodel import Field, SQLModel

class CategoryBase(SQLModel):
    name: str

class Category(CategoryBase, table=True):
    id: int = Field(default=None, primary_key=True)