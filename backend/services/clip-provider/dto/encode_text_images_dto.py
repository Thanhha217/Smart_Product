from pydantic import BaseModel

class EncodeTextDTO(BaseModel):
    text: str

class EncodeImageFromUrlDTO(BaseModel):
    image_url: str