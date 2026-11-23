# Đặc tả kỹ thuật: cải thiện công thức CO₂ và demo

*Đi kèm [bản nộp "Công thức tính CO₂"](01-ban-nop-cong-thuc-co2.md).*

- Dự án: Smart Product Finder.
- Repo: `Thanhha217/Smart_Product`, nhánh gốc `main`. Các việc B1–B3 đang làm trên nhánh `feature/co2-submission-demo`.
- Cập nhật: 23/11/2026.
- Hợp đồng API chi tiết (kiểu dữ liệu, page spec, đơn thử): **[../demo/api-contract.md](../demo/api-contract.md)**.

**Ký hiệu trạng thái:**

| Ký hiệu | Nghĩa |
|---|---|
| **[Có]** | Đã có trong code của `main` |
| **[Sửa]** | Có rồi, cần sửa |
| **[Mới]** | Cần làm mới |
| **[Đang làm]** | Đang làm trên nhánh `feature/co2-submission-demo` |
| *(đề xuất)* | Tên hoặc giá trị nhóm tự chọn, có thể đổi |

---

## 1. Phạm vi

| Mã | Việc | Ghi chú |
|---|---|---|
| A1–A8 | Cải thiện công thức CO₂ | Bắt buộc A1, A2, A3, A5. Xem §10 |
| B1 | Web: trang kết quả do AI sinh, trang So sánh, trang Phương pháp | Bắt buộc cho video demo. **[Đang làm]** |
| B2 | MCP server cho ChatGPT | Làm nếu có tài khoản và địa chỉ công khai. **[Đang làm]** |
| B3 | AI so sánh rồi đặt mua ở chế độ thử | Không thanh toán thật. **[Đang làm]** |

**Ngoài phạm vi:**

- Thanh toán thật, ví thật, thẻ thật.
- Đăng nhập và tài khoản người dùng.
- Ứng dụng di động riêng.

## 2. B1 – Demo trên web: AI tự sinh trang kết quả

### 2.1 Luồng sử dụng

1. Người dùng gõ hoặc nói câu hỏi. Ví dụ: "Tìm laptop dưới 20 triệu để học, ít phát thải".
2. AI hiểu câu hỏi và lập kế hoạch tìm kiếm: loại hàng, khoảng giá, nhu cầu.
3. Hệ thống tìm sản phẩm và xếp hạng theo nhu cầu và CO₂. Sau đó lấy số CO₂ và các giai đoạn đã tính sẵn trong cơ sở dữ liệu.
4. AI chọn các phần cần hiển thị, chọn loại biểu đồ và viết lời giải thích. Hệ thống ghép dữ liệu thật vào để thành **một trang hoàn chỉnh**.
5. Người dùng xem, so sánh, hỏi tiếp, hoặc thêm vào giỏ hàng thử.

**Nền có sẵn [Có]:** trang `/assistant` và dịch vụ `assistant` (AI lập kế hoạch → tìm kiếm → tính CO₂ → vẽ biểu đồ Vega-Lite).

### 2.2 Danh sách trang

| Trang | Đường dẫn | Trạng thái | Dùng để |
|---|---|---|---|
| Trang chủ | `/` | [Sửa] | Thêm ô "Hỏi AI" và các câu hỏi gợi ý |
| Hỏi AI | `/assistant` | [Sửa] | Nhập câu hỏi bằng chữ hoặc giọng nói, xem lịch sử hỏi |
| **Trang kết quả do AI sinh** | `/assistant/:id` | [Mới] | Trang hoàn chỉnh cho một câu hỏi, có đường dẫn riêng để chia sẻ và mở lại |
| Kết quả tìm kiếm | `/search` | [Sửa] | Thêm bộ lọc "điểm xanh ≥ …" và nhãn nguồn số trên mỗi thẻ |
| Chi tiết sản phẩm | `/product/:productId` | [Sửa] | Thêm các giai đoạn vòng đời, món thay thế xanh hơn, nút "Hỏi AI về sản phẩm này" |
| **So sánh** | `/compare?ids=…` | [Mới] | So 2–4 sản phẩm cạnh nhau |
| **Phương pháp tính CO₂** | `/method` | [Mới] | Giải thích công thức cho người xem và hội đồng |
| **Giỏ hàng (thử)** | `/cart` | [Mới] | Xem §4 |
| **Thanh toán (thử)** | `/checkout` | [Mới] | Xem §4 |
| **Đơn hàng (thử)** | `/orders/:id` | [Mới] | Xem §4 |

### 2.3 Các phần của trang kết quả do AI sinh (`/assistant/:id`)

