FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

# Model cache location. Baked into the image below so container restarts do not
# re-download ~470MB from HuggingFace, and so the worker starts with no network.
ENV HF_HOME=/opt/hf-cache
ENV CATEGORY_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
ENV OMP_NUM_THREADS=1

WORKDIR /app

COPY ./requirements.txt .

# CPU-only torch first: sentence-transformers would otherwise pull the CUDA
# build and add ~2GB to an image that never touches a GPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir --retries 5 --timeout 120 -r requirements.txt

RUN python -c "from sentence_transformers import SentenceTransformer; import os; SentenceTransformer(os.environ['CATEGORY_EMBEDDING_MODEL'])"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--log-level", "warning"]
