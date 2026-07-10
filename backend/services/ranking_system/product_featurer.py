import statistics
import numpy as np


AVERAGE_RATING = 0.75
CONFIDENCE_VALUE = 5 # how many reviews to have a reliable score

def compute_features(product_list, product_similarities):
    nb_of_products = len(product_list)

    def robust_score_min_max(values):
        median = statistics.median(values)
        q75, q25 = np.percentile(values, [75, 25])
        iqr = q75 - q25

        if iqr == 0:
            return [0.5 for i in range(nb_of_products)]

        robust_values = [(v - median)/iqr for v in values]

        max_value = max(robust_values)
        min_value = min(robust_values)

        return [(robust_values[i] - min_value)/(max_value - min_value) for i in range(nb_of_products)]

    # Sementic score
    similarities = np.array(product_similarities)

    # Price score (0 in highest price, 1 is lowest price)
    price_list = [-p.final_price for p in product_list]
    robust_prices = np.array(robust_score_min_max(price_list))

    # Product Rating
    product_ratings = np.array([((p.review_count * p.product_rating) + (CONFIDENCE_VALUE * AVERAGE_RATING)) / (p.review_count + CONFIDENCE_VALUE) for p in product_list])

    # Seller rating
    seller_ratings = np.array([p.seller_rating if p.seller_rating != -1 else AVERAGE_RATING for p in product_list])

    # Free delivery
    free_delivery_list = np.array([p.free_delivery for p in product_list])

    # Days for return
    days_for_return_list = [p.days_for_return for p in product_list]
    robust_days_for_return = np.array(robust_score_min_max(days_for_return_list))

    # Warranty duration
    warranty_duration_list = [p.warranty_duration for p in product_list]
    robust_warranty_duration = np.array(robust_score_min_max(warranty_duration_list))
    
    return np.vstack((similarities, robust_prices, product_ratings, seller_ratings, free_delivery_list, robust_days_for_return, robust_warranty_duration)).T