| # | Phần (`type`) | Nội dung | Dữ liệu lấy từ đâu |
|---|---|---|---|
| 1 | Câu trả lời ngắn (`summary`) | 2–3 câu trả lời thẳng câu hỏi: món đề xuất và lý do chính | AI viết, dựa trên số ở các phần bên dưới |
| 2 | Sản phẩm đề xuất (`recommendations`) | 3 thẻ: ảnh, tên, giá, nơi bán, kg CO₂, điểm xanh 0–5, nhãn nguồn, độ tin cậy | Cơ sở dữ liệu sản phẩm |
| 3 | Công thức áp dụng (`formula`) | Công thức của đúng cách đã dùng, **thế số thật vào từng bước**. Ví dụ 491,5 × (27 ÷ 23,8)^0,81 = 544 kg. Có nút "Xem cách tính" | `co2e_source`, `co2e_detail` |
| 4 | Vòng đời, từ nơi sản xuất đến tay người dùng (`lifecycle`) | 5 bước: nguyên liệu → sản xuất (nước sản xuất) → vận chuyển về Việt Nam → sử dụng tại Việt Nam (số năm, kWh/năm, lưới 0,681) → thải bỏ. Mỗi bước có số kg và %, kèm thanh chồng thể hiện tỷ lệ | Công thức theo điện: tách chính xác. Nguồn khác: tỷ lệ điển hình, ghi rõ "giả định". Xem bản nộp §2.8 |
| 5 | Biểu đồ so sánh (`chart`) | (a) Cột ngang `co2_bar`: kg CO₂ các ứng viên, tô màu theo điểm xanh. (b) Điểm `price_vs_co2`: giá – CO₂. (c) `lifecycle_stack` | Dữ liệu ứng viên |
| 6 | Thống kê trong loại (`category_stats`) | Món này xanh hơn bao nhiêu % sản phẩm cùng loại; trung vị và số sản phẩm của loại | Cơ sở dữ liệu |
| 7 | Tiết kiệm được (`savings`) | Chọn món xanh nhất thay vì món trung bình thì giảm bao nhiêu kg CO₂, kWh và tiền điện sau 6 và 12 tháng; quy ra số cây xanh hấp thụ trong một năm | `estimate_savings` |
| 8 | Vì sao nên chọn món ít CO₂ (`why_low_co2`) | 3–5 gạch đầu dòng, mỗi ý dẫn đúng con số ở trên, không dùng câu chung chung | AI viết, chỉ dùng chỗ giữ chỗ |
| 9 | Sản phẩm liên quan (`related`) | 4–6 món cùng loại, xếp theo điểm xanh; món thay thế xanh hơn ở giá gần nhau (±15 %) | Tìm kiếm và xếp hạng |
| 10 | Nguồn và giới hạn (`sources`) | Tên các mẫu đã dùng, nhãn nguồn, độ tin cậy, ghi chú giới hạn | `co2e_references` |
| 11 | Thanh hành động | Hỏi tiếp, So sánh, Xem chi tiết, Thêm vào giỏ (thử), Chia sẻ trang | – |

### 2.4 Trang So sánh (`/compare`)

- Bảng đặt các sản phẩm cạnh nhau, mỗi cột một sản phẩm. Các dòng: giá, CO₂, điểm xanh, nguồn số, độ tin cậy, cách tính, kWh/năm (nếu có), tiền điện mỗi năm, các giai đoạn vòng đời.
- Ô tốt nhất ở mỗi dòng được tô đậm. Bên dưới có một dòng kết luận dựng từ số trong bảng.
- Thêm hoặc bớt sản phẩm ngay trên trang, tối đa 4. Danh sách giữ trong đường dẫn.

### 2.5 Trang Phương pháp (`/method`)

- Sơ đồ chuỗi tính: trùng đúng mẫu → mẫu giống → công thức theo điện / mức giữa của loại / theo giá → để trống.
- Mỗi cách có công thức, một ví dụ tính tay, độ chính xác và nhãn nguồn.
- Bảng kết quả thử nghiệm và hạn chế, lấy từ bản nộp §5 và §7.

### 2.6 Yêu cầu chức năng

| Mã | Yêu cầu |
|---|---|
| YC-1 | Một câu hỏi tạo ra một trang có đường dẫn riêng (`/assistant/:id`), mở lại và chia sẻ được |
| YC-2 | Dịch vụ AI trả về **bản mô tả trang** (page spec) dạng JSON: danh sách phần, loại biểu đồ, lời giải thích. Giao diện dựng trang từ bản mô tả đó. AI không viết HTML trực tiếp |
| YC-3 | Mọi con số trên trang do hệ thống ghép từ dữ liệu thật. Lời AI viết chỉ được nhắc số qua chỗ giữ chỗ. Câu có số không khớp thì bị loại |
| YC-4 | Biểu đồ chỉ thuộc ba loại cho phép: `co2_bar`, `price_vs_co2`, `lifecycle_stack`. Vega-Lite do server dựng từ dữ liệu thật; nếu có mã do AI viết thì phải qua `chart_sanitizer` [Có] |
| YC-5 | Số CO₂ trên trang này giống hệt số trên trang chi tiết sản phẩm, vì cùng lấy từ cột `co2e_kg`, không tính lại |
| YC-6 | Hỏi tiếp trên cùng trang (ví dụ "còn loại rẻ hơn không?") thì tạo trang mới có `parent_id` |
| YC-7 | Có tiếng Việt và tiếng Anh; nhập được bằng giọng nói [Có] |
| YC-8 | Sản phẩm chưa có số: hiện "Chưa có số CO₂", không có điểm xanh, đứng giữa khi xếp theo CO₂ |

