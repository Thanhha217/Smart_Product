# Getting started with SmartProduct-Finder

## Prerequisites
- Python 3.12 or higher
- Node.js (version 20 or higher)
- npm (Node package manager)

## Setup
Read the README files in both the `backend` and `frontend` directories for detailed setup instructions.

Add a .env file in the root directory of the project containg the secrets variables.
To inquire about the values of these variables, please contact the project maintainers.

## Running the application
As our application is fully dockerized, you can start every module with a single command. Make sure you have Docker installed and running on your machine.

To start the application, run the following command in the root directory of the project (in development mode):
```bash
docker-compose -f docker-compose.dev.yml up --build -d
```


URLs:
- Frontend: http://localhost:3000
- Backend API gateway: http://localhost:8000
- Airflow UI: http://localhost:8080
- Kafka UI: http://localhost:8081
