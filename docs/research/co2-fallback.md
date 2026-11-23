# Ước lượng CO₂ khi không tìm được sản phẩm giống

> Code: [`green/fallback.py`](../../backend/services/etl-worker/green/fallback.py), gọi từ `data/process/carbon_estimator.py::estimate_product_co2e` · Test: [`tests/test_fallback.py`](../../backend/services/etl-worker/tests/test_fallback.py) · Ngày: 07/11/2026

## 1. Vấn đề

Bản chốt tính CO₂ theo 3 bước: (1) số của hãng → (2) trung bình các sản phẩm mẫu có cosine CLIP ≥ 0,66 → (3) không có thì **để trống**. Thử nghiệm 28 sản phẩm cho thấy bước (3) xảy ra rất thường xuyên: nhóm loại chưa có mẫu để trống 12/12 với tên tiếng Việt. Code cũ thì hỏi Qwen 0.8B đoán số ("unanchored"), và cách này đã bị loại vì không tốt hơn baseline và không giải thích được.

Với nhóm sản phẩm trọng tâm hiện tại (`FOCUS_GROUP=appliances`: điều hoà, tủ lạnh, máy giặt, tivi...) gần như không hãng nào công bố CO₂ theo từng model, nên hầu hết sản phẩm sẽ bị để trống nếu không có bước dự phòng.

## 2. Chuỗi xử lý mới

```
có số cũ theo product_url ─► dùng lại
cosine ≥ 0,66 (≥ 1 mẫu)   ─► trung bình các mẫu                      neighbor_average   0,50
không có mẫu đủ giống:
  loại là điện gia dụng    ─► công thức vòng đời (co2_formula.py)     lifecycle_formula  0,25–0,35
  loại có ≥ 4 mẫu trong DB ─► mô hình theo loại (hãng + cỡ màn hình)  category_model     0,35
  có giá + loại ánh xạ NAICS ─► giá × hệ số EEIO (US EPA v1.3)       eeio_price         0,15
  không gì áp dụng         ─► để trống
```

Cột cuối là `co2e_source` và `co2e_confidence` lưu vào bảng `product`. LLM không còn sinh số. Muốn chạy lại thí nghiệm có Qwen thì đặt `CO2E_USE_LLM=1`: khi đó Qwen chỉ được hỏi khi đã có mẫu đủ giống (có neo), không bao giờ hỏi khi không có mẫu.

### 2.1 Công thức vòng đời (điện gia dụng)

Dùng nguyên `green/co2_formula.py` đã có (xem [co2-formula.md](co2-formula.md)), với thông số đọc từ tên + mô tả: nhãn năng lượng (kWh/năm), công suất, HP, lít, kg, inch, Inverter, số sao.

$$CO_2 = E_{emb}\cdot s + L\cdot(AEC\cdot EF_{grid} + R_{leak}) + E_{eol}$$

Độ tin cậy theo nguồn số điện: nhãn 0,35 · công suất 0,30 · mặc định loại 0,25. Áp dụng cho: điều hoà, tủ lạnh, máy giặt, tivi, quạt, nồi cơm, máy lọc không khí, máy lọc nước, máy hút bụi, lò vi sóng/lò nướng, bếp, đèn.

### 2.2 Mô hình theo loại (đồ điện tử có trong danh sách mẫu)

$$\ln CO_2 = \text{trung vị}_c\big(\ln CO_2\big) + \Delta_{hãng} + b_c\cdot\ln\frac{inch}{inch_{ref,c}}$$

- Trung vị theo loại, tính lại mỗi lần dựng chỉ mục từ bảng `carbonreference` (tự cập nhật khi thêm mẫu).
- $\Delta_{hãng}$: trung vị log của hãng trừ trung vị loại, chỉ dùng khi hãng có ≥ 3 mẫu trong loại đó. Hãng nhận ra bằng cách tìm tên hãng (nguyên từ) trong tên sản phẩm.
- Hệ số kích thước $b_c$ cố định, ước lượng trên 1.450 sản phẩm: màn hình 0,81 (inch chuẩn 23,8), laptop 0,53 (inch chuẩn 14). Inch đọc từ tên/mô tả; ngoài khoảng hợp lý (màn hình 15–57, laptop 10–18,5) thì bỏ qua.

