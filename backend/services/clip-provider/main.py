from fastapi import FastAPI

from dto.encode_text_images_dto import EncodeTextDTO, EncodeImageFromUrlDTO
from open_clip_functions import encode_text, encode_image_from_url

app = FastAPI()

@app.get("/")
def root():
    return {"status": "Ok"}

@app.post("/encode-text")
async def encode_text_endpoint(body: EncodeTextDTO):
    text_vector = encode_text(body.text)
    return text_vector

@app.post("/encode-image-from-url")
async def encode_image_endpoint(body: EncodeImageFromUrlDTO):
    image_vector = encode_image_from_url(body.image_url)
    return image_vector