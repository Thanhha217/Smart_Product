# Công thức CO₂ vòng đời & lượng CO₂ giảm thải theo thời gian sử dụng

> Tài liệu cho yêu cầu số 2 của giáo viên hướng dẫn: *"Định nghĩa công thức CO₂ (cái này sẽ là cái mới trong bài nghiên cứu)"*.
> Code: [`backend/services/etl-worker/green/co2_formula.py`](../../backend/services/etl-worker/green/co2_formula.py) · Test: [`tests/test_green.py`](../../backend/services/etl-worker/tests/test_green.py)

## 1. Vì sao cần một công thức thay vì hỏi LLM

Phiên bản hiện tại (nhánh `paper`) hỏi thẳng mô hình Qwen 3.5 0.8B *"sản phẩm này thải bao nhiêu kg CO₂?"*. Kết quả trong `research_paper.tex`:

| Phương pháp | MAE (kg) | MAPE (%) | Spearman ρ |
|---|---|---|---|
| Trung bình láng giềng | 68,0 | 36,9 | 0,928 |
| LLM Qwen 3.5 0.8B | 77,2 | 38,4 | 0,923 |

LLM **không tốt hơn** baseline ở bất kỳ chỉ số nào. Ngoài ra:
- Con số LLM không giải thích được (hộp đen), không tái lập được, và không trả lời được câu hỏi *"dùng 6 tháng / 1 năm thì giảm bao nhiêu CO₂"*.
- Bộ dữ liệu tham chiếu (`carbon_reference_seed.json`, 121 sản phẩm) chỉ có 5 loại: smartphone 39, màn hình 37, laptop 29, tablet 15, tai nghe 1 → không có dữ liệu cho điện gia dụng.

Đóng góp mới đề xuất: **một mô hình vòng đời tham số hoá, tách pha sử dụng theo thời gian**, dùng hệ số phát thải lưới điện Việt Nam và dữ liệu nhãn năng lượng Việt Nam. LLM chỉ còn vai trò phụ (ước lượng phần phát thải sản xuất khi thiếu dữ liệu, và viết lời giải thích).

## 2. Ký hiệu

| Ký hiệu | Ý nghĩa | Đơn vị | Nguồn giá trị |
|---|---|---|---|
| $E_{emb}$ | Phát thải "ẩn" khi sản xuất: nguyên liệu + chế tạo + vận chuyển (A1–A4) | kg CO₂e | EPD nhà sản xuất → seed tham chiếu → mặc định theo danh mục |
| $AEC$ | Điện năng tiêu thụ hằng năm của **chính sản phẩm** | kWh/năm | Nhãn năng lượng → công suất × giờ dùng → mặc định danh mục |
| $EF_{grid}$ | Hệ số phát thải lưới điện Việt Nam | kg CO₂e/kWh | Mặc định 0,6592 (Bộ TN&MT, năm 2023), cấu hình qua `CO2_GRID_EF` |
| $R_{leak}$ | Rò rỉ môi chất lạnh mỗi năm $= m_{ref}\cdot GWP \cdot r_{leak}$ | kg CO₂e/năm | Điều hoà, tủ lạnh |
| $E_{eol}$ | Phát thải cuối vòng đời (thu gom, xử lý, môi chất thoát ra khi thải bỏ $m_{ref}\cdot GWP\cdot r_{eol}$) | kg CO₂e | Mặc định danh mục |
| $L$ | Tuổi thọ sử dụng | năm | Mặc định danh mục |
| $T$ | Thời gian người dùng muốn xem (6, 12 tháng...) | tháng | Người dùng chọn |
| $s$ | Hệ số quy mô $(\text{size}/\text{size}_{ref})^{\alpha}$ — theo HP, lít, kg, inch | – | Trích từ tên/mô tả |

## 3. Công thức

### 3.1 Phát thải vòng đời (cradle-to-grave, ISO 14067)

$$
CO_2^{life} = E_{emb} + L\cdot\big(AEC\cdot EF_{grid} + R_{leak}\big) + E_{eol}
$$