### 2.3 EEIO theo giá (cách của P5 – CaML)

$$CO_2 = \frac{P_{VND}}{\text{tỷ giá}}\cdot\frac{CPI_{2022}}{CPI_{nay}}\cdot \varepsilon_{NAICS}$$

- $\varepsilon$: *Supply Chain GHG Emission Factors v1.3.0 by NAICS-6* (US EPA, USEEIO v2.2, khí nhà kính năm 2022), cột *with margins* = kg CO₂e / USD 2022 giá người mua. File gốc: `SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv` (DOI 10.23719/1531143, SHA-256 `6025a14c…c002f`, tải 07/11/2026). 30 mã NAICS cần dùng lưu ở `green/data/eeio_factors.json` cùng bảng ánh xạ 58 loại sản phẩm → NAICS.
- Tỷ giá 25.900 đ/USD (Vietcombank 15/10/2026: mua CK 25.710, bán 26.090). CPI-U: 2022 = 292,655; 09/2026 = 336,940 (BLS). Đổi bằng biến môi trường `CO2_VND_PER_USD`, `CO2_CPI_NOW`.
- **Chỉ gồm sản xuất + vận chuyển đến cửa hàng**, không có điện khi dùng → chỉ dùng được để so sánh trong cùng loại. Đây là bước cuối cho những loại không có công thức và không có mẫu (thời trang, sách, mỹ phẩm, đồ chơi, nội thất...) và cho đồ điện tử thuộc loại có < 4 mẫu.

## 3. Thử nghiệm

### 3.1 Mô hình theo loại – bỏ từng nhóm model ra (1.450 sản phẩm có số của hãng)

Mỗi sản phẩm được ước lượng từ các sản phẩm còn lại cùng loại, sau khi bỏ cả những model cùng dòng (cùng hãng + từ đầu tiên của tên, ví dụ mọi "Latitude") để không lộ đáp án. MdAPE = trung vị sai số %, ×2 = tỷ lệ lệch quá 2 lần.

| Loại | n | Trung vị loại MdAPE | ×2 | **Hãng + cỡ màn hình** MdAPE | ×2 | Công thức mặc định cũ MdAPE |
|---|---|---|---|---|---|---|
| Tất cả | 1.437 | 24,1 % | 10,6 % | **18,5 %** | 9,1 % | 24,0 % (MAPE 63 %) |
| Laptop | 587 | 20,5 % | 5,3 % | **20,1 %** | 3,4 % | 20,8 % |
| Màn hình | 330 | 16,3 % | 6,7 % | **9,4 %** | 6,2 % | 17,2 % |
| Máy tính để bàn | 238 | 42,6 % | 22,3 % | **22,2 %** | 17,2 % | 120 % |
| Điện thoại | 100 | 15,0 % | 5,0 % | **13,7 %** | 4,0 % | 14,1 % |
| Máy tính bảng | 60 | 25,0 % | 6,7 % | 25,0 % | 5,0 % | 22,0 % |
| Chuột/bàn phím/webcam | 45 | 42,5 % | 33,3 % | 40,4 % | 28,9 % | – |
| Đồng hồ | 30 | 38,9 % | 23,3 % | 38,9 % | 26,7 % | 53,0 % |
| Nhà thông minh | 28 | 36,4 % | 28,6 % | 36,4 % | 21,4 % | – |

So sánh: trung bình láng giềng (bản chốt) trên nhóm A của bộ 28 sản phẩm có MAPE 20–22 %. MAPE của mô hình theo loại: màn hình 19 %, điện thoại 21 %, laptop 28 %, máy tính bảng 32 % (máy để bàn 63 % vì vài máy trạm rất lớn). Với điện thoại, laptop, màn hình mức này gần bằng trung bình láng giềng nên dùng làm dự phòng được. Đồng hồ, ngoại vi, nhà thông minh sai ~40 % (MdAPE): chỉ nên dùng để xếp hạng thô.

Script: `F:\Price Optimization\carbon footprint\mo_rong_seed\fallback_experiment.py`.

### 3.2 Công thức vòng đời

