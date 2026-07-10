import io
import open_clip
from PIL import Image
import requests
import threading
from typing import Any

# open_clip ships inaccurate type stubs, so these stay untyped.
_model: Any = None
_preprocess: Any = None
_tokenizer: Any = None
_load_lock = threading.Lock()

def _load_models():
    global _model, _preprocess, _tokenizer

    if _model is not None:
        return

    with _load_lock:
        if _model is None:
            print("Loading OpenCLIP model...", flush=True)
            _model, _, _preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
            _tokenizer = open_clip.get_tokenizer('ViT-B-32')
            print("OpenCLIP loaded!", flush=True)

def generate_embeddings(parsed_data):
    _load_models()
    text_to_encode = parsed_data["product"].name + " " + parsed_data["product"].description
    text_input = _tokenizer([text_to_encode])
    text_vector = _model.encode_text(text_input)

    image_embeddings = []
    for image in parsed_data["images"]:
        try:
            response = requests.get(image.image_url)
            image_input = _preprocess(Image.open(io.BytesIO(response.content))).unsqueeze(0)
            image_vector = _model.encode_image(image_input)
            image_embeddings.append(image_vector.squeeze().tolist())
        except Exception as e:
            print(f"Error processing image {image.image_url}: {e}", flush=True)

    return text_vector.squeeze().tolist(), image_embeddings


def encode_text(text):
    # CLIP text embedding (same model as generate_embeddings).
    _load_models()
    text_vector = _model.encode_text(_tokenizer([text]))
    return text_vector.squeeze().tolist()
