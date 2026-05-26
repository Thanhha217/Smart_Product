import threading
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from data import create_db_and_tables
from worker.etl_worker import start_worker

load_dotenv()

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

worker_thread = threading.Thread(target=start_worker, daemon=True)
worker_thread.start()


@app.get("/")
def root():
    return {"message": "Hello World!"}