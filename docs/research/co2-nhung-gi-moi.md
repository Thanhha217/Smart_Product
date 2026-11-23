# Tính CO₂: có gì mới (23/11/2026)

So với tài liệu *Phương pháp tính CO₂ – bản chi tiết* (24/10/2026).

## 1. Tóm tắt nhanh

| Trước | Bây giờ |
|---|---|
| 121 sản phẩm mẫu | **1.450** sản phẩm mẫu (số thật của hãng) |
| Chưa có bước "trùng đúng mẫu" | **Đã có** |
| Qwen đoán số trước | Qwen **không đoán số** nữa |
| Không có mẫu giống thì để trống | Thử thêm **3 cách dự phòng**, hết cách mới để trống |
| Không biết số lấy từ mẫu nào | **Lưu tên các mẫu** đã dùng |
| Điểm xanh, xếp hạng CO₂ mới có trên giấy | **Đã chạy trên web** |

## 2. Cách tính một sản phẩm

Làm lần lượt từ trên xuống, ra số ở bước nào thì dừng ở bước đó.

1. **Trùng đúng mẫu**: tên sản phẩm chứa nguyên tên một mẫu, ví dụ "iPhone 15 128GB" → dùng luôn số của hãng.
2. **Sản phẩm giống**: AI so tên với 1.450 mẫu. Mẫu nào giống từ 66% trở lên thì lấy trung bình CO₂ của chúng.
3. **Không có mẫu giống**, thì tùy loại hàng:
   - **Đồ gia dụng** (máy lạnh, tủ lạnh, tivi…): tính theo điện tiêu thụ (Cách 1).
   - **Đồ điện tử có từ 4 mẫu trở lên**: lấy mức giữa của loại (Cách 2).
   - **Hàng khác** (quần áo, sách, mỹ phẩm…): tính theo giá bán (Cách 3).
4. **Không cách nào dùng được** → để trống.

AI chỉ dùng để tìm sản phẩm giống. Con số không bao giờ do AI tự đoán.

## 3. Ba cách dự phòng

### Cách 1: tính theo điện (đồ gia dụng)

CO₂ = sản xuất + số năm dùng × điện mỗi năm × 0,681 + thải bỏ

- 0,681 kg CO₂ cho mỗi kWh là hệ số lưới điện Việt Nam năm 2024.
- Điện mỗi năm lấy từ nhãn năng lượng. Không có nhãn thì tính theo công suất ghi trên máy, không có nữa thì lấy mức thường gặp của loại đó.
- Ví dụ: tivi 75 inch ra khoảng 1.970 kg. Samsung công bố 4 tivi 75 inch từ 982 đến 2.388 kg.

### Cách 2: mức giữa của loại (đồ điện tử)

1. Lấy con số ở giữa (trung vị) của cả loại. Ví dụ 330 màn hình có trung vị 491,5 kg.
2. Nếu hãng có từ 3 mẫu trở lên trong loại đó thì dùng mức riêng của hãng, vì mỗi hãng tính một kiểu (Apple thường thấp, Dell thường cao).
3. Riêng màn hình và laptop thì chỉnh thêm theo cỡ màn hình: màn hình to gấp đôi thì CO₂ tăng khoảng 1,75 lần.

| Sản phẩm | Cách tính | Kết quả |
|---|---|---|
| Màn hình Samsung 27" | 491,5 × (27 ÷ 23,8)^0,81 | 544 kg |
| Laptop Acer 15,6" | 255 (mức của Acer) × (15,6 ÷ 14)^0,53 | 270 kg |
| Chuột Logitech M240 | Mức của 40 sản phẩm Logitech | 7,4 kg |
| Đồng hồ Huawei | Mức của 30 đồng hồ | 24,5 kg |

Độ chính xác: sai khoảng 18% (màn hình chỉ 9%; đồng hồ, chuột, bàn phím, webcam khoảng 40%).

### Cách 3: tính theo giá bán (cách của bài P5)

CO₂ = giá (đ) ÷ 25.900 × (292,655 ÷ 336,940) × hệ số ngành

- 25.900 là tỷ giá đô-la. Phân số ở giữa đổi giá về năm 2022, vì hệ số của US EPA tính theo giá năm 2022.
- Ví dụ áo thun 199.000 đ: 199.000 ÷ 25.900 = 7,68 USD, đổi về giá 2022 còn 6,67 USD, nhân hệ số may mặc 0,12 = **0,8 kg**.
- Đây là cách thô nhất: không tính điện lúc dùng, và hàng đắt vì thương hiệu cũng bị tính nhiều CO₂ hơn. Vì vậy nó luôn là cách cuối cùng.

