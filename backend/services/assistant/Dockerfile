# Build context must be backend/services so the shared `green` package
# (etl-worker/green) can be copied in:
#   build: { context: ./backend/services, dockerfile: assistant/Dockerfile }
FROM python:3.12-slim

WORKDIR /app

COPY assistant/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY etl-worker/green ./green
COPY assistant/ .

EXPOSE 8070

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8070"]