### 2.7 Yêu cầu phi chức năng

- Phần 1 và 2 hiện trong ≤ 5 giây; cả trang xong trong ≤ 20 giây. Trong lúc chờ, hiện khung trống.
- Dùng tốt ở màn hình rộng 375 px và 1440 px.
- Khi AI lỗi hoặc quá thời gian:
  - vẫn hiện danh sách sản phẩm và số CO₂, kèm `warnings: ["explanation_timeout"]`;
  - khi không có khóa API, trang mặc định được dựng theo luật (`meta.model = "rule-based"`).
- Ghi log câu hỏi, thời gian chạy và `number_check_failures`, để dùng trong phần đánh giá.

### 2.8 API phía sau

Chi tiết: [api-contract.md](../demo/api-contract.md).

| API | Trạng thái | Làm gì |
|---|---|---|
| `POST /api/assistant` | [Đang làm] | Nhận `{message, lang, parent_id}`, trả về `{id, url, page}` |
| `GET /api/assistant/{id}` | [Đang làm] | Mở lại trang đã tạo |
| `GET /api/products/{id}/co2` | [Đang làm] | Số CO₂, nguồn, độ tin cậy, công thức đã thế số, các giai đoạn, các mẫu đã dùng |
| `GET /api/products/{id}/related` | [Đang làm] | Sản phẩm liên quan và món thay thế xanh hơn |
| `GET /api/compare?ids=` | [Đang làm] | Dữ liệu cho trang So sánh |
| `GET /api/categories/{cat}/stats` | [Đang làm] | Trung vị, phân vị, số sản phẩm của loại |
| `GET /api/method` | [Đang làm] | Tóm tắt phương pháp, dùng cho MCP `explain_co2_method` |

## 3. B2 – Đưa vào ChatGPT bằng MCP

**Mục tiêu.** Người dùng hỏi ngay trong ChatGPT. ChatGPT gọi hệ thống của nhóm để lấy sản phẩm và số CO₂, rồi trả lời kèm link về trang kết quả.

**Các công cụ (tool) của MCP server:**

| Công cụ | Đầu vào | Trả về |
|---|---|---|
| `search_products` | câu hỏi, loại hàng, giá tối đa, số kết quả | Danh sách sản phẩm đã xếp hạng: tên, giá, kg CO₂, điểm xanh, nguồn, link |
| `get_product_co2` | mã sản phẩm | Số CO₂, cách tính, công thức đã thế số, các giai đoạn, các mẫu đã dùng |
| `compare_products` | 2–4 mã sản phẩm | Bảng so sánh và link trang `/compare` |
| `explain_co2_method` | (không có) | Tóm tắt phương pháp và link trang `/method` |
| `create_test_order` | mã sản phẩm, số lượng | Đơn hàng **thử** ở trạng thái chờ xác nhận, kèm link xác nhận (xem §4) |

**Yêu cầu:**

| Mục | Yêu cầu |
|---|---|
| Vị trí | Dịch vụ mới `backend/services/mcp-server/` [Đang làm], cổng 8100 *(đề xuất)*, chạy cùng docker-compose |
| Tính CO₂ | Chỉ gọi lại API của gateway (db-search, assistant), không tính CO₂ riêng |
| Thư viện | Python 3.12, SDK MCP chính thức cho Python, giao thức HTTP có streaming, đường dẫn `https://<địa-chỉ-công-khai>/mcp` |
| Đầu vào / ra | Mỗi công cụ có JSON Schema rõ ràng; kết quả có dữ liệu và url về trang của nhóm |
| Phân quyền | Công cụ đọc dữ liệu: công khai. `create_test_order` chỉ tạo đơn chờ xác nhận; người dùng bấm xác nhận trên web |
| Giới hạn | `MCP_RATE_LIMIT_PER_MIN` (mặc định 30); mỗi lần gọi chờ tối đa 15 giây |
| Log | Thời gian, tên công cụ, tham số (bỏ thông tin cá nhân), thời gian chạy, lỗi |
| Trả lời | Câu trả lời trong ChatGPT ghi rõ nguồn số và có link về trang của nhóm |
| Test | Gọi thử từng công cụ bằng công cụ kiểm tra MCP (MCP Inspector); pytest với gateway giả lập |
| Triển khai demo | `docker compose up mcp-server`, mở đường hầm HTTPS bằng ngrok hoặc Cloudflare Tunnel, rồi thêm vào ChatGPT ở chế độ dành cho nhà phát triển |

**Tiêu chí đạt:** trong ChatGPT hỏi "laptop nào ít CO₂ dưới 20 triệu". ChatGPT gọi `search_products` và trả lời đúng số trên web của nhóm.

**Rủi ro:** chưa chắc tài khoản của nhóm dùng được tính năng này. Nếu không được, quay demo bằng một ứng dụng khác hỗ trợ MCP, hoặc chỉ demo trên web.

