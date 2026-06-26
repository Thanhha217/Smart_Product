from data.process.data_parser import parse_product_data
from data.process.data_transformer import generate_embeddings
from data.process.carbon_estimator import estimate_product_co2e
from data.process.data_loader import load_data_into_database

def process_message(message: dict):
    
    # First we need to parse the data in order to map the json to instances of our sql tables
    parsed_data = parse_product_data(message)

    # TODO Then, we need to normalize the data (e.g. translate the description in english

    # We need also to generate the embeddings
    embeddings = generate_embeddings(parsed_data)

    # Estimate CO2e (fail-safe, writes onto the product in place).
    estimate_product_co2e(parsed_data["product"], embeddings[0], parsed_data["category"].name)

    # Finally we can load the data into the database (it will automatically do the CDC)

    load_data_into_database(parsed_data, embeddings)