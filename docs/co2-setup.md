# Product Carbon Footprint (CO2e) Estimation — Setup

> **Lưu ý (nhánh `new-research`)**: mục 2 bên dưới (chọn LLM) là của bản cũ; LLM không còn sinh số CO₂. Các bước dự phòng khi không có sản phẩm giống: [research/co2-fallback.md](research/co2-fallback.md). Công thức CO₂ vòng đời mới và lượng CO₂ giảm thải sau 6/12 tháng được mô tả ở [research/co2-formula.md](research/co2-formula.md); tổng quan 4 yêu cầu của giáo viên ở [research/advisor-requirements.md](research/advisor-requirements.md).

This feature estimates each product's cradle-to-grave carbon footprint (kg CO2e)
inside `etl-worker` (`data/process/data_processing.py::process_message`, never
blocks ingestion). Order of steps (details: [research/co2-fallback.md](research/co2-fallback.md)):

1. Reuse the value already stored for the same `product_url`.
2. Average of the reference products (manufacturer EPD/PCF, table `carbonreference`)
   whose CLIP cosine is >= 0.66 → `co2e_source = neighbor_average`.
3. No close reference → `green/fallback.py`: lifecycle formula for home appliances
   (`lifecycle_formula`), brand/screen-size model of the reference catalogue
   (`category_model`), or price x US EPA supply-chain factor (`eeio_price`).
4. Nothing applies → `co2e_kg` stays NULL.

The LLM (Qwen via Ollama) no longer produces the number. With `CO2E_USE_LLM=1`
it may adjust the neighbour average when close references exist (paper experiments).

---

## 1. Python dependencies

Already declared in `backend/services/etl-worker/requirements.txt` and installed
when the `etl-worker` image is built — nothing extra to install by hand. The
estimator reuses the existing CLIP (`open_clip_torch` + `torch`), `faiss-cpu`,
`numpy` and `requests`; the only new dependency is `anthropic` (Claude API
client, only used when the Anthropic backend is selected).

## 2. Choose an LLM backend

Selected with the `CO2E_LLM_PROVIDER` environment variable.

### Option A — Ollama (local, free, no API key) — recommended for dev

1. Install Ollama: <https://ollama.com/download>
2. Pull a model: `ollama pull llama3.2` (3B, ~2 GB). For better quality on a
   machine with >=16 GB RAM: `ollama pull qwen2.5:7b`.
3. Ollama auto-starts a local server on `localhost:11434`.
4. From inside Docker, the worker reaches it at `host.docker.internal:11434`
   (the default — no extra config on Docker Desktop).

### Option B — Anthropic Claude API (paid, higher quality)

1. Create an API key at <https://console.anthropic.com> and add billing credit.
2. Provide it as `ANTHROPIC_API_KEY`.
   **Do not commit the key** — `backend/.env.dev` is tracked by git. Pass the key
   at runtime instead, e.g. `... exec -e ANTHROPIC_API_KEY=sk-ant-... ...`.

> If neither backend is configured or reachable, the estimator silently falls
> back to the nearest-reference average (still works, lower accuracy).

## 3. Environment variables

| Variable           | Default                 | Purpose                                                        |
| ------------------ | ----------------------- | -------------------------------------------------------------- |
| `CO2E_FALLBACK`    | `0`                     | `1` = when no reference reaches cosine 0.66, use green.fallback (formula / category model / EEIO); `0` = leave empty (final method) |
| `CO2E_USE_LLM`     | `0`                     | `1` = let Qwen adjust the neighbour average (never without neighbours) |
| `CO2E_LLM_MODEL`   | `qwen3.5:0.8b`          | Ollama model, only used when `CO2E_USE_LLM=1`                  |
| `OLLAMA_HOST`      | `http://ollama:11434`   | Ollama server URL                                              |
| `CO2_GRID_EF`      | `0.6592`                | Vietnam grid factor (kg CO2e/kWh) for the lifecycle formula    |
| `CO2_VND_PER_USD`  | `25900`                 | VND per USD for the price-based (EEIO) step                    |
| `CO2_CPI_NOW`      | `336.940`               | Current US CPI-U, deflates prices to the 2022 USD of the factors |


## 4. Database

The CO2e columns on `product` and the `carbonreference` table are created
automatically on startup via `SQLModel.metadata.create_all`. Because that does
**not** ALTER existing tables, if you already have an old DB volume you must
recreate it so the new columns appear:

```bash
docker compose -f docker-compose.dev.yml down
docker volume ls            # find the product DB volume name
docker volume rm <project>_spf-postgres-db-volume
docker compose -f docker-compose.dev.yml up --build
```

The reference catalog (~121 products from manufacturer EPDs) is auto-seeded once
from `backend/services/etl-worker/data/seed/carbon_reference_seed.json`.

## 5. Run & verify

```bash
# Build and start the worker
docker compose -f docker-compose.dev.yml up -d --build backend-etl-worker

# (Ollama only) check the worker can reach Ollama
docker compose -f docker-compose.dev.yml exec backend-etl-worker \
  python -c "import requests; print(requests.get('http://host.docker.internal:11434/api/tags').json())"
```

As products are ingested, the worker logs lines such as:

```
CO2e for 'Laptop XYZ': 312.0 kg (neighbor_average)
CO2e for 'Máy lạnh Daikin Inverter 1.5 HP': 6118.4 kg (lifecycle_formula)
```

## 6. Validation (measure accuracy)

`validate_carbon_estimator.py` runs leave-one-out validation over the reference
catalog and reports **MAE**, **MAPE** and **Spearman** rank correlation:

```bash
docker compose -f docker-compose.dev.yml exec \
  -e CO2E_LLM_PROVIDER=ollama -e CO2E_LLM_MODEL=llama3.2 \
  backend-etl-worker python validate_carbon_estimator.py
```

- `VALIDATE_N` — number of products to test (default `30`; `0` = all 121).
- Run it without an LLM backend to measure the fallback (retrieval-only) quality.

## Notes / limitations

- The reference data mixes standards (Apple per-model LCA; Dell/Lenovo/Acer/Asus
  PAIA means with sizeable uncertainty; Samsung/Xiaomi PAS 2050) and each
  manufacturer's use-phase reflects **their** electricity grid, not Vietnam's.
  Treat the output as a **relative** environmental indicator — strongest for
  ranking/comparison, not as a certified absolute footprint.
- `co2e_confidence`: 0.5 neighbour average, 0.35 category model / formula with energy label,
  0.25–0.3 formula with defaults or rated power, 0.15 price-based. Heuristic; calibrate from
  the validation error.
