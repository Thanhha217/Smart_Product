import os
import requests

OPEN_CLIP_PROVIDER = os.environ.get("OPEN_CLIP_PROVIDER_URL", "http://smartproductfinder-backend-clip-provider:8067")

def generate_embeddings(parsed_data):

    text_to_encode = parsed_data["product"].name + " " + parsed_data["product"].description
    text_vector = requests.post(f"{OPEN_CLIP_PROVIDER}/encode-text", json={"text": text_to_encode}).json()

    image_embeddings = []
    for image in parsed_data["images"]:
        try:
            image_vector = requests.post(f"{OPEN_CLIP_PROVIDER}/encode-image-from-url", json={"image_url": image.image_url}).json()
            if image_vector is None:
                continue
            image_embeddings.append(image_vector)
        except Exception as e:
            print(f"Error processing image {image.image_url}: {e}", flush=True)

    return text_vector, image_embeddings