## 4. B3 – AI tự so sánh rồi đặt mua ở chế độ thử

**Về "ChatGPT Wallet".** Nhóm chưa xác nhận được đây có phải một sản phẩm thanh toán đang mở cho bên ngoài hay không. Thanh toán thật trong ChatGPT thường đòi hỏi người bán được OpenAI duyệt, nằm ngoài phạm vi đề tài. Vì vậy demo dùng **thanh toán giả lập**: không trừ tiền thật, không nhập thẻ thật.

**Luồng:**

1. Người dùng: "Chọn giúp tôi máy lạnh 1 HP tiết kiệm điện nhất dưới 10 triệu rồi đặt mua."
2. AI so sánh các ứng viên, hiện bảng so sánh và đề xuất một món, kèm lý do theo CO₂, tiền điện và giá.
3. AI tạo đơn thử ở trạng thái `awaiting_confirmation`.
4. **Người dùng phải bấm "Xác nhận đặt hàng (thử)".** AI không được tự hoàn tất đơn.
5. Hệ thống chuyển đơn sang `confirmed_test` và hiện trang đơn hàng.

**Trạng thái đơn:**

```
draft → awaiting_confirmation → confirmed_test
                      ↘ cancelled
```

**Trang:**

| Trang | Các phần |
|---|---|
| Giỏ hàng `/cart` | Danh sách món, số lượng, giá; tổng CO₂ của giỏ; gợi ý "đổi sang món xanh hơn, tiết kiệm X kg CO₂"; nút Thanh toán |
| Thanh toán `/checkout` | Dải cảnh báo luôn hiện "CHẾ ĐỘ THỬ – không trừ tiền thật"; thông tin giao hàng mẫu; phương thức "Thanh toán giả lập"; tóm tắt đơn và CO₂; nút "Xác nhận đặt hàng (thử)" |
| Đơn hàng `/orders/:id` | Mã đơn thử, trạng thái, danh sách món; "Bạn đã chọn phương án giảm X kg CO₂ so với lựa chọn trung bình"; nút quay lại |

**Quy tắc:**

- `CHECKOUT_MODE` phải bằng `test`. Giá trị khác thì dịch vụ không khởi động.
- Không có trường nào nhận số thẻ hay tài khoản ngân hàng. Không gọi cổng thanh toán nào. Nếu muốn giống thật hơn, chỉ dùng chế độ test của cổng thanh toán (ví dụ thẻ test của Stripe).
- Mọi đơn đều gắn nhãn "thử", cả trong cơ sở dữ liệu lẫn trên giao diện.
- AI (assistant hoặc MCP) chỉ tạo đơn tới bước `awaiting_confirmation`. Bước xác nhận chỉ đi từ nút trên web (header `X-Confirm-Source: web-ui`).
- `saved_co2e_kg` = CO₂ của món trung bình trong loại (trung vị của loại) − CO₂ của món đã chọn.
- Ghi log mọi bước (`events`): AI đề xuất gì, người dùng xác nhận lúc nào.

## 5. Thứ tự làm và tiêu chí cho video demo

| Bước | Việc | Lý do |
|---|---|---|
| 1 | A1, A5 | Nhanh, cải thiện độ chính xác ngay, có số mới cho bản nộp |
| 2 | Trang kết quả do AI sinh, trang Phương pháp, trang So sánh | Phần chính của video demo |
| 3 | A2, A3 | Kiểm định công thức đồ gia dụng |
| 4 | Giỏ hàng, thanh toán và đơn hàng thử | Hoàn tất luồng "AI so sánh → đặt mua" |
| 5 | MCP cho ChatGPT | Phụ thuộc tài khoản và địa chỉ công khai |
| 6 | A4, A6, A7, A8 | Cải thiện thêm cho bài báo |

Kịch bản quay: [../demo/video-script.md](../demo/video-script.md).

## 6. Môi trường

### 6.1 Phần cứng

| Môi trường | CPU | RAM | Ổ đĩa trống | GPU |
|---|---|---|---|---|
| Máy dev (chạy đủ docker-compose) | ≥ 4 nhân | ≥ 16 GB (đề xuất) | ≥ 40 GB (image torch, CLIP, Ollama, Postgres) | Không bắt buộc |
| Máy chỉ chạy test CO₂ | Bất kỳ | 4 GB | 1 GB | Không |
| Máy demo / prod | ≥ 4 nhân | ≥ 16 GB | ≥ 60 GB | Không bắt buộc |

### 6.2 Phần mềm

| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| Hệ điều hành | Windows 10/11, macOS hoặc Linux | Windows cần Docker Desktop dùng WSL2 |
| Docker / Docker Compose | 29.x / v2.40 trở lên | Lệnh `docker compose` (v2) |
| Git | ≥ 2.40 | Cần `git merge-tree --write-tree` để thử gộp |
| Python | 3.12 | Chạy test ngoài Docker; mỗi dịch vụ có `requirements.txt` riêng |
| Node.js / npm | ≥ 20 | Frontend: React 19, Vite 6, Tailwind 4, react-router 7 [Có] |
| PostgreSQL | Theo image trong `docker-compose.dev.yml` | Truy cập qua SQLModel [Có] |
| Kafka, Redis, Airflow 3.2.1 | Theo compose | Cào dữ liệu và chuyển sang etl-worker [Có] |
| Mô hình so độ giống | OpenCLIP ViT-B-32 `laion2b_s34b_b79k`, open_clip_torch 3.3.0, FAISS | [Có] |
| Mô hình ngôn ngữ cho trang AI | Claude qua SDK `anthropic` | [Có] trong dịch vụ assistant; cần `ANTHROPIC_API_KEY`. Không có khóa thì dùng trang mặc định |
| Ollama + qwen3.5:0.8b | – | Không bắt buộc; chỉ dùng khi `CO2E_USE_LLM=1` |
| pytest | ≥ 8 | Test |
| Playwright *(đề xuất)* | Bản ổn định mới nhất | Test giao diện đầu–cuối |
| ngrok / Cloudflare Tunnel *(đề xuất)* | – | Địa chỉ HTTPS công khai cho MCP |

### 6.3 Các môi trường chạy

| Môi trường | File compose | File biến môi trường | Dữ liệu |
|---|---|---|---|
| dev | `docker-compose.dev.yml` | `.env` (chép từ `.env.example`) và `backend/.env.dev` | Dữ liệu cào thật, cơ sở dữ liệu cục bộ |
| demo *(đề xuất)* | `docker-compose.dev.yml` + `docker-compose.demo.yml` | `backend/.env.demo` (không commit) | Bản sao cơ sở dữ liệu đã chốt cho video |
| prod | `docker-compose.prod.*.yml` | `backend/.env.prod` (không commit) | Máy chủ thật |

### 6.4 Dịch vụ và cổng

| Dịch vụ | Cổng | Trạng thái | Việc |
|---|---|---|---|
| frontend | 5173 (compose) / 3000 (dev) | [Đang làm] | Thêm các trang mới |
| backend-gateway | 8000 | [Đang làm] | Thêm các đường dẫn `/api/...` |
| backend-etl-worker | 8001 | [Đang làm] | Tính CO₂ khi nhập sản phẩm; lưu thêm `co2e_detail` |
| db-search | 8061 | [Đang làm] | API sản phẩm liên quan và thống kê loại |
| ranking-system | 8008 | [Có] | Xếp hạng nhu cầu và CO₂ (`rrf.py`) |
| assistant | 8070 | [Đang làm] | Tạo page spec, lưu trang, đơn thử; đưa vào docker-compose |
| mcp-server | 8100 *(đề xuất)* | [Đang làm] | Cổng MCP cho ChatGPT |
| airflow-* | 8080 | [Sửa] | Bộ cào lấy thêm kWh/năm (A3) |
| kafka-ui | 8081 | [Có] | – |

### 6.5 Biến môi trường

| Biến | Dịch vụ | Mặc định | Trạng thái | Ý nghĩa |
|---|---|---|---|---|
| `POSTGRES_URL` | etl-worker, db-search, assistant | – | [Có] | Chuỗi kết nối cơ sở dữ liệu |
| `CO2E_FALLBACK` | etl-worker | 1 | [Có] | Bật các cách dự phòng |
| `CO2E_USE_LLM` | etl-worker | 0 | [Có] | Cho Qwen chỉnh số trung bình (chỉ để thí nghiệm) |
| `CO2_GRID_EF` | etl-worker, assistant | 0.681 | [Có] | Hệ số lưới điện Việt Nam |
| `CO2_VND_PER_USD`, `CO2_CPI_NOW` | etl-worker | 25900, 336.94 | [Có] | Dùng cho cách tính theo giá |
| `CO2E_SIM_THRESHOLD` | etl-worker | 0.66 | [Mới] | Ngưỡng giống; hiện đang ghi cứng trong code |
| `DB_SEARCH_URL` | assistant, gateway | – | [Có] | Địa chỉ db-search |
| `ANTHROPIC_API_KEY` | assistant | – | [Có] | Bí mật, không commit |
| `ASSISTANT_MAX_PRODUCTS` | assistant | 6 | [Có] | Số ứng viên đưa vào trang |
| `ASSISTANT_TIMEOUT_S` | assistant | 20 | [Mới] | Thời gian tối đa tạo trang |
| `ASSISTANT_URL` | gateway, mcp-server | – | [Có] / [Mới] | Địa chỉ dịch vụ assistant |
| `PUBLIC_WEB_URL` | mcp-server, assistant | `http://localhost:3000` | [Mới] | Dùng để tạo link trả về cho người dùng |
| `MCP_RATE_LIMIT_PER_MIN` | mcp-server | 30 | [Mới] | Giới hạn số lần gọi mỗi phút |
| `CHECKOUT_MODE` | assistant | test | [Mới] | Chỉ chấp nhận `test` |