### 3.2 Điện năng tiêu thụ hằng năm — thứ tự ưu tiên

1. Có số trên nhãn năng lượng (`... kWh/năm`, `... kWh/ngày`) → $AEC$ = số đó (`kwh_source = "label"`).
2. Có công suất định mức $P$ (W) → $AEC = P\cdot h\cdot d\cdot LF / 1000$ (giờ/ngày $h$, ngày/năm $d$, hệ số tải $LF$), nhân $f_{inv}$ nếu có Inverter (`"rated_power"`).
3. Không có gì → $AEC = AEC^{base}_{cat}\cdot s\cdot f_{inv}\cdot f_{star}$ với $f_{star} = \max(0{,}5;\ 1-0{,}08\,(n_{sao}-1))$ (`"category_default"`).

### 3.3 Phát thải khi dùng $T$ tháng (phần phát thải sản xuất được phân bổ đều theo tuổi thọ)

$$
CO_2(T) = \frac{T}{12}\big(AEC\cdot EF_{grid} + R_{leak}\big) + \frac{T/12}{L}\big(E_{emb}+E_{eol}\big)
$$

### 3.4 Lượng CO₂ **giảm thải** khi chọn sản phẩm này (điểm mới chính)

So với một **sản phẩm tiêu chuẩn cùng công suất** (cùng HP / lít / kg / inch, không Inverter, không cộng điểm nhãn năng lượng, hàng mới):

$$
\Delta CO_2(T) = \underbrace{\frac{T}{12}\,(AEC_b - AEC_p)\,EF_{grid}}_{\text{pha sử dụng}}
+ \underbrace{\frac{T/12}{L}\,(E_{emb,b}-E_{emb,p})}_{\text{pha sản xuất (VD: hàng tái sử dụng)}}
+ \underbrace{\frac{T}{12}\,(R_{leak,b}-R_{leak,p})}_{\text{môi chất lạnh}}
$$

Kèm theo các đại lượng dễ hiểu cho người dùng:
- Điện tiết kiệm: $\Delta kWh(T) = \frac{T}{12}(AEC_b-AEC_p)$
- Tiền điện tiết kiệm: $\Delta VND(T) = \Delta kWh(T)\cdot p_{điện}$ (mặc định 2.700 đ/kWh, cấu hình `ELECTRICITY_PRICE_VND`)
- Quy đổi cây xanh: $\Delta CO_2(T) / 21{,}8$ (kg CO₂ một cây hấp thụ/năm)

### 3.5 Khoảng bất định

Độ bất định tương đối của pha sử dụng phụ thuộc nguồn số liệu: nhãn ±10 %, công suất ±25 %, mặc định ±40 %; phát thải sản xuất ±30 %. Hệ thống trả về `lifecycle_low_kg` – `lifecycle_high_kg` để hiển thị cùng giá trị điểm, tránh gây hiểu nhầm là số chính xác.

## 4. Tham số mặc định (GIẢ ĐỊNH — cần hiệu chỉnh trước khi công bố)

Toàn bộ nằm trong `CATEGORY_PARAMS`. Đây là giả định hợp lý cho hộ gia đình Việt Nam, **chưa phải số liệu đã kiểm chứng**; bước tiếp theo là thay bằng dữ liệu nhãn năng lượng thu thập được và EPD của hãng.

| Danh mục | L (năm) | AEC chuẩn (kWh/năm) | E_emb (kg) | Kích thước chuẩn | Ghi chú |
|---|---|---|---|---|---|
| Điều hoà | 10 | 1.300 / HP | 300 | 1 HP | 8 h/ngày, 300 ngày; Inverter ×0,65; R32 0,6 kg, GWP 675, rò 3 %/năm |
| Tủ lạnh | 12 | 420 | 300 | 300 L (α=0,7) | Inverter ×0,70; R600a GWP 3 |
| Máy giặt | 10 | 90 | 250 | 9 kg (α=0,6) | 250 mẻ/năm, giặt nước lạnh |
| Tivi | 8 | 180 | 330 | 55" (α=1,3) | 5 h/ngày |
| Quạt | 7 | 160 | 25 | – | Động cơ DC ×0,5 |
| Nồi cơm | 6 | 130 | 20 | 1,8 L | |
| Máy lọc không khí | 7 | 130 | 40 | – | DC ×0,6 |
| Laptop / điện thoại / màn hình... | 3–6 | 4–200 | 35–400 | | Pha sử dụng nhỏ; hàng cũ giảm 80 % E_emb |

