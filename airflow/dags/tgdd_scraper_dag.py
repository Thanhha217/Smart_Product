from datetime import datetime

from airflow import DAG
from airflow.operators.bash import BashOperator


default_args = {
    "owner": "airflow",
    "start_date": datetime(2026, 1, 1),
}


# with DAG(
#     "tgdd_scraper_dag",
#     default_args=default_args,
#     schedule="@daily",
#     catchup=False,
# ) as dag:
#     run_spider = BashOperator(
#         task_id="run_tgdd_spider",
#         bash_command="cd /opt/airflow/scrapers && scrapy crawl tgdd_products",
#     )