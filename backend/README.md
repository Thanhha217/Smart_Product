# Getting started with the backend

This backend is composed of microservices built using FastAPI, each responsible for a specific functionality. The microservices communicate with each other using HTTP requests.

Each new microservice should be added to the `services` folder, and its dependencies should be listed in its `requirements.txt` file. This service should also be added to the `docker-compose.yml` file to ensure it is included in the Docker setup.

## Prerequisites
- Python 3.12 or higher
- pip (Python package installer)

## Setup
1. Change directory to the backend folder:
```bash
cd backend
```

For each microservice, you can follow the same steps to set up the environment and run the service. For example, to set up the API service, navigate to its directory:
```bash
cd services/api
```

2. Create a virtual environment:
```bash
python -m venv venv 
```

3. Activate the virtual environment:
- On Windows:
```bash
venv\Scripts\activate
```

- On macOS/Linux:
```bash
source venv/bin/activate
```

4. Install the required dependencies:
```bash
pip install -r requirements.txt
```

## Running the backend
To start the backend server, run the following command:
```bash
uvicorn main:app --reload
```