import os

from sqlmodel import SQLModel, create_engine, text

# Necessary in order to create the tables if they doesn't already exist DO NOT DELETE
from data.schemes.category import Category
from data.schemes.image import Image
from data.schemes.platform import Platform
from data.schemes.product import Product
from data.schemes.return_policy import ReturnPolicy
from data.schemes.seller import Seller


POSTGRES_URL = os.environ.get("POSTGRES_URL")

if not POSTGRES_URL:
    raise ValueError("POSTGRES_URL environment variable is not set")

engine = create_engine(POSTGRES_URL)

def create_db_and_tables():
    with engine.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        connection.commit()
    SQLModel.metadata.create_all(engine)