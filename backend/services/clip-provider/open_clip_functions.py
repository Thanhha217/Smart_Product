import open_clip
import requests
from PIL import Image

_model = None
_preprocess = None
_tokenizer = None

def _load_model():
    global _model, _preprocess, _tokenizer
    if _model is not None:
        return
    print("Loading OpenCLIP model...", flush=True)
    _model, _, _preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='laion2b_s34b_b79k')
    _tokenizer = open_clip.get_tokenizer('ViT-B-32')
    print("OpenCLIP loaded!", flush=True)


def encode_text(text):
    _load_model()
    text_input = _tokenizer([text])
    return _model.encode_text(text_input).squeeze().tolist()
    
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