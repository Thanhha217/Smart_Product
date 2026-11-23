# Hợp đồng API cho demo (B1 trang AI, B2 MCP, B3 mua hàng thử)

Mọi API đi qua **gateway** (`http://localhost:8000`, frontend dùng `GATEWAY_URL`) với tiền tố `/api`.
Tên trường tiếng Anh, số CO₂ luôn là **kg CO₂e** (float), giá là **VND**. Lỗi: `{"error": {"code": "...", "message": "..."}}`.

| API | Dịch vụ xử lý | Ghi chú |
|---|---|---|
| `GET  /api/products/{id}/co2` | assistant | CO₂ + công thức thế số + vòng đời |
| `GET  /api/products/{id}/related?limit=6` | db-search | cùng loại, xếp theo CO₂ tăng dần |
| `GET  /api/categories/{cat}/stats?product_id=` | db-search | thống kê loại |
| `GET  /api/compare?ids=a,b,c` | assistant | 2–4 sản phẩm |
| `POST /api/assistant` | assistant | tạo trang AI |
| `GET  /api/assistant/{id}` | assistant | mở lại trang |
| `POST /api/orders/test` | assistant | tạo đơn thử `awaiting_confirmation` |
| `GET  /api/orders/test/{id}` | assistant | |
| `POST /api/orders/test/{id}/confirm` | assistant | **chỉ web**: header bắt buộc `X-Confirm-Source: web-ui` |
| `POST /api/orders/test/{id}/cancel` | assistant | |
| `GET  /api/method` | assistant | tóm tắt phương pháp (cho MCP `explain_co2_method`) |

Các API cũ (`POST /query`, `GET /product/{id}`, `POST /assistant`) giữ nguyên.

## Kiểu dữ liệu

```jsonc
// ProductCard
{"product_id": "123", "name": "...", "price_vnd": 18990000, "platform": "FPT Shop",
 "image_url": "...", "product_url": "...", "category": "laptop",
 "co2e_kg": 332.6, "co2e_source": "neighbor_average", "co2e_confidence": 0.5,
 "green_score": 1.7, "rating": 4.6, "review_count": 120}
// co2e_kg = null  → "Chưa có số CO₂", green_score = null

// Formula (GET /api/products/{id}/co2 → "formula")
{"method": "category_model",            // manufacturer | neighbor_average | lifecycle_formula | category_model | eeio_price | llm_estimate | none
 "title_vi": "Mức giữa của loại", "title_en": "Category model",
 "expression": "CO₂ = trung vị × (inch ÷ inch chuẩn)^b",
 "steps": [{"label_vi": "Trung vị màn hình (330 mẫu)", "label_en": "...", "expr": "491,5 kg", "value_kg": 491.5},
           {"label_vi": "Hệ số cỡ màn hình", "label_en": "...", "expr": "(27 ÷ 23,8)^0,81 = 1,108", "value_kg": null}],
 "result_kg": 544.0, "confidence": 0.35,
 "complete": true}                      // false = dữ liệu cũ thiếu chi tiết, chỉ có tổng

// Lifecycle
{"basis": "formula",                    // formula | typical_share | none
 "total_kg": 544.0,
 "stages": [{"key": "materials_production", "label_vi": "Nguyên liệu & sản xuất", "label_en": "...", "kg": 430.0, "pct": 79.0},
            {"key": "transport", ...}, {"key": "use", ...}, {"key": "end_of_life", ...}],
 "route": {"origin_vi": "Trung Quốc", "origin_en": "China", "destination": "Việt Nam",
           "distance_km": 2600, "mode": "sea", "assumed": true},
 "use_phase": {"years": 6, "kwh_year": 45, "grid_ef": 0.681} | null,
 "note_vi": "...", "note_en": "..."}

// GET /api/products/{id}/co2
{"product": ProductCard, "explanation_vi": "...", "explanation_en": "...",
 "references": [{"name": "...", "co2e_kg": 290, "cosine": 0.81}],
 "formula": Formula, "lifecycle": Lifecycle}

// GET /api/categories/{cat}/stats?product_id=123
{"category": "laptop", "n": 412, "median_kg": 300.1, "p25": 250, "p75": 360, "min": 80, "max": 900,
 "product_kg": 135, "greener_than_pct": 92.5}      // % sản phẩm cùng loại có CO₂ cao hơn

// GET /api/products/{id}/related
{"product_id": "123", "category": "laptop", "items": [ProductCard],
 "greener_alternative": ProductCard | null}        // giá chênh ±15%, CO₂ thấp hơn

// GET /api/compare?ids=1,2,3
{"products": [ProductCard & {"formula": Formula, "lifecycle": Lifecycle, "annual_kwh": 45|null, "electricity_vnd_year": 121500|null}],
 "rows": ["price_vnd","co2e_kg","green_score","co2e_source","co2e_confidence","annual_kwh","electricity_vnd_year"],
 "best": {"price_vnd": "2", "co2e_kg": "1", "green_score": "1", ...},
 "conclusion": "..."}                              // câu kết luận dựng từ số, không gọi AI
```

