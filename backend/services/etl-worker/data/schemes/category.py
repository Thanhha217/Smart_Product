from sqlmodel import Field, SQLModel

class CategoryBase(SQLModel):
    # Stable id from the standard taxonomy -- this is what rows are deduped on,
    # so the same category scraped from five sites collapses to one row.
    slug: str = Field(index=True, unique=True)
    name: str        # English display name
    name_vi: str = ""
    department: str = ""

class Category(CategoryBase, table=True):
    id: int = Field(default=None, primary_key=True)