**Quy tắc bí mật:**

- Không commit `.env`, `backend/.env.prod`, `backend/.env.demo` hay khóa API.
- Mọi biến mới phải thêm vào `.env.example` hoặc `backend/.env.dev` (với giá trị giả), và vào `docs/co2-setup.md`.

## 7. Mã nguồn, nhánh và quy ước

### 7.1 Nhánh

- Mỗi việc một nhánh tạo từ `main`: `feature/a1-threshold`, `feature/b1-ai-page`, `feature/b2-mcp`, `feature/b3-test-checkout`…
- Gộp vào `main` qua PR. Trước khi mở PR, chạy hết test và thử gộp bằng `git merge-tree --write-tree origin/main HEAD`.

### 7.2 Thư mục

| Thư mục / file | Nội dung |
|---|---|
| `backend/services/etl-worker/green/` | Logic tính CO₂ thuần (không gọi DB hay mạng), có test |
| `backend/services/etl-worker/data/process/carbon_estimator.py` | Thứ tự các bước tính |
| `backend/services/etl-worker/data/seed/` | Danh sách mẫu |
| `backend/services/etl-worker/tests/` | Test phần CO₂ |
| `backend/services/ranking_system/rrf.py` | Xếp hạng nhu cầu và CO₂ |
| `backend/services/db-search/` | Các API dữ liệu |
| `backend/services/assistant/` | Trang kết quả, API CO₂ / so sánh, đơn thử |
| `backend/services/mcp-server/` | [Đang làm] MCP server |
| `frontend/src/pages/` | Các trang |
| `frontend/src/pages/components/` | Thành phần giao diện dùng lại |
| `frontend/src/i18n/vi.json`, `en.json` | Chữ hiển thị (không viết chữ cứng trong code) |
| `scripts/research/` | Script thử nghiệm (`eval_co2_methods.py`, `audit_db_dump.py`), bộ câu hỏi demo |
| `docs/co2-method/` | Bản nộp, đặc tả và tài liệu gốc |
| `docs/research/` | Tài liệu phương pháp và kết quả thử nghiệm |
| `docs/demo/` | Hợp đồng API, kịch bản video |
| `paper/` | Bài báo LaTeX và hình |
| `data/backups/` | Bản sao cơ sở dữ liệu và migration SQL |

### 7.3 Quy ước code

**Python:**

- Có type hint cho mọi hàm.
- Logic tính toán để trong module thuần, không đọc biến môi trường hay DB bên trong hàm tính.
- Định dạng bằng `ruff format`, kiểm lỗi bằng `ruff check` *(đề xuất)*.

**React:**

- Mỗi phần của trang là một component.
- Dữ liệu lấy qua một file gọi API chung (`frontend/src/api/`).
- Không gọi AI trực tiếp từ trình duyệt.

**Số và đơn vị:**

- Trong code: kg CO₂e, số thực.
- Trên giao diện: làm tròn 1 chữ số thập phân nếu ≥ 1 kg, 2 chữ số nếu < 1 kg; định dạng kiểu Việt Nam (1.234,5).

**Commit:** tiêu đề tiếng Anh, bắt đầu bằng phạm vi (`CO2:`, `Web:`, `MCP:`, `Checkout:`); thân giải thích lý do.

**PR:** mô tả việc làm, cách test, ảnh chụp màn hình (nếu có giao diện), các biến môi trường mới.

## 8. Dữ liệu

### 8.1 Bảng `product` – cột mới

| Cột | Kiểu | Trạng thái | Ý nghĩa |
|---|---|---|---|
| `co2e_kg`, `co2e_source`, `co2e_confidence`, `co2e_explanation`, `co2e_explanation_vi`, `co2e_category`, `co2e_references` | – | [Có] | – |
| `co2e_breakdown` | JSON (chuỗi) | [Mới] | `{"materials_production": kg, "transport": kg, "use": kg, "end_of_life": kg, "basis": "formula" \| "manufacturer_share"}`; để trống nếu không tách được |
| `co2e_detail` | JSON (chuỗi) | [Đang làm] | Chi tiết cách tính để hiển thị công thức có thế số, ví dụ `{"category_median": 491.5, "brand": null, "inch": 27, "slope": 0.81, "ref_inch": 23.8}` |
| `energy_kwh_year` | số thực | [Mới] | Điện năng trên nhãn (A3) |
| `rated_power_w` | số thực | [Mới] | Công suất |
| `capacity` | chuỗi | [Mới] | Ví dụ "322 L", "9 kg", "1 HP" |
| `energy_stars` | số nguyên | [Mới] | Số sao trên nhãn năng lượng |

Thêm cột vào cơ sở dữ liệu đang chạy bằng `ALTER TABLE … ADD COLUMN IF NOT EXISTS` trong `data/__init__.py`, như các cột CO₂ trước. Không cần xóa volume.

### 8.2 Danh sách mẫu – trường mới

