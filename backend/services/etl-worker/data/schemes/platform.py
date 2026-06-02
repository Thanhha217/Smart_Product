from sqlmodel import Field, SQLModel

class PlatformBase(SQLModel):
    name: str

class Platform(PlatformBase, table=True):
    id: int = Field(default=None, primary_key=True)