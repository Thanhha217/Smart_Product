# PROJECT NOTES — Smart Product Finder (đọc file này trước, đỡ phải đọc lại cả repo)

> Cập nhật 23/11/2026, nhánh `feature/co2-submission-demo`. Ghi ngắn, đủ để định vị file. Chi tiết nằm ở link.
>
> **Không dùng Claude web / Artifact** cho dự án này: mọi sản phẩm (slide, báo cáo, trang) làm thành file cục bộ.
>
> **Quy tắc GitHub:** không để tên AI trong commit/PR/issue (không `Co-Authored-By: Claude`, không "Generated with Claude Code"); commit bằng danh tính git của người dùng.
>
> **Chạy toàn bộ trên máy:** [demo/run-local.md](demo/run-local.md) (khôi phục dump → backfill CO₂ + FAISS → Airflow cào thật → `scripts/demo/smoke_e2e.py`).

## 1. Đề tài trong 5 dòng
- Máy tìm kiếm sản phẩm điện tử / điện gia dụng trên sàn Việt Nam; xếp hạng theo **nhu cầu** (CatBoost) + **CO₂ vòng đời** (weighted RRF, CO₂ chỉ phá thế hòa).
- Trọng tâm bản nộp: **công thức CO₂** (chuỗi ưu tiên có nguồn + độ tin cậy, AI không tự sinh số) → [co2-method/01-ban-nop-cong-thuc-co2.md](co2-method/01-ban-nop-cong-thuc-co2.md).
- Demo: trang kết quả do AI sinh (B1), MCP cho ChatGPT (B2), AI so sánh rồi đặt mua **thử** (B3, không trả tiền thật).
- Bài báo: [paper/research_paper.tex](../paper/research_paper.tex) "Eco-Conscious AI-Powered Multimodal Product Recommendation System for Vietnamese E-Commerce".
- `GEMINI.md`: không trích nguyên văn báo cáo thực tập (`docs/references/RapportDeStage.pdf`).

## 2. Luồng dữ liệu và dịch vụ (docker-compose.dev.yml)
```
Airflow DAG (scrapy) ──Kafka topic──▶ etl-worker ──▶ Postgres (product, carbonreference…) + FAISS
                                        │  parse → match_category → CLIP embed → estimate_product_co2e → load
frontend ──▶ gateway:8000 ──/query──▶ db-search:8061 ──▶ ranking-system:8008 (FAISS + CatBoost + RRF) ──▶ clip-provider:8067
              │ /api/products/{id}/related, /api/categories/{cat}/stats ──▶ db-search
              └ /api/* còn lại (assistant, co2, compare, method, orders/test) ──▶ assistant:8070 ──▶ db-search, Claude API
mcp-server:8100/mcp ──▶ gateway /api/* (+ /query)
```
| Dịch vụ | Thư mục | Ghi chú |
|---|---|---|
| frontend | `frontend/` | React 19, Vite 6, Tailwind 4, router 7; cổng 5173 (compose). Vega-Lite tải từ CDN (`ChartView.jsx`) |
| gateway | `backend/services/gateway/main.py` | `/query`, `/product/{id}`, `/assistant` (cũ) + `/api/*` chuyển tiếp (giữ status + header `X-Confirm-Source`) |
| etl-worker | `backend/services/etl-worker/` | Kafka consumer 5 shop; tính CO₂ lúc nhập; chứa package dùng chung **`green/`** |
| db-search | `backend/services/db-search/` | `get_product_data_from_ids` (trả cả co2e_detail/breakdown/confidence); `co2_queries.py`: related, category stats (percentile_cont) |
| ranking_system | `backend/services/ranking_system/` | `ranker.py`, `rrf.py` (k=60, w=0,2, thiếu CO₂ → hạng giữa), `evaluation/` (LLM judge, NDCG) |
| clip-provider | `backend/services/clip-provider/` | OpenCLIP ViT-B-32 laion2b; `/encode-text`, `/encode-image-*` |
| assistant | `backend/services/assistant/` | **Mới thêm vào compose.** Build context `backend/services` (copy `green`). Trang AI, CO₂ giải thích, compare, đơn thử |
| mcp-server | `backend/services/mcp-server/` | **Mới.** SDK `mcp` 2.x (`MCPServer`), streamable HTTP stateless, widget ChatGPT |
| ollama | — | Qwen 0.8B, chỉ dùng khi `CO2E_USE_LLM=1` (thí nghiệm) |

Scraper: DAG tgdd đang comment; lazada không có consumer; shopee/tiki là stub; **chưa bộ cào nào lấy kWh/năm hay công suất W** (việc A3).

