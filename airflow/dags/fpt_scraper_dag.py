from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime

default_args = {
    'owner': 'airflow',
    'start_date': datetime(2026, 1, 1),
}

SCRAPY_DIR = 'cd /opt/airflow/scrapers &&'

SITES = [
    'fpt_shop',
    # 'tiki',
    # 'shopee',
]

with DAG('product_scraper_dag', default_args=default_args, schedule='@daily') as dag:
    for site in SITES:
        BashOperator(
            task_id=f'scrape_{site}',
            bash_command=f'{SCRAPY_DIR} scrapy crawl {site}',
        )
