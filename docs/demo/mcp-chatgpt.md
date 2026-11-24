# Đưa CarbonSense AI vào ChatGPT bằng MCP (B2)

Mục tiêu: người dùng hỏi ngay trong ChatGPT ("laptop nào ít CO₂ dưới 20 triệu?"), ChatGPT gọi máy chủ MCP của nhóm
để lấy sản phẩm và số CO₂, rồi trả lời **đúng số trên web** kèm link về trang của nhóm.

Mã nguồn: [backend/services/mcp-server/](../../backend/services/mcp-server/) — `main.py` (máy chủ), `tools.py` (logic
công cụ), `widget.py` (giao diện thẻ sản phẩm), `tests/test_tools.py`.

## 1. Kiến trúc

```
ChatGPT / ứng dụng MCP ──HTTPS──▶ ngrok / cloudflared ──▶ mcp-server :8100 /mcp
                                                               │ (chỉ gọi lại, không tự tính CO₂)
                                                               ▼
                                                        gateway :8000  ──▶ db-search, assistant, ranking-system
```

- Giao thức: MCP qua **Streamable HTTP**, chế độ stateless, trả JSON; đường dẫn `/mcp`. Kiểm tra sống: `GET /healthz`.
- Thư viện: SDK MCP chính thức cho Python `mcp==2.3.0` (`MCPServer`, phần mở rộng MCP Apps).
- Máy chủ chỉ gọi gateway (`/query`, `/api/...` theo [api-contract.md](api-contract.md)), nên số CO₂ trong ChatGPT,
  trên web và trong cơ sở dữ liệu là một.

## 2. Công cụ

| Công cụ | Đầu vào | Trả về | Loại |
|---|---|---|---|
| `search_products` | `query`, `category?`, `max_price_vnd?`, `limit` (1–10), `create_page?` | Danh sách đã xếp hạng (nhu cầu là chính, CO₂ phá thế hòa): tên, giá, kg CO₂e, điểm xanh 0–5, nhãn nguồn, độ tin cậy, link `/product/{id}`; món ít CO₂ nhất; nếu `create_page=true` thì thêm link trang AI `/assistant/{id}` | chỉ đọc |
| `get_product_co2` | `product_id` | Số CO₂, nguồn, độ tin cậy, công thức đã thế số, các giai đoạn vòng đời, các mẫu đã dùng, link | chỉ đọc |
| `compare_products` | 2–4 `product_ids` | Bảng so sánh, ô tốt nhất mỗi dòng, câu kết luận, link `/compare?ids=` | chỉ đọc |
| `explain_co2_method` | — | Tóm tắt chuỗi tính (trùng mẫu → mẫu giống → công thức / mức giữa của loại / theo giá → để trống), link `/method`. Gateway chưa có `/api/method` thì dùng bản tóm tắt cài sẵn | chỉ đọc |
| `create_test_order` | `product_id`, `quantity` (1–5) | **Đơn thử** ở trạng thái `awaiting_confirmation` và link `/orders/{id}` để người dùng tự xác nhận | ghi (chế độ test) |

Mỗi kết quả có `structuredContent` (dữ liệu) và một đoạn chữ ngắn tiếng Việt luôn ghi **nhãn nguồn số**
(số của hãng / trung bình sản phẩm giống / công thức vòng đời / mức giữa của loại / theo giá bán) và **link** về web.
Sản phẩm chưa có số hiện "chưa có số CO₂", không có điểm xanh.

Quy tắc an toàn:
- Công cụ đọc dữ liệu được đánh dấu `readOnlyHint: true`; `create_test_order` là `readOnlyHint: false`.
- `create_test_order` gửi `created_by: "mcp"` và **không bao giờ** gọi `/confirm`; không có tham số nào nhận thẻ,
  tài khoản ngân hàng hay ví. Xác nhận chỉ làm được bằng nút trên web (test `test_create_test_order_never_confirms`).
- Giới hạn `MCP_RATE_LIMIT_PER_MIN` lần gọi mỗi phút (cửa sổ trượt, mặc định 30); mỗi lần gọi gateway tối đa 15 giây.
- Log mỗi lần gọi một dòng JSON: tên công cụ, tham số (cắt chuỗi dài), thời gian chạy, lỗi. Không log thông tin cá nhân.

### Giao diện trong khung chat (nếu ứng dụng hỗ trợ)

