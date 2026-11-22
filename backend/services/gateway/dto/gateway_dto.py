from pydantic import BaseModel
from typing import Optional

class ImagePayload(BaseModel):
  image: Optional[str] = None