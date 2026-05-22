# Getting started with the backend

This backend is composed of microservices built using FastAPI, each responsible for a specific functionality. The microservices communicate with each other using HTTP requests.

Each new microservice should be added to the `services` folder, and its dependencies should be listed in its `requirements.txt` file. This service should also be added to the `docker-compose.yml` file to ensure it is included in the Docker setup.

## Prerequisites
- Python 3.12 or higher
- pip (Python package installer)

## Setup (without Docker)
1. Change directory to the backend folder:
```bash
cd backend
```

For each microservice, you can follow the same steps to set up the environment and run the service. For example, to set up the gateway service, navigate to its directory:
```bash
cd services/gateway
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

## Setup (with Docker)
1. Make sure you have Docker installed and running on your machine.

2. Build and start the services using Docker Compose (with the development configuration):
```bash
cd ..

docker-compose -f docker-compose.dev.yml up --build -d

```

This command will build the Docker images for each service and start the containers in detached mode. (The command maybe also be `docker compose` instead of `docker-compose` depending on your Docker version.)

3. To stop the services, run:
```bash
docker-compose -f docker-compose.dev.yml down
```