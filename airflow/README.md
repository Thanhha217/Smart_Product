# Instructions to work with Airflow

## Adding a DAG
To add a DAG, simply create a new Python file in the `dags` directory.
For example, you can create a file named `example_dag.py` with the following content:
```python

from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime
def print_hello():
    print("Hello, Airflow!")
default_args = {
    'owner': 'airflow',
    'start_date': datetime(2026, 1, 1),
}

with DAG('example_dag', default_args=default_args, schedule_interval='@daily') as dag:
    task = PythonOperator(
        task_id='print_hello',
        python_callable=print_hello
    )
```

This DAG will print "Hello, Airflow!" every day at midnight. You can customize the DAG as needed by adding more tasks and defining dependencies between them.

## Running Airflow
To run Airflow, make sure you have Docker installed and running on your machine. Then, you can start Airflow using the following command in the root directory of the project:
```bash
docker-compose up airflow
```
This will start the Airflow web server and scheduler. You can access the Airflow UI at `http://localhost:8080` to monitor and manage your DAGs.

## Stopping Airflow
To stop Airflow, you can use the following command:
```bash
docker-compose down
```
This will stop all Airflow containers and remove them from your system.