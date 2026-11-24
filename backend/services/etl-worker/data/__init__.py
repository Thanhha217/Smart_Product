import os

from sqlmodel import SQLModel, create_engine, text

# Necessary in order to create the tables if they doesn't already exist DO NOT DELETE
from data.schemes.carbon_reference import CarbonReference
from data.schemes.category import Category
from data.schemes.image import Image
from data.schemes.platform import Platform
from data.schemes.product import Product
from data.schemes.return_policy import ReturnPolicy
from data.schemes.seller import Seller


POSTGRES_URL = os.environ.get("POSTGRES_URL")

if not POSTGRES_URL:
    raise ValueError("POSTGRES_URL environment variable is not set")

engine = create_engine(POSTGRES_URL, pool_pre_ping=True)  # survive a database restart: test a pooled connection before use

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # create_all never adds columns to an existing table
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            for column in ("co2e_explanation_vi", "co2e_category", "co2e_references", "co2e_detail", "co2e_breakdown"):
                conn.execute(text(f"ALTER TABLE product ADD COLUMN IF NOT EXISTS {column} VARCHAR"))
            for column in ("source_url", "verification"):
                conn.execute(text(f"ALTER TABLE carbonreference ADD COLUMN IF NOT EXISTS {column} VARCHAR"))
            # create_all makes no index beyond the primary keys, and a restored dump brings none.
            # Search orders every row by "does this product have a photo", which without these
            # reads the whole image table per product.
            for ddl in (
                "CREATE INDEX IF NOT EXISTS ix_image_product_id ON image (product_id)",
                "CREATE INDEX IF NOT EXISTS ix_product_category_id ON product (category_id)",
                "CREATE INDEX IF NOT EXISTS ix_product_co2e_category ON product (co2e_category)",
                "CREATE INDEX IF NOT EXISTS ix_product_co2e_kg ON product (co2e_kg)",
            ):
                conn.execute(text(ddl))