# API cho trang Tổng quan (dashboard)

## `GET /api/overview` (gateway → db-search `/stats/overview`)
```jsonc
{"total_products": 7515, "with_co2": 7515, "references": 1450, "grid_ef": 0.681,
 "by_category": [{"category": "laptop", "n": 4716, "median_kg": 277.2, "p25": 240.0, "p75": 316.2, "min_kg": 113.0, "max_kg": 485.0}],
 "by_source": [{"source": "neighbor_average", "n": 4396}, {"source": "category_model", "n": 2806}, {"source": "manufacturer", "n": 187}],
 "platforms": [{"name": "CellPhones", "n": 6000}],
 "greenest": [{"category": "laptop", "item": <db-search product item, same shape as /product/{id}>}],   // món ít CO2 nhất có giá của mỗi loại
 "suggestions": [{"category": "computer_monitor", "from": <item>, "to": <item>, "saved_kg": 301.2}],     // cặp "đổi sang món xanh hơn" giá ±15 %
 "updated_at": "ISO"}
```
Chỉ sản phẩm có `final_price > 0`. Số CO₂ là cột `co2e_kg` đã lưu.

## `GET /api/health` (gateway tự hỏi từng dịch vụ)
```jsonc
{"services": [{"key": "db-search", "name": "Cơ sở dữ liệu & tìm kiếm", "status": "online", "latency_ms": 12},
              {"key": "ranking", "name": "Xếp hạng CatBoost + RRF", ...}, {"key": "clip", ...},
              {"key": "assistant", "name": "AI giải thích", "status": "online", "detail": "openai:gpt-5.4-mini | rule-based"},
              {"key": "mcp", "name": "MCP cho ChatGPT", ...}, {"key": "etl", "name": "ETL + tính CO₂", ...}],
 "checked_at": "ISO"}
```
`status` ∈ `online | offline`. Hỏi song song, timeout 2 s mỗi dịch vụ.
