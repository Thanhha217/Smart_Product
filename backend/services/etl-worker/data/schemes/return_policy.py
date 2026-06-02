from sqlmodel import Field, SQLModel

class ReturnPolicyBase(SQLModel):
    days_for_return: int
    free_delivery: bool
    warranty_duration: int

class ReturnPolicy(ReturnPolicyBase, table=True):
    __tablename__ = "return_policy"
    
    id: int = Field(default=None, primary_key=True)