## 3. Công thức CO₂ (code: `etl-worker/data/process/carbon_estimator.py::estimate_product_co2e`)
Thứ tự, dừng ở bước đầu ra số (`co2e_source` · `co2e_confidence`):
0. Đã có số cho cùng `product_url` → dùng lại.
1. **Trùng đúng mẫu** `green/matching.py` (tên mẫu ≥ 3 từ nằm nguyên trong tên SP; dấu "+" giữ trong token) → `manufacturer` · 0,9.
2. **Mẫu giống** CLIP top-5 (ưu tiên cùng loại), bỏ ngoài [trung vị÷8; ×8], giữ cosine ≥ `CO2E_SIM_THRESHOLD`=0,66 → trung bình → `neighbor_average` · 0,5.
3. Không có mẫu giống → `green/fallback.py::estimate_without_neighbours` (`CO2E_FALLBACK=1`):
   - 3a `lifecycle_formula` (điện gia dụng): E_emb + L·(AEC·EF_VN + R_leak) + E_eol; EF_VN = `CO2_GRID_EF` 0,681; AEC: nhãn → công suất → mặc định loại (`green/co2_formula.py::CATEGORY_PARAMS`) · 0,25–0,35.
   - 3b `category_model`: trung vị loại (hoặc hãng nếu ≥3 mẫu) × (inch/ref)^b; màn hình b=0,81 ref 23,8"; laptop b=0,53 ref 14" · 0,35.
   - 3c `eeio_price`: giá ÷ 25.900 × (292,655/336,940) × hệ số US EPA (`green/data/eeio_factors.json`) · 0,15.
4. Không gì áp dụng → NULL (không đoán).
- Mỗi bước lưu `co2e_detail` (JSON số của phương pháp) + `co2e_breakdown` (JSON tách giai đoạn) + `co2e_references` (name, kg, cosine, source).
- **Điểm xanh 0–5**: `db-search/green_score.py` = 5·ln(U/c)/ln(U/L), bounds `CATEGORY_BOUNDS`.
- **Hiển thị**: `green/explain.py` (công thức thế số, dựng lại được cho dòng cũ với formula/eeio) + `green/lifecycle.py` (formula → tách đúng, vận chuyển = khối lượng × km × hệ số; nguồn khác → tỷ lệ điển hình `green/data/stage_shares.json`, nhãn "giả định"). Tổng luôn = `co2e_kg` (YC-5).
- Danh sách mẫu: `etl-worker/data/seed/carbon_reference_seed_expanded.json` (1.450 dòng: laptop 587, màn hình 330, desktop 238, phone 100…), có `source_url` (link báo cáo, 1.449/1.450) và `verification` lấy từ dataset 10.000 dòng. Seeder nạp lại khi **nội dung** đổi (hash).
- Dataset nhóm: `data/co2-catalogue/danh_sach_10000_san_pham_co2.csv` (bản xuất Google Sheet; 7.406 có số). 8.550 dòng Amazon là số do mô hình tính → **không** dùng làm mẫu. Script: `scripts/research/enrich_seed_from_dataset.py`.
- `green/focus.py` + `green_score.py` (GreenScore 0–100 kiểu cũ) vẫn dùng ở endpoint `/assistant` cũ.

## 4. Kết quả đo (để trích trong bài)
| Thử nghiệm | Số |
|---|---|
| 28 SP thật, nhóm A (loại đã có mẫu) | sai ~20–22 %, Spearman 0,95, 0 SP lệch >2× |
| Bỏ ngưỡng 0,66, nhóm B | 9/12 lệch >2× → ngưỡng bắt buộc |
| LLM đoán số vs trung bình mẫu giống | MAE 77,2 vs 68,0 kg |
| Leave-one-family-out 1.450 mẫu (**chạy lại trong repo**, `scripts/research/eval_co2_methods.py`) | category model MdAPE **20,9 %** (màn hình 13,8, phone 13,7, laptop 22,6, desktop 22,2); trung vị loại 24,1 %; đúng thứ tự cặp trong loại chỉ ~55 % → CO₂ chỉ nên phá thế hòa. Số cũ 18,5 % (script ngoài repo) không tái lập được |
| Độ phủ 10.000 SP | 7.406 (74 %) có số |
| Daikin 1,5 HP 820 kWh/năm | 6.297 kg (lưới 0,681) / 6.118 kg (0,6592) |
Chi tiết: [research/results-co2-eval.md](research/results-co2-eval.md), dữ liệu thô `research/data/co2-eval-2026-11-23.*`.

