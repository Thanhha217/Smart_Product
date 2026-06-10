import math
import numpy as np
import statistics
import os
import sys

# Get absolute path to the directory containing hyphens
subfolder_path = os.path.join(os.path.dirname(__file__), "backend/services/etl-worker")

# Insert it into the module search paths
sys.path.insert(0, subfolder_path)

os.environ["POSTGRES_URL"] = "postgresql://postgres:password@localhost:5432/smart_product_finder"

from data import engine
from data.schemes.product import Product
from data.schemes.seller import Seller
from data.schemes.return_policy import ReturnPolicy
from data.schemes.platform import Platform
from sqlmodel import Session, select, create_engine

def create_dataset():
    content = ""
    metadata = ""

    with open('query_list.txt', 'r', encoding="utf-8") as f:
        qid = 1
        for line in f:
            query = line.strip()
            product_list = get_product_list_for_query(query)
            content += compute_features(query, qid, product_list)
            metadata += compute_metadata(query, product_list)
            qid += 1
    
    with open("ranking_dataset.txt", "w", encoding="utf-8") as f:
        f.write(content)

    with open("ranking_dataset_metadata.txt", "w", encoding="utf-8") as f:
        f.write(metadata)

def get_product_list_for_query(query):
    with Session(engine) as session:
        statement = select(Product, Seller, ReturnPolicy, Platform).join(Seller).join(ReturnPolicy).join(Platform).limit(20)

        return session.exec(statement).all()
    
    return []


def compute_features(query, qid, product_list):
    def robust_score_min_max(values):
        median = statistics.median(values)
        q75, q25 = np.percentile(values, [75, 25])
        iqr = q75 - q25

        if iqr == 0:
            return {values[i]:0.5 for i in range(len(values))}

        robust_values = [(v - median)/iqr for v in values]

        max_value = max(robust_values)
        min_value = min(robust_values)

        return {values[i]:(robust_values[i] - min_value)/(max_value - min_value) for i in range(len(values))}

    price_list = [p.final_price for (p,s,rp,pl) in product_list]
    robust_prices = robust_score_min_max(price_list)

    days_for_return_list = [rp.days_for_return for (p,s,rp,pl) in product_list]
    robust_days_for_return = robust_score_min_max(days_for_return_list)

    warranty_duration_list = [rp.warranty_duration for (p,s,rp,pl) in product_list]
    robust_warranty_duration = robust_score_min_max(warranty_duration_list)

    query_content = ""

    for (p,s,rp,pl) in product_list:
        features = []

        # Start of the features
        query_content += f"X qid:{qid} "

        # ID
        features.append(p.id)

        # Sementic score TODO
        features.append(-1)

        # Price score (reverse the value so the cheapest products have the highest score)
        features.append(1 - robust_prices[p.final_price])
    
        # Review score
        AVERAGE_RATING = 0.8 
        CONFIDENCE_VALUE = 10 # number of reviews to be considered a "reliable" rating
        features.append(((p.review_count * p.product_rating) + (CONFIDENCE_VALUE * AVERAGE_RATING)) / (p.review_count + CONFIDENCE_VALUE))
        
        # Seller rating
        features.append(s.seller_rating)

        # Free delivery
        features.append(rp.free_delivery)

        # Days for return
        features.append(robust_days_for_return[rp.days_for_return])

        # Warranty duration
        features.append(robust_warranty_duration[rp.warranty_duration])

        for i in range(len(features)):
            query_content += f"{i}:{features[i]:.4f} "

        query_content += "\n"


    return query_content


def compute_metadata(query, product_list):
    metadata_content = ""
    for (p,s,rp,pl) in product_list:
        metadata_content += f"id:{p.id:8}  "

        metadata_content += f"name:{p.name:60}  "
        
        metadata_content += f"price:{int(p.final_price):9}  "

        metadata_content += f"platform:{pl.name:15}  "

        metadata_content += f"query:{query}"

        metadata_content += "\n"

    return metadata_content

create_dataset()