`search_products` và `compare_products` gắn một widget HTML tự chứa (không tải script ngoài) hiển thị thẻ sản phẩm:
giá, kg CO₂e, điểm xanh tô màu đỏ → xanh lá, nguồn số, link.

| Chuẩn | Khai báo trên công cụ | Tài nguyên |
|---|---|---|
| ChatGPT Apps SDK | `_meta["openai/outputTemplate"]` | `ui://widget/products.html` (`text/html+skybridge`), đọc `window.openai.toolOutput` |
| MCP Apps (`io.modelcontextprotocol/ui`) | `_meta.ui.resourceUri` | `ui://widget/products-app.html` (`text/html;profile=mcp-app`), nhận `ui/notifications/tool-result` |

Ứng dụng không hỗ trợ widget vẫn nhận đủ chữ và dữ liệu.

## 3. Chạy

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `GATEWAY_URL` | `http://smartproductfinder-backend-gateway:8000` | Địa chỉ gateway |
| `PUBLIC_WEB_URL` | `http://localhost:5173` | Gốc của link trả cho người dùng. Khi demo qua đường hầm, đặt bằng địa chỉ công khai của frontend |
| `MCP_RATE_LIMIT_PER_MIN` | `30` | Số lần gọi tối đa mỗi phút (0 = tắt) |
| `MCP_TIMEOUT_S` | `15` | Thời gian chờ mỗi lần gọi gateway (tối đa 15) |

### Bằng Docker Compose

```bash
docker compose -f docker-compose.dev.yml up -d --build mcp-server
curl http://localhost:8100/healthz
```

### Chạy riêng (không Docker)

```bash
cd backend/services/mcp-server
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest                               # 17 test, gateway giả lập, không cần mạng
GATEWAY_URL=http://localhost:8000 uvicorn main:app --host 0.0.0.0 --port 8100
```

### Kiểm tra bằng MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP, URL: http://localhost:8100/mcp → List Tools → gọi thử search_products
```

## 4. Mở địa chỉ HTTPS công khai

ChatGPT chỉ kết nối được tới địa chỉ HTTPS công khai.

```bash
ngrok http 8100                       # → https://<tên>.ngrok-free.app
# hoặc
cloudflared tunnel --url http://localhost:8100
```

URL MCP là `https://<địa-chỉ>/mcp`. Nếu muốn link trong câu trả lời mở được từ máy khác, mở thêm một đường hầm cho
frontend (cổng 5173) và đặt `PUBLIC_WEB_URL` bằng địa chỉ đó; gateway cũng phải truy cập được từ trình duyệt đó
(`VITE_GATEWAY_URL` khi build frontend).

## 5. Thêm vào ChatGPT

Tính năng kết nối MCP tùy chỉnh phụ thuộc gói tài khoản và có thể thay đổi; các bước dưới đây áp dụng **nếu tài
khoản hỗ trợ** chế độ dành cho nhà phát triển:

1. ChatGPT → **Settings → Apps & Connectors → Advanced → bật Developer mode**.
2. **Create** (tạo connector/app mới): tên "CarbonSense AI", URL `https://<địa-chỉ>/mcp`, xác thực **No authentication**.
3. Trong cuộc trò chuyện mới, chọn connector vừa tạo (menu "+" / Developer mode) rồi hỏi.

Không có tài khoản phù hợp thì dùng ứng dụng khác hỗ trợ MCP từ xa:
- **MCP Inspector** (ở trên) để quay màn hình từng lần gọi công cụ.
- **claude.ai / Claude Desktop**: Settings → Connectors → Add custom connector → dán `https://<địa-chỉ>/mcp`.
- Hoặc chỉ demo trên web (trang `/assistant`).

## 6. Kịch bản demo

1. "Laptop nào ít CO₂ dưới 20 triệu?" → ChatGPT gọi `search_products(query="laptop", max_price_vnd=20000000)`.
   Kiểm tra: số kg CO₂e và nhãn nguồn trong câu trả lời trùng với trang `/product/{id}` trên web.
2. "Vì sao máy đó ra con số này?" → `get_product_co2` → công thức đã thế số (ví dụ `491,5 × (27 ÷ 23,8)^0,81 = 544 kg`)
   và các giai đoạn vòng đời.
3. "So sánh 3 máy đầu" → `compare_products` → link `/compare?ids=...`.
4. "Đặt mua máy xanh nhất" → `create_test_order` → ChatGPT trả link `/orders/{id}`; người dùng mở link, thấy dải
   "CHẾ ĐỘ THỬ – không trừ tiền thật", bấm **Xác nhận đặt hàng (thử)**.