## 5. API demo (đầy đủ: [demo/api-contract.md](demo/api-contract.md))
- **Tìm kiếm thật** `GET /api/search` (db-search `search_api.py`): hiểu danh mục / hãng (kể cả iPhone→Apple) / ngân sách / "ít CO₂" từ câu (vi/en/fr, `search_query.py`), từ còn lại phải có trong tên (không dấu, Postgres `unaccent`); danh mục chưa có (điều hòa, tủ lạnh…) → `unsupported`, 0 kết quả; bộ lọc + facets có số đếm; giá 0 = chưa có giá (null), CO₂ thiếu luôn xếp cuối; 0 kết quả → `relaxations` để người dùng tự chọn; phụ kiện bị xếp nhầm danh mục (miếng dán, RAM…) ẩn mặc định kèm số lượng. `GET /api/categories`: số thật theo danh mục.
- Frontend chuẩn hóa dữ liệu thiếu ở `src/lib/data.js`; thẻ sản phẩm chung `components/common/ProductCard.jsx`; trạng thái trống/lỗi/tải `components/common/States.jsx`; so sánh `lib/compare.js` (tối đa 4); chuỗi riêng từng nhóm trang: `i18n/shop.js`, `i18n/explore.js`.
- `POST /api/assistant {message, lang, parent_id}` → `{id, url, page}`; `GET /api/assistant/{id}`.
- `GET /api/products/{id}/co2` (formula + lifecycle + references có `url` + `green_score_formula` {low, high, score})
- `GET /api/search` thêm `has_image=true` — **chỉ để chọn ảnh minh họa trên giao diện**, không đụng vào CLIP/CO₂ (xem `docs/IMAGE_REPLACEMENTS.md`).
- Gợi ý "món xanh hơn" phải **còn dùng được cho cùng nhu cầu**: `db-search/fitness.py` loại máy không-gaming thay cho máy gaming, chip phổ thông thay cho máy thường, RAM thấp hơn, màn nhỏ hơn 2 inch., `/related`, `GET /api/categories/{cat}/stats`, `GET /api/compare?ids=`, `GET /api/method`.
- `POST /api/orders/test` → `awaiting_confirmation`; `POST …/{id}/confirm` **bắt buộc header `X-Confirm-Source: web-ui`** (chặn theo chính sách, không phải bảo mật thật); `…/cancel`; `CHECKOUT_MODE` ≠ `test` → assistant không khởi động.
- Trang AI (`assistant/pages.py::build_page`): plan (Claude hoặc `heuristic_plan` từ khóa) → search → `shortlist` (cùng loại, CO₂ thấp trước, thiếu số ở giữa) → stats/savings → Claude trả **layout + chữ có placeholder** `{{p1.co2e_kg}}` (`assistant_llm.compose_page`, structured output, `fallbacks="default"`) → `page_spec.fill_text` thay số thật, câu có số viết tay bị loại (`number_check_failures`) → chart Vega-Lite do server dựng (`co2_bar`, `price_vs_co2`, `lifecycle_stack`). Không có key/timeout → trang rule-based + warning.
- Lưu trữ `assistant/store.py`: Postgres (bảng assistant_page, test_order, test_order_item, test_order_event) nếu có `POSTGRES_URL`, không thì bộ nhớ. SQLAlchemy import lười.

## 6. Frontend (route trong `src/App.jsx`)
`/` (ô Hỏi AI) · `/search` · `/product/:id` (FormulaCard, LifecycleDiagram, món xanh hơn, nút Hỏi AI/So sánh/Giỏ) · `/assistant` (chữ + giọng nói, lịch sử) · `/assistant/:id` (`PageRenderer` + `components/assistant/sections/`) · `/compare?ids=` · `/method` (`src/i18n/method.js`) · `/cart` (localStorage) · `/checkout` (banner CHẾ ĐỘ THỬ, không có ô thẻ) · `/orders/:id`.
### Phương pháp CO₂ `/method` (2026-11-24, bản thiết kế "CO₂ method.pdf")

- `pages/Method.jsx` + `components/co2/MethodLadder.jsx` (thay MethodExplorer/MethodFlow/MathBits đã xoá). Thanh trên: chỉ tiêu đề trang.
- Đầu trang: "Một con số CO₂ được tính như thế nào", nút "Xem công thức chung", thẻ "Ví dụ đang xem · Đổi".
- "Thử với sản phẩm của bạn" (`?case=`): Công thức (ký hiệu) · ví dụ thật (`?product=`) · Có số công bố / Có sản phẩm tương tự
  (sản phẩm thật nguồn `manufacturer` / `neighbor_average`, ưu tiên cùng loại với ví dụ) · Không có dữ liệu (**minh họa**: trong danh
  mục hiện tại mọi sản phẩm đã tính đều dừng ở bậc 1–3) · "Nhập số liệu của riêng bạn" (cùng quy tắc, ghi rõ là minh họa).
  "Chạy minh họa" kiểm tra từng bậc (850 ms/bậc) rồi mới hiện kết quả.
