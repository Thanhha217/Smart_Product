# Kết quả kiểm định các cách tính CO₂ (chạy lại ngày 23/11/2026)

Tài liệu này ghi kết quả một lần chạy lại thử nghiệm. Thử nghiệm dùng danh sách **1.450 sản phẩm có số CO₂ do hãng công bố** (`backend/services/etl-worker/data/seed/carbon_reference_seed_expanded.json`). Phần code được kiểm là code hiện tại của gói `green/` trên nhánh này.

## Cách chạy lại

```bash
# từ thư mục gốc repo, không cần Docker hay cơ sở dữ liệu (Python ≥ 3.12, chỉ thư viện chuẩn)
python scripts/research/eval_co2_methods.py --json docs/research/data/co2-eval-2026-11-23.json \
    > docs/research/data/co2-eval-2026-11-23.md
```

- Bản in đầy đủ của lần chạy: [data/co2-eval-2026-11-23.md](data/co2-eval-2026-11-23.md).
- Số liệu thô: [data/co2-eval-2026-11-23.json](data/co2-eval-2026-11-23.json).
- Lần chạy mất khoảng 12 giây trên máy dev.

## 1. Cách làm

**Bỏ cả dòng máy (leave-one-family-out).** Mỗi sản phẩm được đoán từ các sản phẩm còn lại. Trước khi đoán, cả *dòng máy* của nó bị bỏ ra, để model anh em không làm lộ đáp án.

- Dòng máy = hãng + từ đầu tiên của tên model sau tên hãng. Ví dụ mọi máy Dell "Latitude" là một dòng, mọi máy Apple "MacBook" là một dòng.
- Danh sách có 406 dòng máy.
- Có 1.435 sản phẩm được đoán. 15 sản phẩm còn lại thuộc loại có dưới 4 mẫu sau khi bỏ dòng máy, nên không đoán.

**Các cách được so sánh:**

| Mã | Cách | Mô tả |
|---|---|---|
| (a) | `category_median` | Trung vị CO₂ của cả loại |
| (b) | `brand_median` | Trung vị của hãng trong loại, nếu hãng còn ≥ 3 mẫu; nếu không thì dùng (a) |
| (c) | `category_model` | `green.fallback.category_model_estimate`: mức riêng của hãng và hệ số cỡ màn hình. Đây là code đang chạy |
| (c′) | `category_model_inch` | Như (c), nhưng tên dạng "27-inch" được viết lại thành "27 inch", giống cách các sàn Việt Nam ghi |

**Các chỉ số:**

| Chỉ số | Ý nghĩa |
|---|---|
| MdAPE | Trung vị của sai số phần trăm |
| MAPE | Trung bình của sai số phần trăm |
| Lệch > 2× | Tỷ lệ sản phẩm có số đoán lệch quá 2 lần so với số thật |
| Spearman | Tương quan thứ hạng giữa số đoán và số thật |
| Đúng thứ tự cặp | Lấy mọi cặp sản phẩm **cùng loại**, đếm tỷ lệ cặp được xếp đúng món nào ít CO₂ hơn. Hai số đoán bằng nhau được tính nửa điểm. Bộ xếp hạng (RRF) chỉ dùng thứ tự, nên đây là chỉ số quan trọng nhất cho việc xếp hạng |

## 2. Kết quả chính

### 2.1 Toàn bộ (n = 1.435)

| Cách | MdAPE % | MAPE % | Lệch > 2× % | Spearman | Đúng thứ tự cặp trong loại % |
|---|---|---|---|---|---|
| (a) Trung vị loại | 24,1 | 41,9 | 10,5 | 0,644 | 33,9 * |
| (b) Trung vị hãng | 21,1 | 39,1 | 8,6 | 0,733 | 54,5 |
| (c) Mô hình theo loại (code trước khi sửa bộ đọc "27-inch") | 21,1 | 39,0 | 8,8 | 0,735 | 54,8 |
| (c′) Mô hình theo loại, **code hiện tại** (đã đọc được "27-inch") | **20,9** | 39,0 | 8,9 | **0,738** | **55,4** |

> Cập nhật 23/11/2026: `green/spec_parser.py` đã đọc được cỡ màn hình dạng "27-inch", "27\"", "27”" (có test). Chạy lại: (c) = (c′) = 20,9 %.

\* Với (a), mọi sản phẩm cùng loại nhận gần cùng một số, nên trong một loại cách này không mang thông tin thứ tự. Con số dưới 50 % là *hiệu ứng phụ của phép bỏ dòng máy*: bỏ một dòng máy toàn số to thì trung vị của phần còn lại giảm xuống, nên số đoán ngược chiều với số thật. Hiệu ứng này cũng làm hệ số Spearman trong từng loại của (a) bị âm.

