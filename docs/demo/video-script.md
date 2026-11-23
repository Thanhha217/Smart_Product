# Kịch bản video demo (3–5 phút)

Mục tiêu của video: cho thấy **công thức CO₂** chạy trên dữ liệu thật, và được dùng qua ba kênh:

1. trang web do AI sinh;
2. ChatGPT (MCP);
3. luồng AI so sánh rồi đặt mua ở chế độ thử.

Bộ câu hỏi dùng trong video: [scripts/research/demo_queries.txt](../../scripts/research/demo_queries.txt).

## Chuẩn bị (trước khi quay)

1. Khởi động hệ thống: `docker compose -f docker-compose.dev.yml up --build -d`.
   - Tắt các DAG cào trên Airflow để máy không bị chậm.
   - Kiểm tra ba địa chỉ mở được: frontend, gateway `http://localhost:8000/` và `GET /api/method`.
2. Đặt khóa `ANTHROPIC_API_KEY` cho dịch vụ assistant, truyền lúc chạy, không commit.
3. **Chạy trước cả 12 câu hỏi** để lưu sẵn trang. Sau đó:
   - ghi lại các đường dẫn `/assistant/<id>`;
   - kiểm tra `meta.number_check_failures = 0` trên mọi trang.
4. Với phần ChatGPT:
   - chạy `docker compose up mcp-server`;
   - mở đường hầm HTTPS: `ngrok http 8100`;
   - trong ChatGPT, bật chế độ dành cho nhà phát triển và thêm connector `https://<ngrok>/mcp`;
   - gọi thử `search_products` một lần.
5. Màn hình quay: 1440 px. Có thêm 1 cảnh ở 375 px để cho thấy trang dùng được trên điện thoại.
6. Chạy trọn kịch bản 3 lần liền không lỗi rồi mới quay bản chính.

## Các cảnh

| # | Thời lượng | Màn hình / thao tác | Lời thoại (gợi ý) |
|---|---|---|---|
| 1 | 0:00–0:20 | Trang chủ `/` | "Trên sàn Việt Nam, người mua không biết món nào thải ít CO₂ hơn. Smart Product Finder tự tính con số đó cho từng sản phẩm." |
| 2 | 0:20–0:55 | Trang `/method`: sơ đồ chuỗi tính | "Hệ thống thử lần lượt: trùng đúng mẫu của hãng → trung bình mẫu giống với ngưỡng 0,66 → công thức vòng đời theo lưới điện Việt Nam 0,681 / mức giữa của loại / theo giá. Không đủ căn cứ thì để trống. AI chỉ tìm sản phẩm giống, không tự đoán số." Lướt qua bảng kết quả: sai khoảng 20 %, Spearman 0,95 với loại có mẫu, 74 % của 10.000 sản phẩm có số |
| 3 | 0:55–1:50 | Ô "Hỏi AI", **nói bằng giọng**: "laptop dưới 20 triệu ít CO2 để học" → trang `/assistant/<id>` tải dần từng phần | Đọc phần trả lời ngắn → 3 thẻ đề xuất (kg CO₂, điểm xanh, nhãn nguồn) → **mở "Xem cách tính"**: công thức đã thế số → sơ đồ vòng đời từ nơi sản xuất đến tay người dùng (ghi rõ phần nào là giả định) → biểu đồ cột CO₂, biểu đồ giá – CO₂ → "xanh hơn X % laptop cùng loại" → tiết kiệm sau 6 và 12 tháng → nguồn và mẫu đã dùng |
| 4 | 1:50–2:15 | Gõ hỏi tiếp trên cùng trang: "còn loại rẻ hơn không?" | Trang mới có `parent_id` và đường dẫn riêng để chia sẻ |
| 5 | 2:15–2:45 | Câu "máy lạnh 1 HP tiết kiệm điện" → bấm **So sánh** → `/compare?ids=…` | Ô tốt nhất ở mỗi dòng được tô đậm; kWh/năm và tiền điện mỗi năm; câu kết luận dựng từ số |
| 6 | 2:45–3:30 | Câu "Chọn giúp tôi máy lạnh 1 HP tiết kiệm điện nhất dưới 10 triệu rồi đặt mua" → giỏ hàng → `/checkout` | Dải "CHẾ ĐỘ THỬ – không trừ tiền thật" luôn hiện. "AI chỉ tạo đơn chờ xác nhận; **người dùng phải tự bấm** Xác nhận." Bấm xác nhận → `/orders/<id>`: "Bạn đã giảm X kg CO₂ so với lựa chọn trung bình" |
| 7 | 3:30–4:20 | **ChatGPT**: "laptop nào ít CO₂ dưới 20 triệu?" | ChatGPT gọi `search_products`, trả lời kèm số kg, nguồn và link. Mở link → **cùng con số** trên web của nhóm. Hỏi tiếp "đặt thử cái đầu tiên" → `create_test_order` trả link xác nhận trên web |
| 8 | 4:20–4:45 | Trang `/product/<id>` ở màn hình 375 px | Điểm xanh, vòng đời, món thay thế xanh hơn, nút "Hỏi AI về sản phẩm này" |
| 9 | 4:45–5:00 | Kết | "Con số luôn truy về được nguồn. AI dùng để giải thích, không dùng để bịa số." |

## Câu hỏi dùng trong video

Đủ 12 câu nằm trong `demo_queries.txt`. Các câu quay chính:

1. laptop dưới 20 triệu ít CO2 để học (cảnh 3)
2. còn loại rẻ hơn không? (cảnh 4, hỏi tiếp)
3. máy lạnh 1 HP tiết kiệm điện (cảnh 5)
4. Chọn giúp tôi máy lạnh 1 HP tiết kiệm điện nhất dưới 10 triệu rồi đặt mua (cảnh 6)
5. laptop nào ít CO₂ dưới 20 triệu? (cảnh 7, ChatGPT)

Câu dự phòng, khi một câu ở trên cho kết quả xấu:

- màn hình 27 inch xanh nhất
- tủ lạnh 300 lít
- điện thoại pin trâu ít phát thải
- tivi 55 inch tiêu thụ điện thấp

## Kế hoạch dự phòng

| Sự cố | Cách xử lý khi quay |
|---|---|
| Khóa AI hết hạn mức hoặc lỗi | Trang vẫn dựng theo luật (`meta.model = "rule-based"`): có đủ số, công thức và biểu đồ, chỉ thiếu lời văn do AI viết. Ghi rõ trong lời thoại. Hoặc mở các trang đã lưu sẵn ở bước chuẩn bị 3 |
| Backend không chạy được trên máy quay | Chạy frontend ở chế độ giả lập: `VITE_MOCK_API=1 npm run dev`. Frontend dùng dữ liệu mẫu có sẵn để quay các cảnh 2–6 và 8. Nói rõ trong video là dữ liệu mẫu |
| Tài khoản ChatGPT không thêm được MCP | Quay cảnh 7 bằng MCP Inspector (`npx @modelcontextprotocol/inspector`) hoặc một ứng dụng khác hỗ trợ MCP. Nếu cũng không được, bỏ cảnh 7 và kéo dài cảnh 3 |
| ngrok bị chặn | Dùng Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8100`) |
| Trang chậm hơn 20 giây | Dùng trang đã lưu sẵn (`GET /api/assistant/<id>`) |