- Thang 4 bậc khớp `etl-worker` (`carbon_estimator.py`): 1 đúng model 0,9 · 2 trung bình mẫu cosine ≥ 0,66 (≤ 5) 0,5 ·
  3 trung vị loại × (s ÷ s₀)^b 0,35 · ∅ để trống. Số trong ô lấy từ `formula.steps` của API, không tính lại.
- Thẻ Kết quả: kg, Ước tính/Hãng công bố, "Bậc n của 4", tin cậy, "Xem phép tính đầy đủ ↓" (#calc), ▶ thế giới CO₂, sách CO₂.
- Bên dưới: phép tính đầy đủ + vòng đời, "Những điều cần biết", "Chi tiết kỹ thuật" (mở sẵn, tên tiếng Việt theo thiết kế).
  Có nút robot Hỏi AI như Find products.

### Find products = tìm kiếm + Hỏi AI + sách CO₂ (2026-11-24, bản thiết kế "Khám phá hợp nhất.pdf")

- Menu: Overview · CO₂ world · **Find products** · CO₂ method · Compare (số món) · Cart & test orders · System. Mục "CO₂ book" và
  "Ask AI" bỏ khỏi menu; `/story`, `/story/:id`, `/assistant`, `/assistant/:id` vẫn chạy và làm sáng mục Find products
  (`NAV[].also` trong `AppShell.jsx`). Tab điện thoại: Overview · World · Find · Compare · Cart.
- Trang `/search` (`SearchResults.jsx`): ô tìm hiểu câu ("Laptop dưới 20 triệu, CO₂ thấp" → loại + giá + CO₂ thấp; nút ✦),
  chip danh mục (Laptop, Màn hình, Máy tính bảng trước), menu giá (dải 10/20/30/50 triệu) và sắp xếp ("CO₂ thấp" = `complete`),
  thẻ `components/find/FindCard.jsx` (tên ngắn `lib/shortName.js` + dòng cấu hình, ≈kg lớn, giá hoặc "—", nút **CO₂ book** →
  `/story/:id`, nút so sánh), khay `CompareBar.jsx` (n/4, bỏ từng món, → `/compare`), nút robot `AskAiDock.jsx` (hỏi AI → `/assistant/:id`;
  "Hỏi AI về câu này" điền sẵn câu đang tìm). Thanh trên của trang này là breadcrumb "Find products › …", không có ô tìm/biểu tượng.
- Ảnh sản phẩm: CDN cửa hàng trả 403 khi có Referer localhost (trình duyệt báo `ERR_BLOCKED_BY_ORB`) → `<img referrerPolicy="no-referrer">`.

### Bản thiết kế "CO₂ formula redesign (4).pdf" trang 2–9 (2026-11-24) — bố cục hiện hành

Mỗi trang bám theo một trang PDF; ô [PRICE]/[STORE]/[CO₂] trong bản vẽ được điền bằng dữ liệu thật.
- **Font/khung**: tiêu đề serif Fraunces (`--font-display`), chữ Be Vietnam Pro; nút ngôn ngữ EN/FR/VI không cờ.
- **p2 Overview `HowCalculated`**: `components/co2/ThreeSteps.jsx` (tìm mẫu giống → cộng → chia, ô kết quả xanh đậm),
  nút "See the N similar products" / "The other methods and their order". Ký hiệu toán: `co2/MathBits.jsx`.
- **p3 CO₂ world `/world/:id`**: thẻ đầu (tên serif, chip kg/điểm xanh/độ tin cậy/công thức/so với loại, link Book mode · Method),
  thẻ bản đồ (thanh công cụ What if / Guided explanation / ? + − ⤢, chân thẻ là thanh chặng), dưới là
  `GreenPanel lifestyleOnly` + `InsightCard`. Cảnh đi vào và ‹ › vẫn như cũ. Thay cho bố cục cũ ở mục dưới.
- **p4 Sách CO₂ `/story`**: `components/story/BookShelf.jsx` — tìm kiếm, kệ 3 cuốn của sản phẩm thật (xanh nhất mỗi loại,
  huy hiệu "Lowest CO₂ of N" khi greener_than_pct ≥ 99,5), ô danh mục. Flipbook `/story/:id` giữ nguyên.
- **p5 Phương pháp `/method`**: `MethodFlow.jsx` là thang 4 bậc (1/2/3/∅, Yes/No/Not needed, thanh độ tin cậy, bậc của sản phẩm
  mở ra với số thật), cột phải: Result, Green score, "Step into each stage", Read book / Enter world. Đầu trang: "Worked example · Change".
- **p6 Find products `/search`**: không còn cột lọc bên trái; chip danh mục có số đếm + "More filters" (ngăn kéo `SearchFilters`),
  chú thích "About the photos". Không gõ chữ thì sắp xếp `complete` (db-search `SORTS["complete"]`: đủ giá + CO₂ + ảnh riêng trước,
  rồi lần lượt món CO₂ thấp nhất của từng loại — `row_number() OVER (PARTITION BY category)`; chỉ sắp xếp, không lọc).
  Thẻ `common/ProductCard.jsx`: vùng ảnh xám, nhãn "Full info" (`hasFullInfo`: giá + CO₂ + ảnh riêng), nơi bán, viên CO₂ + nguồn ngắn,
  giá, nút so sánh/giỏ tròn. `ProductThumb tone="soft"`: ảnh thay thế ghi "Photo: <mẫu>" (cùng hãng, cùng loại, giá gần nhất).
- **p7 Ask AI `/assistant`**: ô "Say it in your own words" + Speak, lưới thiết bị, chip What for / Budget / What matters most,
  thanh "YOUR REQUEST" + "Find my device" (vẫn gọi `/api/assistant` → `/assistant/:id`). Mở sẵn yêu cầu mẫu
  (laptop · học/văn phòng · <20 triệu · CO₂ thấp) trừ khi có `?q=`. `components/assistant/WhatFits.jsx`: 3 món từ `/api/search`
  (CO₂ thấp trước, hoặc giá nếu chọn Low price); "Why it fits" chỉ ghi điều dữ liệu chứng minh (đúng loại, hạng CO₂, trong ngân sách).

- **Flipbook**: mọi cách đổi trang (góc trang, phím, nút Prev/Next, chấm trang, Autoplay, link trong sách) đều lật trang 3D;
  điện thoại lật từng trang (lá trang lật sang trái). `prefers-reduced-motion` thì đổi trang không hiệu ứng.
- **Ảnh thật trước**: mọi cách sắp xếp của db-search, khi bằng nhau, đặt sản phẩm có ảnh riêng trước (`_OWN_PHOTO`, chỉ sắp xếp);
  "Lowest CO₂" vẫn theo đúng CO₂ nên món không ảnh mà CO₂ thấp hơn vẫn đứng trước. Ask AI "What fits" lọc `has_image=true`.
- **CO₂ world đã đối chiếu API** (55051, laptop xanh nhất): kg, điểm xanh, độ tin cậy, các chặng (cộng lại = tổng), tuổi thọ
  (khớp `CategoryParams` ở `etl-worker/green/co2_formula.py`), món xanh hơn đều đúng. Ô "Materials" ghi "in production →"
  (đã gộp trong Production); thẻ AI insight ghi "Median of N in its category" (trung vị catalogue, khác trung vị báo cáo hãng
  trong công thức).

- **AI bằng GPT** (24/11): `OPENAI_API_KEY` trong `.env` gốc → assistant chạy `openai:gpt-5.4-mini` (`/api/health`).
  Bộ kiểm tra số (`page_spec.fill_text`) coi "CO2"/"CO2e" là ký hiệu, chấp nhận `{{…green_score}}/5`, nhận tên trường
  savings (`lifecycle_kg_saved`, `trees_year`), gộp "%%"; câu bị bỏ được ghi log `assistant: dropped a sentence`.
  Prompt gửi `placeholders` dạng tên → giá trị in ra. Smoke e2e với GPT thật: ALL OK, failures=0.
- **Khởi động lại dịch vụ**: luôn dùng `--no-deps` (thiếu nó Docker tạo lại cả database). db-search, ranking, etl-worker
  có `pool_pre_ping=True` nên tự nối lại khi database khởi động lại.

### Giao diện đã được duyệt — không thiết kế lại (2026-11-24, phần world đã thay bằng p3 ở trên)

- **CO₂ world** giữ đúng bố cục người dùng duyệt (bản gốc: `git show 31fd3bc:frontend/src/pages/World.jsx`):
  thẻ trái (tên, chip kg/điểm xanh/độ tin cậy/công thức/so với loại, "Book mode · Method", gợi ý bấm),
  bong bóng kg trên vòng lặp, thanh dưới `Materials | Production … | Total`, nhãn "Circular lifecycle", panel Sống xanh.
  Số từng chặng = tổng × tỷ lệ điển hình của loại khi `basis ≠ "formula"`: bong bóng ghi thêm "estimate", thanh dưới có title giải thích.
- **Sách CO₂** `/story/:id`: bìa cứng xanh, chiều cao theo màn hình (`useBookHeight`), hình có trần chiều cao
  (`.sb-paper svg[role=img]`), chừa chỗ số trang/góc lật; điện thoại: trang cao theo nội dung (không cuộn trong trang).
- **Ngôn ngữ**: tiếng Anh mặc định; `?lang=` chỉ áp dụng lượt xem đó, không lưu (khóa `spf.lang.v3`).

### CO₂ là trọng tâm (2026-11-23)

- **Overview** mở bằng `components/dashboard/Co2Spotlight.jsx` (cuốn sách CO₂ mở sẵn của một sản phẩm thật),
  rồi `HowCalculated` (công thức), sau đó mới tới tìm sản phẩm.
- **Sách CO₂** `/story/:id` (flipbook) có lại lối vào: menu bên trái, Overview, trang sản phẩm, khung đầu CO₂ world,
  trang Phương pháp. Các trang chặng trong sách theo cùng nguyên tắc: chỉ in kg từng chặng khi `basis = "formula"`.
- **CO₂ world**: bấm vật thể (mỏ, nhà máy, tàu, nhà, nhà máy điện, trạm tái chế) → phóng vào cảnh; ‹ › / vuốt / ←→ để nhảy
  qua lại; Esc để lùi. Lời trong cảnh theo tỷ lệ điển hình.
- **Phương pháp CO₂**: `components/co2/MethodFlow.jsx` — sơ đồ quyết định 3 câu hỏi → 3 cách tính → kết quả, đường
  của sản phẩm được tô sáng (mũi tên SVG có marker). `MethodExplorer.jsx` bọc sơ đồ bằng chính bộ cảnh của CO₂ world
  (`SceneNavigator` + `SceneView`, `?scene=`), nên bấm ô nào cũng bước vào cảnh tương ứng.

### Giải thích CO₂ dùng chung (2026-11-23)

- `frontend/src/lib/co2Formula.js` — `co2Explanation(co2, lang)` trả về: phương pháp, công thức
  (dạng ký hiệu + thế số, token hóa để tô màu biến), danh sách biến {nhãn, giá trị, đơn vị, ghi chú},
  nguồn tham chiếu, giới hạn. `category_model` **bỏ hệ số cỡ màn hình** khi `slope/screen_inch` null.
- `components/co2/Co2Explainer.jsx` — lớp 1 luôn hiện công thức + kết quả; lớp 2 (bấm "Xem cách tính"):
  nguồn dữ liệu → giá trị → thay số → kết quả & giới hạn + điểm xanh. Dùng ở Overview, trang sản phẩm,
  trang Phương pháp.
- `components/co2/WhyConsider.jsx` — "Vì sao đáng cân nhắc" (`POST /api/explain` topic `insight`),
  có nhãn khi là câu soạn từ dữ liệu (chưa có khóa AI). Dùng ở Overview, kết quả tìm, sản phẩm, so sánh.
- `components/co2/LifecycleJourney.jsx` + `lib/lifecycleText.js` — 4 giai đoạn, mỗi giai đoạn trả lời
  *là gì / vì sao phát thải / bạn làm được gì*. Khi `lifecycle.basis = "typical_share"` (toàn bộ catalogue
  hiện nay) thì **chỉ hiện tỷ lệ điển hình của loại**, không gán kg cho sản phẩm.
- `lib/needs.js` + `components/assistant/NeedPicker.jsx` — chọn nhanh thiết bị / mục đích / ngân sách /
  ưu tiên; `composeQuery` ghép thành câu mà parser backend hiểu (3 ngôn ngữ), `toSearchParams` ghép
  thành bộ lọc `/search`.
- `lib/categories.js` — một thứ tự danh mục cho cả site; `searchCategory()` đổi khóa CO₂ (`computer_monitor`)
  sang slug tìm kiếm (`monitors`). Thanh đo trong thẻ danh mục là **thang tuyến tính riêng từng loại**.
- `components/ui/DeviceIcon.jsx` + `deviceIconPaths.js` — 48 icon 24px (2 lớp, currentColor) trích từ
  bộ icon của dự án.
- `components/common/ProductThumb.jsx` + `lib/standInImage.js` — ảnh thật → ảnh cùng hãng cùng loại
  (nhãn "Ảnh minh họa") → icon thiết bị.

- **Thế giới CO₂** `/world`, `/world/:id` (trải nghiệm chính): **vòng khép kín** ① Sản xuất → ② Vận chuyển → ③ Sử dụng → ④ Thu hồi & tái chế → mũi tên "vật liệu thu hồi" quay về mỏ/nhà máy. Góc trái `FormulaHud.jsx`: công thức của đúng sản phẩm (ký hiệu + thế số + dải chấm các mẫu giống, rồi điểm xanh 5·ln(U/c)/ln(U/L)); thanh dưới là phương trình Sản xuất + Vận chuyển + Sử dụng + Thải bỏ = Tổng. Bên phải `GreenPanel.jsx` (≥1280px; nhỏ hơn là nút "Sống xanh"): chọn thiết bị ít CO₂ (món xanh hơn), dùng lâu hơn (CO₂/năm = tổng ÷ số năm, mô phỏng), mang đi tái chế (cảnh tái chế), "Nhận định AI" (`POST /api/explain` topic `insight`), vòng tuần hoàn. Khung nhìn ban đầu `home()` canh vòng lặp vào vùng trống giữa các thẻ. Helper `src/lib/co2Formula.js`. Trang Overview: `components/dashboard/FormulaSteps.jsx` (4 bước tính với từng thành phần tô màu + ví dụ thật). Bản đồ SVG kéo/phóng to, 5 chặng có xe/tàu/máy bay, bong bóng CO₂ theo kg, bấm vật thể bất kỳ → khung giải thích (`POST /api/explain`, câu soạn sẵn hoặc AI), nút "❓ hỏi bất kỳ chỗ nào", mô phỏng nếu-thì (nơi sản xuất, tàu/máy bay, lưới VN/điện mặt trời, số năm, máy tân trang; tính tương đối với số chính thức), tour "▶ Xem giải thích từng bước" kết thúc bằng phép tính hiện từng số. **Đi vào cảnh** (`components/world/scenes/`): bấm vật thể → phóng vào cảnh toàn màn hình của chặng (nguyên liệu, nhà máy, vận chuyển, sử dụng, thải bỏ, công thức, so với cùng loại); vòng sáng trong cảnh → cảnh con (chip, màn hình, pin, vỏ; tàu vs máy bay; lưới điện VN với hệ số IPCC; số năm dùng; rác điện tử; tái chế); kéo/vuốt ngang hoặc ←/→ sang chặng kế bên; Esc/thanh đường dẫn để lùi; `?scene=production/chip`. Deep link: `?focus=transport`, `?ask=factory`, `?origin=VN&mode=air&grid=solar&years=6&refurb=1&sim=1`, `?tour=1&step=6`. Code: `src/pages/World.jsx`, `components/world/`. Hình minh họa AI (tùy chọn): `python scripts/demo/generate_illustrations.py --yes` → `frontend/public/illustrations/` (chưa tạo; cần OPENAI_API_KEY).
- **Sách lật CO₂** `/story` (tìm sản phẩm) và `/story/:id` (12 trang: bìa, con số nghĩa là gì, bản đồ 5 chặng bấm được, sản xuất, vận chuyển, sử dụng, thải bỏ, công thức thế số, so với cùng loại, WEFE/đô thị thông minh, hành động, nguồn). `?p=N` mở thẳng trang N, `?auto=1` tự lật. Code: `src/pages/Story.jsx`, `components/story/` (Flipbook, Illustrations = SVG động theo dữ liệu, storyText = lời kể vi/en). Ví dụ demo: `/story/55051` (màn hình MSI 27", 544,4 kg = 491,5 × 1,108).
- API: `src/api/client.js`; **mock**: `VITE_MOCK_API=1` → `src/api/mock.js` (chạy demo không cần backend).
- `src/webmcp.js`: WebMCP (`navigator.modelContext`), 5 tool, không hỗ trợ thì bỏ qua.
- Chữ: `src/i18n/vi.json`, `en.json` (+178 key). Định dạng/màu điểm xanh: `src/lib/format.js`.

## 7. MCP / ChatGPT ([demo/mcp-chatgpt.md](demo/mcp-chatgpt.md))
Tool: `search_products`, `get_product_co2`, `compare_products`, `explain_co2_method`, `create_test_order` (không bao giờ gọi confirm). Rate limit `MCP_RATE_LIMIT_PER_MIN`, timeout 15 s, log JSON. Widget `ui://widget/products.html` (`text/html+skybridge`) + bản MCP Apps. Cần URL HTTPS công khai (ngrok/cloudflared) và tài khoản ChatGPT có Developer mode (nếu tài khoản hỗ trợ). Thanh toán thật trong ChatGPT ngoài phạm vi.

## 8. Biến môi trường chính
`.env` (root, từ `.env.example`): Airflow, `ANTHROPIC_API_KEY` (bí mật), `PUBLIC_WEB_URL`, `MCP_RATE_LIMIT_PER_MIN`.
`backend/.env.dev` (được commit, không để bí mật): Kafka topics, `POSTGRES_URL`, `*_URL` dịch vụ, `CO2E_*`, `CO2_GRID_EF`, `ASSISTANT_*`, `CHECKOUT_MODE=test`. Bảng đầy đủ: [co2-setup.md](co2-setup.md).

## 9. Test (không cần Docker)
| Lệnh | Số test |
|---|---|
| `etl-worker`: `pytest tests/test_exact_match.py tests/test_fallback.py tests/test_green.py tests/test_explain.py` | 52 |
| Toàn hệ thống (Docker đang chạy): `python scripts/demo/smoke_e2e.py` | 18 bước |
| `ranking_system`: `pytest test_rrf.py` | 6 |
| `assistant`: `pytest` (fake db-search + fake LLM; `test_api`/`test_explain_api` cần gói `anthropic`, chạy trong container) | 57 |
| `gateway`: `pytest tests` | 3 |
| `db-search`: `pytest tests/test_search_query.py tests/test_product_specs.py tests/test_accessory.py` | 14 |
| `mcp-server`: `pytest` | 17 |
| `frontend`: `npm run test` (vitest: dữ liệu thiếu, giỏ, so sánh, URL tìm kiếm, công thức CO₂, chọn nhanh) + `npm run build` | 44 |
- `etl-worker/tests/test_category_matcher.py`: 4 test `TestParserIntegration` **đã hỏng từ trước** (không liên quan CO₂).
- Đã chạy thật bằng Docker 23/11: dump 55.409 dòng → khử trùng còn 14.130, 7.389 có giá → backfill (`etl-worker/tools/backfill.py`) → 7.389/7.389 có CO₂ + FAISS. `scripts/demo/smoke_e2e.py`: 18/18 bước đạt (search, CO₂, related, stats, compare, trang AI, đơn thử, MCP).
- `npm run lint` hỏng sẵn vì repo không có `eslint.config.js`.

## 10. Bản đồ tài liệu
- `docs/co2-method/` — `01` bản nộp, `02` đặc tả kỹ thuật demo, `source/` tài liệu gốc 116 KB (có ảnh base64 ở cuối, đọc theo đoạn: dòng 1–537 nội dung, 539–1125 đặc tả).
- `docs/research/` — co2-formula, co2-fallback, co2-eeio-extension, co2-nhung-gi-moi, advisor-requirements (4 yêu cầu GVHD), results-co2-eval.
- `docs/demo/` — api-contract, mcp-chatgpt, video-script (3–5 phút, có phương án dự phòng mock).
- `scripts/research/` — `eval_co2_methods.py`, `audit_db_dump.py data/backups/pre_category_migration.dump`, `demo_queries.txt` (12 câu).

## 11. Việc còn mở (ưu tiên)
1. Đặt `OPENAI_API_KEY` (hoặc `ANTHROPIC_API_KEY`) trong `.env` rồi `docker compose -f docker-compose.dev.yml up -d assistant`; chạy `scripts/demo/generate_illustrations.py --yes` để có hình AI. Chi phí: [demo/chi-phi.md](demo/chi-phi.md). Trước đây: đặt `ANTHROPIC_API_KEY` trong `.env` để trang AI có lời giải thích do AI viết (hiện chạy chế độ câu mẫu); đo `number_check_failures` trên 12 câu demo.
2. A1: quét lại ngưỡng 0,66 với CLIP thật; A3: cào kWh/năm, công suất; A2: ≥5 số thật mỗi loại gia dụng.
3. A5: dấu "-" trong so khớp (còn 2 khớp nhầm), bỏ qua dung lượng 128/256GB. A6: `stage_share` thật thay tỷ lệ điển hình.
4. Thêm `assistant` + `mcp-server` vào `docker-compose.prod.*.yml` nếu demo trên máy chủ trường.
5. Đo `number_check_failures` và thời gian trang trên bộ 12 câu demo; quay video theo `docs/demo/video-script.md`.
