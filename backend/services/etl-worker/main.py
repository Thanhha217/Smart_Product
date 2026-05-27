import threading

from dotenv import load_dotenv
from fastapi import FastAPI
from worker.etl_worker import start_worker

load_dotenv()

app = FastAPI()
worker_thread = threading.Thread(target=start_worker, daemon=True)
worker_thread.start()

@app.get("/")
def root():
    return {"message": "Hello World!"}