## 4. Mỗi con số đi kèm nguồn

| Số lấy từ đâu | Ghi trong hệ thống | Độ tin cậy |
|---|---|---|
| Trùng đúng mẫu | `manufacturer` | 0,9 |
| Trung bình mẫu giống | `neighbor_average` | 0,5 |
| Cách 1 – theo điện | `lifecycle_formula` | 0,25–0,35 |
| Cách 2 – mức giữa của loại | `category_model` | 0,35 |
| Cách 3 – theo giá | `eeio_price` | 0,15 |

Tên các mẫu đã dùng được lưu ở cột `co2e_references` để người đọc kiểm tra lại.

## 5. Trên web

- **Điểm xanh 0–5**, so trong cùng loại: điểm = 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L), trong đó L và U là mức thấp nhất và cao nhất hợp lý của loại.
- **Xếp hạng**: điểm = 1 ÷ (60 + hạng nhu cầu) + 0,2 × 1 ÷ (60 + hạng CO₂). Nhu cầu vẫn là chính, CO₂ chỉ giúp phá thế hòa.
- Trang sản phẩm hiện điểm xanh, nguồn số và các mẫu đã dùng.

## 6. Đã sửa trong lần này

| Việc | Trước | Sau |
|---|---|---|
| Bật 3 cách dự phòng | Chỉ bật ở máy dev | Bật mặc định (tắt bằng `CO2E_FALLBACK=0`) |
| Sản phẩm không có số CO₂ khi xếp hạng | Bị đẩy xuống cuối | Nhận hạng giữa (không được lợi, không bị phạt) |
| Khoảng L–U cho điểm xanh | Không khớp số thật (Apple Watch 8,1 kg nhỏ hơn mức thấp nhất 10; tivi 2.388 kg vượt mức cao nhất 800) | Nới ra cho khớp mọi số của hãng. Đồ gia dụng thì theo kết quả của Cách 1 |
| Hệ số lưới điện | Code dùng 0,6592 (năm 2023) | 0,681 (năm 2024), khớp tài liệu |
| Loại `earphone` | Còn 1 mẫu ghi `earphone` | Đổi thành `headphone` |
| Tài liệu cài đặt `co2-setup.md` | Còn ghi 121 mẫu | Cập nhật theo code hiện tại |

## 7. Danh sách 10.000 sản phẩm

Lấy 1.450 mẫu, thêm 8.550 sản phẩm từ Amazon rồi chạy cách tính trên. Kết quả: **7.406 sản phẩm có số (74%)**.

| Cách ra số | Số sản phẩm |
|---|---|
| Số của hãng (mẫu) | 1.450 |
| Trùng đúng mẫu | 33 |
| Trung bình mẫu giống | 398 |
| Cách 1 – theo điện | 52 |
| Cách 2 – mức giữa của loại | 2.271 |
| Cách 3 – theo giá | 3.202 |
| Để trống | 2.594 |

File: `carbon footprint/danh_sach_mau_10000_san_pham_CO2.xlsx`. Danh sách này được tính trước khi đổi hệ số lưới điện và khoảng L–U, nên các cột "cảnh báo" trong file đã cũ. Số ở đây do mô hình ước tính, chưa ai kiểm tra tay, nên **không được dùng làm mẫu**.

## 8. Việc còn lại

- Chạy lại thử nghiệm 28 sản phẩm với 1.450 mẫu và mô hình AI thật, rồi chỉnh lại ngưỡng 66% nếu cần.
- Tên tiếng Việt cho kết quả kém hơn tên tiếng Anh. Có thể dịch tên trước khi so.
- Bước "trùng đúng mẫu" so từng chữ: "iPhone 15 256GB" không khớp mẫu "iPhone 15 128GB".
- Số từ các cách khác nhau đang được so chung: số của hãng tính theo lưới điện nước ngoài, Cách 1 theo lưới điện Việt Nam, Cách 3 không tính điện. Web đã hiện nguồn số, nhưng cần nói rõ điều này trong bài báo.
- Hỏi ý kiến giáo viên: dùng các cách dự phòng có được không, hay chỉ giữ số của hãng?

Chi tiết hơn: [co2-fallback.md](co2-fallback.md) (3 cách dự phòng và thử nghiệm), [co2-formula.md](co2-formula.md) (công thức theo điện), [../co2-setup.md](../co2-setup.md) (cài đặt).