Chỉ có 4 tivi 75" của Samsung và 1 tủ lạnh LG có số của hãng, nên chưa kiểm định thống kê được. Kiểm tra thô: công thức mặc định cho tivi 75" ra 1.925 kg; báo cáo Samsung cho 4 model 75" là 982 / 1.852 / 2.123 / 2.388 kg. Phần còn lại (điều hoà, tủ lạnh, máy giặt...) vẫn là **giả định** như ghi ở `co2-formula.md` §4.

### 3.3 EEIO

Chưa kiểm định được vì danh sách mẫu không có giá. Theo cách tính thì EEIO thấp hơn PCF của hãng với laptop (hệ số 0,058 kg/USD) và cao hơn với điện thoại (0,111), nên **không dùng EEIO cho các loại đã có mẫu**.

### 3.4 Chạy thử toàn luồng (SQLite + 1.450 mẫu, bộ mã hoá giả)

| Sản phẩm | Bước | kg |
|---|---|---|
| Dell Latitude 5420 | trung bình 5 mẫu giống | 300 |
| Laptop Acer Nitro V 15 15,6" | mô hình theo loại (Acer, 15,6") | 270 |
| Màn hình Samsung Odyssey G5 27" | mô hình theo loại (27") | 544 |
| Đồng hồ Huawei Watch GT 5 | mô hình theo loại | 24,5 |
| Chuột Logitech M240 | mô hình theo loại (Logitech) | 7,4 |
| Máy lạnh Daikin Inverter 1,5 HP, nhãn 820 kWh/năm | công thức (theo nhãn) | 6.118 |
| Tủ lạnh Panasonic Inverter 322 L | công thức (mặc định) | 2.774 |
| Tivi Sony 55" | công thức (mặc định) | 1.289 |
| Máy giặt LG Inverter 9 kg | công thức (mặc định) | 705 |
| Áo thun nam 199.000 đ | EEIO | 0,8 |
| Sách 79.000 đ | EEIO | 0,28 |
| Phần mềm diệt virus | không có loại → để trống | – |

Khi chạy thử phát hiện và đã sửa một lỗi ở `spec_parser.py`: mã model như "FV1409S4W" bị đọc thành công suất 4 W, làm điện năng máy giặt còn 0,8 kWh/năm.

## 4. Giới hạn

- Số từ 4 bước **không cùng phương pháp**: PCF của hãng dùng lưới điện và tuổi thọ của hãng; công thức dùng lưới điện Việt Nam; EEIO không có pha sử dụng. Chỉ nên so sánh trong cùng loại. Giao diện nên hiển thị `co2e_source` (hiện chỉ hiển thị câu giải thích).
- Mô hình theo loại không phân biệt hàng cũ/tân trang; công thức thì có (giảm 80 % phần sản xuất).
- Tham số công thức điện gia dụng chưa hiệu chỉnh bằng dữ liệu thật; cần thu số kWh/năm trên nhãn năng lượng khi cào Điện Máy Xanh/TGDĐ.
- EEIO dùng bảng của Mỹ cho hàng bán ở Việt Nam, giá đã gồm VAT 10 %, hệ số theo ngành rất thô (riêng bước chọn ngành, P5 báo MAPE 22 %).
- Hãng chỉ nhận ra khi tên hãng nằm trong danh sách mẫu (Dell, Lenovo, HP, Apple, Asus, Acer, Samsung, Logitech...).

## 5. Việc tiếp theo

1. Hiển thị nguồn + khoảng sai số trên trang sản phẩm.
2. Thu kWh/năm trên nhãn năng lượng → hiệu chỉnh `CATEGORY_PARAMS` và kiểm định công thức.
3. Thêm EPD điện gia dụng vào danh sách mẫu (mỗi loại ≥ 5).
4. ~~Bước 1 của bản chốt (khớp đúng model trước khi tìm láng giềng)~~ – đã có từ 22/11/2026 (`carbon_estimator.py::_exact_reference`).

> Cập nhật 23/11/2026: các bước dự phòng nay **bật mặc định** (`CO2E_FALLBACK=1`); hệ số lưới điện đổi từ 0,6592 sang 0,681 (năm 2024), nên các số của công thức ở mục 3 tăng khoảng 3 % (tivi 75" 1.925 → 1.972 kg, máy lạnh Daikin 6.118 → 6.297 kg). Tổng hợp thay đổi: [co2-nhung-gi-moi.md](co2-nhung-gi-moi.md).
