FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# CPU-only torch and torchvision first to prevent open-clip-torch from pulling in 2GB CUDA images
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY ./requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8067

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8067", "--log-level", "warning"]