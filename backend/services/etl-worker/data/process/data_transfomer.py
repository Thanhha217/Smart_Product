import open_clip
from PIL import Image
import threading

_model = None
_preprocess = None
_tokenizer = None
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

    for image in parsed_data["images"]:
        image_input = _preprocess(Image.open("/opt/product_images/" + image.image_path)).unsqueeze(0)
        image_vector = _model.encode_image(image_input)

        image.embedding = image_vector.squeeze().tolist()

    parsed_data["product"].text_embedding = text_vector.squeeze().tolist()