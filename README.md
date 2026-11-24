# CarbonSense AI

Search engine for Vietnamese e-commerce (FPT Shop, TGDĐ, Điện Máy Xanh, Phong Vũ, CellphoneS…) that ranks
products by fit **and** by lifecycle carbon footprint (kg CO₂e), with an AI-generated result page, a ChatGPT/MCP
connector and a test-mode "AI compares and orders" flow.

**Start here:** [docs/PROJECT_NOTES.md](docs/PROJECT_NOTES.md) (one-page map of the whole project) ·
CO₂ submission: [docs/co2-method/](docs/co2-method/README.md)

## Repository layout

| Path | Content |
|---|---|
| `airflow/` | Scrapy / Scrapling scrapers and their DAGs → Kafka |
| `backend/services/` | Micro-services (one Dockerfile each): `gateway`, `etl-worker` (ingest + CO₂ + shared `green/` package), `clip-provider`, `ranking_system`, `db-search`, `assistant` (AI page, CO₂ explanation, compare, test orders), `mcp-server` (ChatGPT / MCP) |
| `frontend/` | React 19 + Vite + Tailwind web app |
| `docs/` | `PROJECT_NOTES.md`, `co2-method/` (submission + spec), `research/` (method notes, experiment results), `demo/` (API contract, MCP guide, video script), `references/` (papers, internship report), `co2-setup.md` |
| `scripts/research/` | Reproducible experiments (`eval_co2_methods.py`), DB-dump audit, demo queries |
| `paper/` | `research_paper.tex` + figures |
| `notebooks/` | CatBoost ranker notebook |
| `data/backups/` | DB dump and category migration SQL |

## Prerequisites
- Python 3.12 or higher, Node.js 20 or higher, Docker Desktop

## Setup
Create the `.env` file in the root directory from the template (docker compose fails without it):
```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```
The defaults work for development. `ANTHROPIC_API_KEY` (optional, never commit it) lets the assistant write the
texts of the AI page; without it the page is built with rule-based texts. CO₂ estimation (reference catalogue,
fallback steps, environment variables): [docs/co2-setup.md](docs/co2-setup.md).

## Tests (no Docker needed)
```bash
cd backend/services/etl-worker && python -m pytest tests/test_exact_match.py tests/test_fallback.py tests/test_green.py tests/test_explain.py
cd backend/services/ranking_system && python -m pytest test_rrf.py
cd backend/services/assistant && pip install -r requirements.txt pytest httpx && python -m pytest
cd backend/services/gateway && python -m pytest tests
cd backend/services/mcp-server && pip install -r requirements.txt -r requirements-dev.txt && python -m pytest
python scripts/research/eval_co2_methods.py        # leave-one-family-out evaluation of the CO2 fallbacks
cd backend/services/db-search && python -m pytest tests/test_search_query.py tests/test_product_specs.py tests/test_accessory.py
cd frontend && npm install && npm run test && npm run build
```

## Running the application
```bash
docker compose -f docker-compose.dev.yml up --build -d
```

URLs:
- Frontend: http://localhost:5173 (pages: `/`, `/search`, `/product/:id`, `/assistant`, `/assistant/:id`, `/compare`, `/method`, `/cart`, `/checkout`, `/orders/:id`)
- Backend API gateway: http://localhost:8000 (`/api/*`: [docs/demo/api-contract.md](docs/demo/api-contract.md))
- MCP server: http://localhost:8100/mcp ([docs/demo/mcp-chatgpt.md](docs/demo/mcp-chatgpt.md))
- Airflow UI: http://localhost:8080 · Kafka UI: http://localhost:8081

Frontend without any backend (demo / video): `cd frontend && VITE_MOCK_API=1 npm run dev`
(PowerShell: `$env:VITE_MOCK_API="1"; npm run dev`).
