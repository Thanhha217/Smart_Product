# Getting started with SmartProduct-Finder

## Prerequisites
- Python 3.12 or higher
- Node.js (version 20 or higher)
- npm (Node package manager)

## Setup
Read the README files in both the `backend` and `frontend` directories for detailed setup instructions.

Create the `.env` file in the root directory from the template (docker compose fails without it):
```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```
The defaults work for development. For other secret values, contact the project maintainers.

CO2 estimation (reference catalogue, fallback steps, environment variables): see `docs/co2-setup.md`.
CO2 tests (no Docker needed):
```bash
cd backend/services/etl-worker && python -m pytest tests/test_exact_match.py tests/test_fallback.py tests/test_green.py
cd backend/services/ranking_system && python -m pytest test_rrf.py
```

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
