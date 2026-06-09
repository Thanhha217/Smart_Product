import math
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
from sqlmodel import Session, select, create_engine

def create_dataset():
    content = ""

    with open('query_list.txt', 'r') as f:
        qid = 1
        for line in f:
            query = line.strip()
            product_list = get_product_list_for_query(query)
            content += compute_features(query, qid, product_list)
            qid += 1
    
    with open("ranking_dataset.txt", "w") as f:
        f.write(content)

def get_product_list_for_query(query):
    with Session(engine) as session:
        statement = select(Product, Seller, ReturnPolicy).join(Seller).join(ReturnPolicy).limit(10)

        return session.exec(statement).all()
    
    return []


def compute_features(query, qid, product_list):
    query_content = ""
    
    def log1p(val):
        return math.log(val+1)

    max_price = log1p(max(p.final_price for (p,s,rp) in product_list))
    min_price = log1p(min(p.final_price for (p,s,rp) in product_list))
    print(f"max: {max_price}, min: {min_price}")

    max_days_for_return = log1p(max(rp.days_for_return for (p,s,rp) in product_list))
    min_days_for_return = log1p(min(rp.days_for_return for (p,s,rp) in product_list))

    max_warranty_duration = log1p(max(rp.warranty_duration for (p,s,rp) in product_list))
    min_warranty_duration = log1p(min(rp.warranty_duration for (p,s,rp) in product_list))

    for (p,s,rp) in product_list:
        features = []

        # Start of the features
        query_content += f"X qid:{qid} "

        # Sementic score TODO
        features.append(-1)

        # Price score (reverse the value so the cheapest products have the highest score)
        if max_price == min_price:
            features.append(0.5)
        else:
            features.append(1 - (log1p(p.final_price) - min_price)/(max_price - min_price))
    
        # Review score
        AVERAGE_RATING = 0.8 
        CONFIDENCE_VALUE = 10 # number of reviews to be considered a "reliable" rating
        features.append(((p.review_count * p.product_rating) + (CONFIDENCE_VALUE * AVERAGE_RATING)) / (p.review_count + CONFIDENCE_VALUE))
        
        # Seller rating
        features.append(s.seller_rating)

        # Free delivery
        features.append(rp.free_delivery)

        # Days for return
        if max_days_for_return == min_days_for_return:
            features.append(0.5)
        else:
            features.append((log1p(rp.days_for_return) - min_days_for_return)/(max_days_for_return - min_days_for_return))

        # Warranty duration
        if max_warranty_duration == min_warranty_duration:
            features.append(0.5)
        else:
            features.append((log1p(rp.warranty_duration) - min_warranty_duration)/(max_warranty_duration - min_warranty_duration))

        for i in range(len(features)):
            query_content += f"{i+1}:{features[i]:.4f} "

        #end data TODO
        query_content += f"#id={p.id}\n"


    return query_content

create_dataset()