## 5. Ví dụ tính (chạy từ code, tham số mặc định)

**Điều hoà 1 HP Inverter, nhãn 5 sao** so với điều hoà 1 HP thường:

| | Thường | Inverter 5 sao |
|---|---|---|
| AEC (kWh/năm) | 1.300 | 574,6 |
| CO₂ vòng đời 10 năm (kg) | 9.133 (5.615 – 12.650) | 4.351 (2.746 – 5.956) |
| CO₂ khi dùng 6 tháng / 12 tháng (kg) | 456,6 / 913,3 | 217,5 / 435,1 |

→ Chọn máy Inverter 5 sao **giảm 239 kg CO₂ sau 6 tháng, 478 kg sau 1 năm**, tiết kiệm 725 kWh ≈ **1,96 triệu đồng/năm**, tương đương lượng CO₂ ~22 cây xanh hấp thụ trong 1 năm.

**Tủ lạnh 300 L Inverter**: giảm 41,5 kg CO₂ (6 tháng) / 83,1 kg (1 năm), tiết kiệm 126 kWh/năm.
**Laptop đã qua sử dụng**: pha sử dụng như máy mới nhưng tránh được 80 % phát thải sản xuất → giảm 25 kg (6 tháng) / 50 kg (1 năm) phần phát thải sản xuất được phân bổ.

Ví dụ này cho thấy vì sao **điện gia dụng** là nhóm phù hợp nhất cho câu hỏi "giảm bao nhiêu CO₂ sau 6 tháng / 1 năm": với đồ công nghệ, pha sử dụng chỉ vài chục kWh/năm nên chênh lệch gần như bằng 0.

## 6. Kiểm định công thức (kế hoạch thí nghiệm)

1. **Độ đúng của AEC**: so sánh $AEC$ dự đoán (khi ẩn số nhãn) với số in trên nhãn năng lượng cho các sản phẩm có nhãn → MAE, MAPE theo danh mục.
2. **Độ đúng vòng đời**: so với EPD / báo cáo môi trường của hãng (Daikin, Panasonic, Samsung, LG công bố PCF cho một số model) → MAE, MAPE, Spearman ρ; so sánh với 3 baseline: LLM 0.8B (hiện tại), trung bình láng giềng, LLM trả phí.
3. **Phân tích độ nhạy**: thay đổi ±20 % từng tham số ($EF_{grid}$, giờ dùng, $L$, $E_{emb}$) và vẽ biểu đồ tornado để chỉ ra tham số nào quyết định kết quả.
4. **Tính nhất quán thứ hạng**: Spearman ρ giữa thứ hạng CO₂ theo công thức và theo EPD trong cùng danh mục (đây là tính chất RRF cần).

## 7. Việc còn phải làm để công thức thành kết quả nghiên cứu

- [ ] Xác minh lại $EF_{grid}$ theo công bố chính thức mới nhất của Bộ TN&MT và ghi trích dẫn.
- [ ] Thu thập AEC trên nhãn năng lượng khi cào dữ liệu Điện Máy Xanh / TGDĐ (mục "Thông số kỹ thuật") để hiệu chỉnh `baseline_kwh_year`, `INVERTER_FACTOR`, `STAR_STEP`.
- [ ] Bổ sung EPD điện gia dụng vào `carbon_reference_seed.json` để hiệu chỉnh `embodied_kg`.
- [ ] Nối `green` vào ETL (xem [advisor-requirements.md](advisor-requirements.md) mục 2.4) — cần xác nhận vì chạm file lõi `data_processing.py`.
