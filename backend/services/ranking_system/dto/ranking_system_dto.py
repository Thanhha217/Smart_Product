from pydantic import BaseModel
from typing import Optional

class QueryWithImageDTO(BaseModel):
    image: Optional[str] = None