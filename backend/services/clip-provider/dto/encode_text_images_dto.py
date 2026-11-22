from pydantic import BaseModel

class EncodeTextDTO(BaseModel):
    text: str

class EncodeImageFromUrlDTO(BaseModel):
    image_url: str

class EncodeImagesFromUrlsDTO(BaseModel):
    image_urls: list[str]