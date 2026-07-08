import os
import requests

OPEN_CLIP_PROVIDER = os.environ.get("OPEN_CLIP_PROVIDER_URL", "http://smartproductfinder-backend-clip-provider:8067")

_session = requests.Session()


def _post_to_clip_provider(path, payload):
    response = _session.post(f"{OPEN_CLIP_PROVIDER}{path}", json=payload)
    response.raise_for_status()
    return response.json()

def generate_embeddings(parsed_data):

    text_to_encode = parsed_data["product"].name + " " + parsed_data["product"].description
    text_vector = _post_to_clip_provider("/encode-text", {"text": text_to_encode})

    image_urls = [image.image_url for image in parsed_data["images"]]
    image_embeddings = []

    if image_urls:
        try:
            batch_vectors = _post_to_clip_provider("/encode-images-from-urls", {"image_urls": image_urls})
            image_embeddings = [vector for vector in batch_vectors if vector is not None]
        except Exception as e:
            print(f"Error processing product images: {e}", flush=True)

    return text_vector, image_embeddings