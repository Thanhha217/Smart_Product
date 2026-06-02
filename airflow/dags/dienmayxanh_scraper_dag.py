from airflow import DAG
from airflow.operators.bash import BashOperator
from datetime import datetime

default_args = {
    'owner': 'airflow',
    'start_date': datetime(2026, 1, 1),
}

with DAG('dienmayxanh_scraper_dag', default_args=default_args, schedule='@daily') as dag:
    run_spider = BashOperator(
        task_id='run_dienmayxanh_spider',
        bash_command='cd /opt/airflow/scrapers && scrapy crawl dienmayxanh'
    )