### 2.2 Theo loại, cách (c′)

| Loại | n | MdAPE % | MAPE % | Lệch > 2× % | Đúng thứ tự cặp % |
|---|---|---|---|---|---|
| Laptop | 587 | 22,6 | 30,9 | 3,7 | 54,6 |
| Màn hình | 330 | 13,8 | 24,6 | 7,0 | 56,1 |
| Máy để bàn | 238 | 22,2 | 63,2 | 17,2 | 60,6 |
| Điện thoại | 100 | 13,7 | 21,2 | 4,0 | 47,0 |
| Máy tính bảng | 60 | 25,0 | 32,3 | 5,0 | 44,5 |
| Chuột / bàn phím / webcam | 45 | 40,4 | 73,4 | 28,9 | 43,9 |
| Đồng hồ | 30 | 38,9 | 61,0 | 26,7 | 47,3 |
| Nhà thông minh | 28 | 36,4 | 48,1 | 21,4 | 52,0 |

Bảng đầy đủ cho cả bốn cách, kể cả tai nghe, loa và máy chơi game, nằm trong [data/co2-eval-2026-11-23.md](data/co2-eval-2026-11-23.md).

### 2.3 Thử bỏ hệ số cỡ màn hình (cách c′)

| Loại | Số mũ b | MdAPE % | Spearman | Đúng thứ tự cặp % |
|---|---|---|---|---|
| Màn hình | 0 (không chỉnh cỡ) | 14,3 | 0,153 | 53,8 |
| Màn hình | **0,81 (đã khớp)** | **13,8** | 0,212 | **56,1** |
| Màn hình | 1,0 (tỷ lệ thuận) | 13,9 | 0,213 | 56,1 |
| Laptop | 0 | 22,7 | 0,136 | 54,2 |
| Laptop | **0,53 (đã khớp)** | 22,6 | 0,148 | 54,6 |
| Laptop | 1,0 | 22,7 | 0,157 | 54,8 |

**Cỡ màn hình chỉ đọc được từ tên của 44/330 màn hình và 65/587 laptop.** Phần lớn tên trong danh sách mẫu không ghi cỡ, ví dụ "Dell P2422H". Vì vậy hệ số cỡ màn hình chỉ cải thiện nhẹ trên bộ này. Trên sàn Việt Nam, tên hầu như luôn ghi cỡ ("Màn hình Samsung 27 inch"), nên hệ số này sẽ được dùng nhiều hơn khi chạy thật.

### 2.4 Bước 1 – trùng đúng mẫu

| Kiểm tra | Kết quả |
|---|---|
| Tên mẫu có ≥ 3 từ (đủ điều kiện) | 1.423 / 1.450 |
| Tra lại chính tên mẫu → tìm thấy | 1.423 / 1.423 (100 %) |
| … nhưng trả về một mẫu khác có số khác | **4** |
| Tên kiểu cửa hàng (bỏ tên hãng, thêm "Sản phẩm … chính hãng") → tìm thấy | 996 / 1.450 (68,7 %) |

Bốn trường hợp khớp nhầm đều do hàm `tokens()` bỏ dấu "+" và dấu "-":

| Tên gốc | Số thật | Bị khớp sang | Số của mẫu bị khớp |
|---|---|---|---|
| Samsung Galaxy Tab S9+ | 141,6 kg | Galaxy Tab S9 | 124,9 kg |
| Microsoft Surface Pro 7+ | 181 kg | Surface Pro 7 | 164 kg |
| Lenovo IdeaPad 1-14 | 244 kg | IdeaPad 1 14 | 208 kg |
| Lenovo IdeaPad Slim 7-15 | 263 kg | Slim 7 15 | 329 kg |

Đây là lỗi thật trong `green/matching.py` (thuộc việc A5). Nên giữ "+" thành một từ riêng, ví dụ đổi "plus"/"+" thành token `plus`.

### 2.5 Công thức vòng đời (đồ gia dụng)

Số tính từ `green.co2_formula.estimate_co2`, với tham số mặc định.

