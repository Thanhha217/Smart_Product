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
            image_embeddings = batch_vectors
        except Exception as e:
            print(f"Error processing product images: {e}", flush=True)

    return text_vector, image_embeddings


def encode_text(text):
    # CLIP text embedding via the provider (used by carbon_estimator).
    return _post_to_clip_provider("/encode-text", {"text": text})


def encode_texts(texts, chunk=64):
    """Batch CLIP embeddings (clip-provider /encode-texts); one request per text if the endpoint is missing."""
    out = []
    for start in range(0, len(texts), chunk):
        part = texts[start:start + chunk]
        try:
            out.extend(_post_to_clip_provider("/encode-texts", {"texts": part}))
        except requests.HTTPError as error:
            if error.response is None or error.response.status_code != 404:
                raise
            out.extend(encode_text(t) for t in part)
    return out