## Trang AI (`POST /api/assistant` → body `{"message": "...", "lang": "vi", "parent_id": null}`)

Trả về `{"id": "uuid", "url": "/assistant/uuid", "page": Page}`. `Page` đã **được hệ thống gắn số thật** (frontend chỉ hiển thị):

```jsonc
{"version": 1, "id": "uuid", "lang": "vi", "query": "...", "parent_id": null, "created_at": "ISO",
 "plan": {"search_query": "...", "category_slug": "laptops", "budget_max_vnd": 20000000},
 "summary": "Gợi ý ... vì CO₂ chỉ 135 kg ...",          // đã thay placeholder
 "products": {"123": ProductCard, ...},                 // tra cứu theo id cho mọi section
 "sections": [
   {"type": "recommendations", "product_ids": ["123","456","789"], "reasons": {"123": "..."}},
   {"type": "formula", "product_id": "123", "formula": Formula},
   {"type": "lifecycle", "product_id": "123", "lifecycle": Lifecycle},
   {"type": "chart", "chart": "co2_bar" | "price_vs_co2" | "lifecycle_stack", "title": "...", "spec": VegaLiteSpec},
   {"type": "category_stats", "category": "laptop", "product_id": "123", "stats": Stats},
   {"type": "savings", "best_id": "123", "baseline": "category_median", "baseline_kg": 300.1,
    "lifecycle_kg_saved": 165.1, "horizons": [{"months": 6, "kg": 20.6, "kwh": null, "vnd": null}, {"months": 12, ...}],
    "trees_year": 7.6},
   {"type": "why_low_co2", "bullets": ["..."]},
   {"type": "related", "product_id": "123", "items": [ProductCard], "greener_alternative": ProductCard|null},
   {"type": "sources", "items": [{"product_id": "123", "source": "manufacturer", "confidence": 0.9,
                                  "references": [...], "limitations_vi": "...", "limitations_en": "..."}]}
 ],
 "warnings": ["explanation_timeout" | "llm_unavailable" | "number_check_failed"],
 "meta": {"model": "claude-...|rule-based", "latency_ms": 4200, "number_check_failures": 0}}
```

Quy tắc: section chỉ thuộc 10 loại trên; chart chỉ 3 loại trên (Vega-Lite do **server dựng** từ dữ liệu thật);
AI chỉ nhắc số qua placeholder `{{p1.co2e_kg}}`, `{{p1.price}}`, `{{p1.green_score}}`, `{{p1.name}}`,
`{{savings.kg_12m}}`, `{{stats.median_kg}}`, `{{stats.greener_than_pct}}` — câu có số viết tay bị loại.

## Đơn hàng thử (B3, `CHECKOUT_MODE=test` bắt buộc)

```jsonc
// POST /api/orders/test   body: {"items": [{"product_id": "123", "quantity": 1}], "created_by": "user|assistant|mcp", "note": "..."}
// → TestOrder
{"id": "uuid", "mode": "test", "status": "awaiting_confirmation",   // draft → awaiting_confirmation → confirmed_test | cancelled
 "created_by": "assistant", "created_at": "ISO", "confirmed_at": null,
 "items": [{"product_id": "123", "name": "...", "quantity": 1, "unit_price_vnd": 18990000, "co2e_kg": 135, "category": "laptop"}],
 "total_vnd": 18990000, "total_co2e_kg": 135, "baseline_co2e_kg": 300.1, "saved_co2e_kg": 165.1,
 "confirm_url": "/orders/uuid",
 "events": [{"at": "ISO", "actor": "assistant", "action": "created"}]}
```
AI (assistant / MCP) chỉ tạo đơn tới `awaiting_confirmation`. Xác nhận chỉ qua nút trên web.
Không có trường nào nhận thẻ / tài khoản ngân hàng; không gọi cổng thanh toán.
