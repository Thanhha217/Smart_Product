from pydantic import BaseModel
from typing import Optional

class ImagePayload(BaseModel):
  image: Optional[str] = None

class AssistantPayload(BaseModel):
  message: str
  lang: str = "vi"