| Trường | Bắt buộc | Ý nghĩa |
|---|---|---|
| `name`, `brand`, `category`, `co2e_kg`, `scope`, `source` | Có | [Có] |
| `source_url` | Có, với mẫu mới | Link báo cáo gốc |
| `stage_share` | Không | `{"production": 0.78, "transport": 0.04, "use": 0.16, "end_of_life": 0.02}`, lấy từ báo cáo của hãng (A6) |
| `lifetime_years` | Không | Số năm dùng mà hãng giả định |

**Lưu ý [Sửa]:** bộ nạp hiện chỉ nạp lại khi **số dòng** thay đổi. Cần đổi sang so mã băm của file, để sửa một giá trị cũng được nạp lại.

### 8.3 Bảng mới

| Bảng | Cột chính | Dùng cho |
|---|---|---|
| `assistant_page` | id (UUID), created_at, query, lang, page_spec (JSON), product_ids (JSON), model, latency_ms, number_check_failures | B1: lưu trang để mở lại và để đánh giá |
| `test_order` | id (UUID), created_at, status, mode (luôn `test`), total_vnd, total_co2e_kg, saved_co2e_kg, created_by (user / assistant / mcp), confirmed_at | B3 |
| `test_order_item` | order_id, product_id, quantity, unit_price_vnd, co2e_kg | B3 |

## 9. Page spec do AI tạo

AI chỉ trả về JSON theo khuôn dưới đây. Hệ thống kiểm tra JSON rồi **thay mọi chỗ cần số bằng dữ liệu thật**. Bản đã gắn số mà frontend nhận được: xem [api-contract.md](../demo/api-contract.md).

```json
{
  "version": 1,
  "lang": "vi",
  "summary": "Gợi ý {{p1.name}} vì CO₂ chỉ {{p1.co2e_kg}} kg …",
  "sections": [
    {"type": "recommendations", "product_ids": ["p1", "p2", "p3"]},
    {"type": "formula", "product_id": "p1"},
    {"type": "lifecycle", "product_id": "p1"},
    {"type": "chart", "chart": "co2_bar", "product_ids": ["p1", "p2", "p3", "p4"]},
    {"type": "chart", "chart": "price_vs_co2", "product_ids": ["p1", "p2", "p3", "p4"]},
    {"type": "category_stats", "category": "laptop", "product_id": "p1"},
    {"type": "savings", "best_id": "p1", "baseline": "category_median", "horizons_months": [6, 12]},
    {"type": "why_low_co2", "bullets": ["… {{p1.co2e_kg}} kg so với {{p2.co2e_kg}} kg …"]},
    {"type": "related", "product_id": "p1"},
    {"type": "sources", "product_ids": ["p1", "p2", "p3"]}
  ]
}
```

**Quy tắc:**

- `type` chỉ được là một trong 10 loại trên. `chart` chỉ được là `co2_bar`, `price_vs_co2` hoặc `lifecycle_stack`.
- Trong lời viết, AI **chỉ được nhắc số bằng chỗ giữ chỗ**: `{{p1.co2e_kg}}`, `{{p1.price}}`, `{{p1.green_score}}`, `{{p1.name}}`, `{{savings.kg_12m}}`, `{{stats.median_kg}}`, `{{stats.greener_than_pct}}`.
- Câu có số viết tay (không qua chỗ giữ chỗ, và không nằm trong tên sản phẩm hay câu hỏi) thì bị loại, và bộ đếm `number_check_failures` tăng lên.
- `product_ids` phải nằm trong danh sách ứng viên đã tìm được.
- JSON sai khuôn thì thử lại 1 lần. Vẫn sai thì dựng trang mặc định từ dữ liệu.

## 10. Chi tiết kỹ thuật nhóm A

| Mã | Đầu vào | Script / file | Đầu ra | Lệnh chạy *(đề xuất)* |
|---|---|---|---|---|
| A1 | `test_products.csv` (28 sản phẩm, có link nguồn), danh sách 1.450 mẫu | `scripts/research/threshold_sweep.py` (chạy trong container etl-worker để dùng CLIP thật) | `docs/research/a1-threshold.md`, CSV theo từng ngưỡng, biểu đồ phân bố độ giống | `docker compose -f docker-compose.dev.yml exec backend-etl-worker python /app/scripts/threshold_sweep.py` |
| A2 | Báo cáo EPD/PCF của hãng | Thêm dòng vào `carbon_reference_seed_expanded.json` | ≥ 5 mẫu mỗi loại; `docs/research/a2-appliance-validation.md` | `pytest tests/test_fallback.py` và script so công thức với số thật |
| A3 | Trang sản phẩm Điện Máy Xanh, Thế Giới Di Động | Bộ cào `airflow/scrapers/scrapers/sites/dienmayxanh/`, `tgdd/` | Cột `energy_kwh_year`, `rated_power_w`, `capacity`, `energy_stars` | Chạy DAG cào; kiểm tra tỷ lệ có số. Hiện chưa bộ cào nào lấy các trường này |
| A4 | Bộ 28 sản phẩm, tên tiếng Việt | `scripts/research/vi_name_experiment.py` | Bảng so 3 cách: giữ nguyên, dịch, mô hình đa ngôn ngữ | Chạy trong container |
| A5 | – | `green/matching.py`, `tests/test_exact_match.py` | Bỏ qua dung lượng, chặn khớp nhầm phiên bản (S9+ → S9, xem [results-co2-eval.md](../research/results-co2-eval.md) §2.4) | `pytest tests/test_exact_match.py` |
| A6 | `stage_share` trong danh sách mẫu | `green/vn_use_phase.py` (mới) | Cột `co2e_breakdown`; số "theo lưới điện Việt Nam" | `pytest` |
| A7 | Bảng IO Việt Nam, kiểm kê khí nhà kính | `scripts/research/vn_io_factors.py` | `green/data/vn_io_factors.json` | – |
| A8 | `danh_sach_mau_10000_san_pham_CO2.xlsx` | `scripts/research/sample_for_review.py` | File 200 dòng để kiểm tra tay; `docs/research/a8-manual-review.md` | – |