| Sản phẩm (tên thử) | kWh/năm (nguồn) | Năm | Sản xuất | Dùng điện | Thải bỏ | **Tổng @ 0,681** | Tổng @ 0,6592 | Khoảng bất định | % dùng điện |
|---|---|---|---|---|---|---|---|---|---|
| Máy lạnh Daikin Inverter 1,5 HP, nhãn 820 kWh/năm | 820 (nhãn) | 10 | 450 | 5.705,7 | 141,5 | **6.297,2** | 6.118,4 | 5.604–6.991 | 90,6 |
| Tủ lạnh Panasonic Inverter 322 L | 210,1 (mặc định loại) | 12 | 315,2 | 1.716,7 | 15,1 | **2.047,0** | 1.992,1 | 1.266–2.828 | 83,9 |
| Tivi Samsung 75 inch | 269,4 (mặc định loại) | 8 | 493,9 | 1.467,6 | 10,0 | **1.971,5** | 1.924,5 | 1.236–2.707 | 74,4 |
| Máy giặt LG Inverter 9 kg | 67,5 (mặc định loại) | 10 | 250 | 459,7 | 10 | **719,7** | 705,0 | 461–979 | 63,9 |
| Quạt đứng Toshiba 55 W | 160,6 (công suất) | 7 | 25 | 765,6 | 2 | **792,6** | 768,1 | 594–992 | 96,6 |

- Tổng theo hệ số lưới 0,681 cao hơn theo 0,6592 khoảng 2,5–3 %. Phần dùng điện chiếm 64–97 % vòng đời của đồ gia dụng. Đây là lý do cần tính riêng phần sử dụng theo lưới điện Việt Nam.
- Số tính ra khớp với các ví dụ tính tay trong tài liệu nguồn: máy lạnh Daikin ≈ 6.300 kg (≈ 6.118 kg theo 0,6592), tivi 75" ≈ 1.970 kg.
- Riêng tivi 75", con số nằm trong khoảng 982–2.388 kg mà Samsung công bố cho các mẫu 75".
- Ngoài tivi, công thức chưa được so với số thật của hãng (việc A2).

## 3. So với các số đã công bố trước đây

So với `docs/research/co2-fallback.md` §3.1 (script cũ nằm ngoài repo, `F:\…\fallback_experiment.py`):

| Chỉ số MdAPE | co2-fallback.md | Lần chạy này (c′) |
|---|---|---|
| Trung vị loại, tất cả | 24,1 % | 24,1 % ✔ |
| Mô hình theo loại, tất cả | 18,5 % | **20,9 %** |
| Màn hình | 9,4 % | **13,8 %** |
| Laptop | 20,1 % | **22,6 %** |
| Máy để bàn | 22,2 % | 22,2 % ✔ |
| Điện thoại | 13,7 % | 13,7 % ✔ |

- Cách lấy trung vị loại cho đúng cùng số. Vậy dữ liệu và cách bỏ dòng máy khớp với lần chạy trước.
- Mô hình theo loại kém hơn số cũ ở màn hình và laptop, tức đúng hai loại có dùng hệ số cỡ màn hình.
- Lý do có khả năng nhất: script cũ đọc cỡ màn hình cho nhiều mẫu hơn, ví dụ suy ra từ mã model "P2422H" → 24". Code hiện tại chỉ đọc được cỡ khi tên ghi "inch" hoặc dấu ".
- **Từ nay bản nộp dùng số của lần chạy này**, vì có thể chạy lại ngay từ repo.

## 4. Điều rút ra

1. **Độ lớn:** khi không có mẫu giống, cách mức giữa của loại đoán sai khoảng 21 % theo trung vị. Chỉ 8,9 % sản phẩm bị lệch quá 2 lần.
2. **Thứ tự giữa các loại:** Spearman trên toàn bộ là 0,74. Món to vẫn đứng trên món nhỏ, ví dụ máy để bàn đứng trên điện thoại.
3. **Thứ tự trong cùng loại yếu:** các cách dự phòng chỉ xếp đúng 44–61 % cặp tùy loại (55 % tính chung), gần với tung đồng xu.
   - Lý do: các cách này chỉ dựa vào hãng và cỡ màn hình.
   - Hệ quả: khi hai sản phẩm cùng loại đều chỉ có số dự phòng, thứ hạng CO₂ giữa chúng có ít thông tin.
   - Trọng số 0,2 trong RRF (CO₂ chỉ phá thế hòa) và nhãn nguồn/độ tin cậy hiện cạnh mỗi con số là phù hợp với giới hạn này.
   - Để xếp đúng thứ tự trong loại cần số của hãng: bước 1 (trùng mẫu) hoặc bước 2 (trung bình mẫu giống, Spearman 0,95 trên nhóm A của bộ 28 sản phẩm).
4. **Bước trùng mẫu:** bước này đáng tin, nhưng có lỗi với tên có "+" hoặc "-". Cần sửa trong A5.
5. **Công thức vòng đời:** phần dùng điện chiếm 64–97 % của đồ gia dụng. Kết quả nhạy theo hệ số lưới, nhưng chỉ khoảng 3 % giữa hai năm 2023 và 2024.
