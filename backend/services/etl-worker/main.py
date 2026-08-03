import threading
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from data import create_db_and_tables
from taxonomy.matcher import warm_matcher
from data.seed.carbon_seeder import seed_carbon_reference
from worker.etl_worker import start_worker
from worker.fpt_worker import fpt_worker
from worker.tgdd_worker import tgdd_worker
from worker.phongvu_worker import phongvu_worker
from worker.dienmayxanh_worker import dienmayxanh_worker
from worker.cellphones_worker import cellphone_s_worker

load_dotenv()

# Prepare the category matcher before any consumer thread starts. The threads
# below begin consuming at import time, so this cannot wait for the lifespan
# hook -- they would otherwise race to load the embedding model on their first
# message. A no-op unless the optional embedding backend is installed; it raises
# only when CATEGORY_EMBEDDINGS=on, so a deployment that explicitly requires the
# model fails loudly at boot rather than silently degrading.
warm_matcher()

@asynccontextmanager
async def lifespan(_: FastAPI):
    create_db_and_tables()
    seed_carbon_reference()
    yield

app = FastAPI(lifespan=lifespan)

fpt_worker_thread = threading.Thread(target=start_worker, args=[fpt_worker], daemon=True)
fpt_worker_thread.start()

tgdd_worker_thread = threading.Thread(target=start_worker, args=[tgdd_worker], daemon=True)
tgdd_worker_thread.start()

phongvu_worker_thread = threading.Thread(target=start_worker, args=[phongvu_worker], daemon=True)
phongvu_worker_thread.start()

dienmayxanh_worker_thread = threading.Thread(target=start_worker, args=[dienmayxanh_worker], daemon=True)
dienmayxanh_worker_thread.start()

cellphone_s_worker_thread = threading.Thread(target=start_worker, args=[cellphone_s_worker], daemon=True)
cellphone_s_worker_thread.start()