5. "Tạo trang phân tích cho câu hỏi này" → `search_products(..., create_page=true)` → link trang AI `/assistant/{id}`.

Tiêu chí đạt: ở bước 1, ChatGPT gọi `search_products` và trả lời đúng số trên web của nhóm.

## 6b. "AI mua giúp" (2026-11-24)

Cùng một quy trình chạy ở ba nơi, đều **dừng ở đơn thử chờ người duyệt**, không trừ tiền:

| Nơi | Cách gọi | Ghi chú |
|---|---|---|
| Web `/cart?tab=ai` | Nút "Giao cho AI" | Hiện 5 bước: tìm → so sánh giá và CO₂ → CO₂ giảm khi bán máy cũ → tạo đơn thử → chờ duyệt |
| WebMCP (agent trong trình duyệt có `navigator.modelContext`) | công cụ `buy_for_me` | Cùng hàm `frontend/src/lib/aiBuyer.js` (`planPurchase`), mở trang đơn để người duyệt |
| ChatGPT (MCP) | ChatGPT tự nối `search_products` → `compare_products` → `create_test_order` | Câu mẫu: "Mua giúp tôi laptop ít CO₂ nhất dưới 20 triệu" → link `/orders/{id}` để bấm xác nhận |

Đơn do AI tạo ghi "Tạo bởi: trợ lý AI" (`created_by: assistant` hoặc `mcp`); chỉ nút trên web xác nhận được
(`X-Confirm-Source: web-ui`, kiểm ở `assistant/orders.py`).

### Kết nối ChatGPT nhanh trên Windows

1. Chạy hệ thống (`docker compose -f docker-compose.dev.yml up -d`), kiểm tra `curl http://localhost:8100/healthz`.
2. Mở đường hầm HTTPS: `cloudflared tunnel --url http://localhost:8100` (hoặc `ngrok http 8100`), ghi lại địa chỉ `https://….trycloudflare.com`.
3. ChatGPT → Settings → Apps & Connectors → Advanced → bật **Developer mode** → **Create**: URL `https://…/mcp`, No authentication.
4. Cuộc trò chuyện mới → chọn connector → hỏi theo kịch bản ở mục 6.

Tìm kiếm theo nghĩa (`/query`) từng mất 10–17 giây vì dịch vụ xếp hạng chờ Ollama viết câu lý do (luôn quá 10 giây trên CPU),
nên công cụ MCP (giới hạn 15 giây) bị quá thời gian. `backend/.env.dev` đặt `RANKING_LLM_EXPLANATIONS="0"` (dùng câu lý do theo
quy tắc): `/query` còn ~0,3 giây. Bật lại bằng `"1"`; chỉnh thời gian chờ bằng `RANKING_LLM_TIMEOUT_S`.

## 7. Về thanh toán trong ChatGPT

Thanh toán thật bên trong ChatGPT (Instant Checkout theo Agentic Commerce Protocol) đòi hỏi người bán được OpenAI và
nhà cung cấp thanh toán duyệt, nên **nằm ngoài phạm vi đề tài**. Nhóm chưa xác nhận được có sản phẩm "ChatGPT Wallet"
mở cho bên ngoài hay không. Demo dùng **đơn hàng thử**: AI chỉ tạo đơn đến bước chờ xác nhận, người dùng xác nhận trên
web, không trừ tiền, không nhập thẻ.

## 8. Những gì máy chủ cần từ gateway

| Gateway | Dùng cho |
|---|---|
| `POST /query?q=&limit=` | `search_products` (đọc cả dạng `{"products": {"products": [...]}}` lẫn `{"products": [...]}`) |
| `POST /api/assistant` | `search_products(create_page=true)`, cần trả `url` |
| `GET /api/products/{id}/co2` | `get_product_co2` |
| `GET /api/compare?ids=` | `compare_products` |
| `GET /api/method` | `explain_co2_method` (không có thì dùng bản cài sẵn) |
| `POST /api/orders/test` | `create_test_order`, cần trả `id`, `status`, `total_vnd`, `total_co2e_kg`, `saved_co2e_kg` |

Lỗi 404 / lỗi mạng của gateway được trả về cho ChatGPT dưới dạng lỗi công cụ có câu giải thích, máy chủ không dừng.
