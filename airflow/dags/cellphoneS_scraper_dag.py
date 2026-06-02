from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from datetime import datetime

default_args = {
    'owner': 'airflow',
    'start_date': datetime(2026, 1, 1),
}

with DAG('cellphone_s_scraper_dag', default_args=default_args, schedule='@daily') as dag:
    # Ensure you navigate to your Scrapy project folder first
    run_spider = BashOperator(
        task_id='run_cellphone_s_spider',
        bash_command='cd /opt/airflow/scrapers && scrapy crawl cellphone_s -s CLOSESPIDER_ITEMCOUNT=1000'
    )