Đã có: `scripts/research/eval_co2_methods.py`, kiểm định bỏ cả dòng máy trên 1.450 mẫu ([kết quả](../research/results-co2-eval.md)).

## 11. Kiểm thử

| Loại | Phạm vi | Công cụ | Yêu cầu |
|---|---|---|---|
| Đơn vị | `green/`, `rrf.py`, kiểm tra page spec, thay chỗ giữ chỗ bằng số, trạng thái đơn | pytest | Mọi hàm tính mới đều có test; 47 test hiện có phải luôn qua |
| API | db-search, assistant, mcp-server | pytest + httpx / TestClient của FastAPI | Mỗi API có test thành công, test lỗi 404, test đầu vào sai |
| AI | Page spec | pytest với câu trả lời AI giả lập | AI viết số tay → câu bị loại; JSON sai → trang mặc định |
| Đầu–cuối | Hỏi AI → trang kết quả → so sánh → giỏ hàng → đơn thử | Playwright *(đề xuất)* | Chạy được trên bản dựng demo |
| Thủ công | Kịch bản video | Danh sách kiểm tra | Chạy trọn kịch bản 3 lần liền không lỗi |

**Bộ câu hỏi demo cố định** (12 câu): [scripts/research/demo_queries.txt](../../scripts/research/demo_queries.txt).

## 12. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
|---|---|
| Tốc độ | Phần đầu trang kết quả ≤ 5 giây, cả trang ≤ 20 giây; API dữ liệu ≤ 1 giây; MCP mỗi lần gọi ≤ 15 giây |
| Ổn định | AI lỗi hoặc quá giờ thì vẫn hiện sản phẩm và số CO₂ |
| Đúng số | Số CO₂ giống nhau trên mọi trang, trong ChatGPT và trong cơ sở dữ liệu; `number_check_failures` của bộ câu hỏi demo bằng 0 |
| Bảo mật | Không commit bí mật; đơn hàng luôn ở chế độ thử; MCP không lộ dữ liệu nội bộ; kiểm tra mọi đầu vào |
| Riêng tư | Không lưu thông tin cá nhân; log chỉ giữ câu hỏi và số liệu kỹ thuật |
| Truy vết | Mỗi con số đều có nguồn, độ tin cậy, các mẫu đã dùng và link báo cáo |
| Dễ chạy lại | Máy mới: clone → `Copy-Item .env.example .env` → `docker compose up` là chạy được; test CO₂ chạy được không cần Docker |

## 13. Định nghĩa "xong" cho mỗi việc

- Code nằm trên nhánh riêng, đã gộp vào `main` qua PR, không xung đột.
- Có test mới, và mọi test cũ vẫn qua.
- Biến môi trường mới đã ghi vào `.env.example` / `backend/.env.dev` và `docs/co2-setup.md`.
- Việc nhóm A có tài liệu kết quả ở `docs/research/`, ghi số liệu và ngày chạy.
- Việc có giao diện có ảnh chụp màn hình trên PR, chạy được ở 375 px và 1440 px.
- Đã chạy thử trên một bản clone mới.

## 14. Rủi ro

| Rủi ro | Ảnh hưởng | Cách xử lý |
|---|---|---|
| Không có tài khoản ChatGPT cho phép thêm MCP | Không demo được B2 | Demo bằng ứng dụng khác hỗ trợ MCP, hoặc bỏ B2 |
| Hết lượt gọi hoặc hết tiền khóa API của AI | Trang kết quả không có lời giải thích | Có trang mặc định theo luật; lưu sẵn trang cho bộ câu hỏi demo |
| Ít báo cáo EPD cho đồ gia dụng | A2 không đủ 5 mẫu mỗi loại | Ghi rõ là giới hạn; dùng số trên nhãn năng lượng để kiểm phần điện |
| Trang bán hàng đổi giao diện | A3 cào hỏng | Test bộ cào theo trang mẫu đã lưu |
| Máy demo yếu | Trang chậm | Chạy trước, lưu sẵn trang; tắt các dịch vụ cào khi quay video |
