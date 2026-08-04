from fastapi import FastAPI

from dto.encode_text_images_dto import EncodeTextDTO, EncodeImageFromUrlDTO, EncodeImagesFromUrlsDTO, EncodeImageFromBase64DTO
from open_clip_functions import encode_text, encode_image_from_url, encode_images_from_urls, encode_image_from_base64

app = FastAPI()

@app.get("/")
def root():
    return {"status": "Ok"}

@app.post("/encode-text")
async def encode_text_endpoint(body: EncodeTextDTO):
    text_vector = encode_text(body.text)
    return text_vector

@app.post("/encode-image-from-base64")
async def encode_image_from_base64_endpoint(body: EncodeImageFromBase64DTO):
    image_vector = encode_image_from_base64(body.image_base64)
    return image_vector

@app.post("/encode-image-from-url")
async def encode_image_endpoint(body: EncodeImageFromUrlDTO):
    image_vector = encode_image_from_url(body.image_url)
    return image_vector

@app.post("/encode-images-from-urls")
async def encode_images_endpoint(body: EncodeImagesFromUrlsDTO):
    image_urls = body.image_urls
    image_vectors = encode_images_from_urls(image_urls)
    return image_vectors