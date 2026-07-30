from pydantic import BaseModel

class EncodeTextDTO(BaseModel):
    text: str

class EncodeImageFromUrlDTO(BaseModel):
    image_url: str

class EncodeImagesFromUrlsDTO(BaseModel):
    image_urls: list[str]

class EncodeImageFromBase64DTO(BaseModel):
    image_base64: str