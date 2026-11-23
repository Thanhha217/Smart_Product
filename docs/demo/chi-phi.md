# Chi phí các phần bổ sung (ước tính 23/11/2026)

Giá lấy từ các trang tổng hợp giá tháng 11/2026, **cần đối chiếu trang giá chính thức của OpenAI trước khi chi**.
Mặc định hệ thống dùng `OPENAI_MODEL=gpt-5.4-mini` (≈ 0,75 USD / 1 triệu token vào, 4,50 USD / 1 triệu token ra);
đổi model bằng biến môi trường nếu tài khoản dùng model khác.

| Phần | Cách tính | Ước tính |
|---|---|---|
| "Chọn đâu hỏi đó" (`/api/explain`) | ~1.500 token vào + ~350 token ra mỗi lần hỏi | ≈ 0,003 USD/lần · 1.000 lần ≈ 2,7 USD. Câu trả lời được cache: bấm lại cùng chỗ không tốn thêm |
| Trang kết quả do AI sinh (`/api/assistant`) | 1 lần lập kế hoạch + 1 lần dựng trang (~4.000 vào, ~1.000 ra) | ≈ 0,008 USD/trang · 200 câu hỏi demo ≈ 1,6 USD |
| Hình minh họa AI (12 cảnh, 1536×1024, `scripts/demo/generate_illustrations.py`) | chất lượng vừa / cao | ≈ 0,6 USD / ≈ 2,4 USD, **trả một lần**, ảnh lưu sẵn trong web |
| ChatGPT + MCP (đọc: tìm, so sánh, giải thích) | gói ChatGPT Plus/Pro, bật Developer mode | ≈ 20 USD/tháng (Plus). Plus/Pro chỉ dùng được connector **chỉ đọc** |
| ChatGPT + MCP có thao tác ghi (`create_test_order`) | gói Business/Enterprise/Edu | theo gói của tổ chức; không có thì demo đặt hàng thử trên web |
| Địa chỉ HTTPS công khai cho MCP | ngrok / Cloudflare Tunnel | 0 USD (gói miễn phí đủ cho demo) |
| Thanh toán thật trong ChatGPT | cần OpenAI và cổng thanh toán duyệt người bán | ngoài phạm vi; demo dùng đơn thử, không trừ tiền |

**Tổng cho một buổi demo + chuẩn bị:** khoảng 3–6 USD tiền API (gồm tạo hình một lần), cộng gói ChatGPT nếu muốn quay cảnh trong ChatGPT.

Không có khóa API thì mọi trang vẫn chạy: câu giải thích soạn sẵn có điền số thật, hình minh họa SVG.

Nguồn tham khảo giá: [BenchLM – OpenAI API pricing (11/2026)](https://benchlm.ai/openai/api-pricing),
[pricepertoken – GPT Image pricing](https://pricepertoken.com/gpt-image-pricing),
[OpenAI Help – Developer mode và MCP](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-client-support-in-chatgpt),
[Boomi – kết nối ChatGPT](https://help.boomi.com/docs/Atomsphere/Platform/Connect_chatgpt_setup).
