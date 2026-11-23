import base64
import io
import os

import open_clip
import requests
import torch
from PIL import Image

_model = None
_preprocess = None
_tokenizer = None

# Fewer threads than cores: several requests run at once, and 8 threads per call on
# an 8-core machine thrash (measured: 6-12 s per sentence instead of milliseconds).
torch.set_num_threads(int(os.environ.get("TORCH_NUM_THREADS", "4")))


def _load_model():
    global _model, _preprocess, _tokenizer
    if _model is not None:
        return
    print("Loading OpenCLIP model...", flush=True)
    _model, _, _preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
    _model.eval()  # create_model_and_transforms returns the model in training mode
    _tokenizer = open_clip.get_tokenizer('ViT-B-32')
    print("OpenCLIP loaded!", flush=True)


@torch.inference_mode()
def encode_text(text):
    _load_model()
    return _model.encode_text(_tokenizer([text])).squeeze().tolist()


@torch.inference_mode()
def encode_texts(texts: list[str], batch_size: int = 64) -> list[list[float]]:
    """Many texts in one call: batching is ~20x faster per text than one request each."""
    _load_model()
    out: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        out.extend(_model.encode_text(_tokenizer(texts[start:start + batch_size])).tolist())
    return out


@torch.inference_mode()
def encode_image_from_url(image_url: str):
    _load_model()
    image_source = requests.get(image_url, stream=True)
    if image_source.status_code >= 400:
        return None
    image_input = _preprocess(Image.open(image_source.raw)).unsqueeze(0)
    return _model.encode_image(image_input)


def encode_images_from_urls(image_urls: list[str]):
    encoded_images = []

    for image_url in image_urls:
        encoded_image = encode_image_from_url(image_url)
        if encoded_image is not None:
            encoded_images.append(encoded_image.squeeze().tolist())

    return encoded_images


@torch.inference_mode()
def encode_image_from_base64(image_base64: str):
    _load_model()
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    image_input = _preprocess(Image.open(io.BytesIO(base64.b64decode(image_base64)))).unsqueeze(0)
    return _model.encode_image(image_input).squeeze().tolist()
