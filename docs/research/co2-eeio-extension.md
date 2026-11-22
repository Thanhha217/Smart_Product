# Mở rộng công thức CO₂ bằng ma trận Input-Output (EEIO)

> Phần bổ sung cho [`co2-formula.md`](co2-formula.md). Nội dung dưới đây được viết theo dạng mục mới (§3.6) kèm các chỗ cần sửa ở §2, §3.5, §6, §7 của tài liệu gốc.
> Trạng thái: **đề xuất thiết kế**. Các nguồn số liệu ở §5 chưa được xác minh, cần kiểm tra trước khi trích dẫn.

## 1. Động cơ

Trong tài liệu gốc, $E_{emb}$ (phát thải sản xuất) lấy theo thứ tự: EPD nhà sản xuất → seed tham chiếu → mặc định theo danh mục. Với điện gia dụng, EPD công bố rất ít và seed (121 sản phẩm) không có dữ liệu, nên phần lớn trường hợp rơi xuống **mặc định theo danh mục**, tức một hằng số cho cả nhóm, không phân biệt sản phẩm nào.

Ma trận Input-Output mở rộng phát thải (EEIO, Environmentally-Extended Input-Output) thêm một tầng ở giữa, ước lượng $E_{emb}$ từ **giá bán**, là dữ liệu đã có sẵn khi cào Điện Máy Xanh / TGDĐ:

```
EPD  →  seed  →  EEIO (giá × cường độ phát thải ngành)  →  mặc định danh mục
```

Đây là cách tiếp cận lai (hybrid LCA): dùng dữ liệu quá trình (EPD) khi có, dùng IO để lấp chỗ trống. Việc áp dụng ma trận IO của Việt Nam cho bài toán xếp hạng sản phẩm tiêu dùng có thể coi là điểm mới của bài nghiên cứu, nhưng cần rà lại tài liệu để khẳng định trước khi tuyên bố.

## 2. Ký hiệu bổ sung (thêm vào bảng §2)

| Ký hiệu | Ý nghĩa | Đơn vị | Nguồn giá trị |
|---|---|---|---|
| $A$ | Ma trận hệ số kỹ thuật (ngành $j$ cần bao nhiêu đầu vào từ ngành $i$ cho 1 đồng sản lượng) | – | Bảng IO |
| $L_{ty}=(I-A)^{-1}$ | Ma trận nghịch đảo Leontief | – | Tính từ $A$ |
| $f_j$ | Phát thải trực tiếp của ngành $j$ trên mỗi đồng sản lượng | kg CO₂e/VND | Kiểm kê khí nhà kính theo ngành |
| $\varepsilon_j$ | Cường độ phát thải toàn chuỗi cung ứng của ngành $j$ | kg CO₂e/VND | $f\,L_{ty}$ |
| $s(c)$ | Ngành IO ứng với danh mục sản phẩm $c$ | – | Bảng ánh xạ thủ công |
| $m_c$ | Biên lợi nhuận bán lẻ và thương mại của danh mục $c$ | – | Bảng IO (cột thương mại) hoặc ước lượng |
| $P_{retail}$ | Giá bán lẻ | VND | Dữ liệu cào |
| $CPI_{y_0}, CPI_y$ | Chỉ số giá năm của bảng IO và năm giá bán | – | Tổng cục Thống kê |

## 3. Công thức (§3.6 mới)

### 3.6.1 Cường độ phát thải theo ngành

$$
\varepsilon = f\,(I-A)^{-1}
$$

$(I-A)^{-1}$ gồm cả tác động trực tiếp và gián tiếp qua mọi tầng nhà cung cấp. $\varepsilon_j$ là tổng phát thải cần để làm ra 1 đồng sản phẩm của ngành $j$.

### 3.6.2 Phát thải sản xuất của một sản phẩm

$$
E_{emb}^{IO} = P_{prod}\cdot\varepsilon_{s(c)}\cdot\frac{CPI_{y_0}}{CPI_{y}},
\qquad P_{prod} = P_{retail}\,(1-m_c)
$$

Bảng IO tính theo giá sản xuất, không phải giá bán lẻ, nên phải trừ biên thương mại $m_c$. Hệ số CPI đưa giá về đúng năm của bảng IO.

### 3.6.3 Thứ tự ưu tiên và kết hợp nhiều nguồn

Thứ tự mặc định (thêm `embodied_source`, cùng kiểu với `kwh_source`):

1. Có EPD của model → dùng EPD (`"epd"`).
2. Có sản phẩm tương tự trong seed → dùng seed (`"seed"`).
3. Có giá và danh mục ánh xạ được → dùng EEIO (`"eeio"`).
4. Không có gì → mặc định danh mục (`"category_default"`).

Khi có nhiều nguồn cùng lúc, có thể kết hợp theo trọng số nghịch đảo phương sai:

$$
E_{emb}=\frac{\sum_k w_k E_k}{\sum_k w_k},\qquad w_k = \frac{1}{\sigma_k^{2}}
$$

Lưu ý: công thức này giả định các nguồn độc lập. Nếu seed và EPD cùng dựa trên một nguồn gốc thì trọng số sẽ đánh giá quá cao độ tin cậy. Phương án đơn giản hơn và dễ bảo vệ hơn là chỉ chọn nguồn có bất định thấp nhất.

### 3.6.4 Cập nhật khoảng bất định (sửa §3.5)

| Nguồn $E_{emb}$ | Bất định tương đối đề xuất |
|---|---|
| EPD | ±15 % |
| Seed tham chiếu | ±30 % (giữ như cũ) |
| EEIO | ±50 % (giả định ban đầu, hiệu chỉnh bằng thí nghiệm §6) |
| Mặc định danh mục | ±50 % |

Các con số trên là giả định, phải thay bằng sai số thực đo được ở bước kiểm định.

## 4. Vấn đề phải xử lý

1. **Hàng nhập khẩu.** Điện tử và điện lạnh bán ở Việt Nam phần lớn sản xuất ở nước ngoài. Ma trận IO nội địa sẽ mô tả sai chuỗi cung ứng của chúng. Cách tốt hơn là dùng bảng đa vùng (MRIO) có Việt Nam cùng các nước sản xuất chính. Nếu chỉ dùng bảng nội địa thì phải nêu rõ đây là giới hạn của phương pháp.
2. **Độ phân giải ngành thô.** Một ngành gộp nhiều loại sản phẩm, nên phát thải tỉ lệ thuần theo giá. Máy đắt vì thương hiệu hoặc tính năng bị tính nhiều CO₂ hơn dù thực tế chưa chắc. Vì vậy EEIO phù hợp làm tầng dự phòng và để xếp thứ hạng trong cùng danh mục, chưa thay được EPD.
3. **Năm của bảng IO.** Bảng thường cũ vài năm so với giá hiện tại, cần quy đổi CPI như §3.6.2. Cấu trúc sản xuất cũng thay đổi theo thời gian, đây là sai số không sửa được bằng CPI.
4. **Không đếm trùng.** EEIO chỉ thay $E_{emb}$. Pha sử dụng vẫn tính bằng $AEC\cdot EF_{grid}$. Nếu dùng IO cho cả điện tiêu thụ thì bị đếm trùng.
5. **Đơn vị tiền.** Bảng IO có thể tính theo VND hoặc USD, cần thống nhất và ghi rõ tỉ giá nếu quy đổi.

## 5. Nguồn dữ liệu cần tìm (chưa xác minh)

| Dữ liệu | Ứng viên | Việc cần kiểm tra |
|---|---|---|
| Bảng IO Việt Nam | Tổng cục Thống kê | Năm bảng mới nhất, số ngành, có công khai không |
| Bảng MRIO có Việt Nam | EXIOBASE, OECD ICIO, ADB MRIO | Giấy phép sử dụng, độ phủ Việt Nam, phân ngành điện tử/điện lạnh |
| Phát thải trực tiếp theo ngành ($f_j$) | Kiểm kê khí nhà kính quốc gia, số liệu môi trường của bảng MRIO | Cách gộp ngành khớp với bảng IO |
| Biên thương mại $m_c$ | Cột thương mại trong bảng IO | Có tách được bán lẻ điện máy không |
| CPI | Tổng cục Thống kê | Năm cơ sở |

## 6. Kiểm định (bổ sung vào §6 tài liệu gốc)

Bộ seed 121 sản phẩm là dữ liệu kiểm định sẵn có:

1. Che $E_{emb}$ của từng sản phẩm, tính lại bằng EEIO từ giá.
2. Đo MAE, MAPE, Spearman ρ theo từng danh mục.
3. So với các baseline: LLM 0.8B, trung bình láng giềng, mặc định theo danh mục hiện tại.
4. Phân tích độ nhạy: thay đổi ±20 % $\varepsilon$, $m_c$, $CPI$ và vẽ tornado.
5. Kiểm tra riêng thứ hạng: Spearman ρ giữa $E_{emb}^{IO}$ và giá trị tham chiếu trong cùng danh mục.

Nếu EEIO không thắng được mặc định theo danh mục thì đó vẫn là kết quả đáng báo cáo: nó chỉ ra độ phân giải ngành là điểm nghẽn, và gợi ý hướng cải thiện (bảng IO chi tiết hơn, hoặc MRIO).

Hạn chế của phép kiểm định: seed chỉ có smartphone, màn hình, laptop, tablet, tai nghe, tức không có điện gia dụng, nên kết quả kiểm định không tự động áp dụng được cho điều hoà, tủ lạnh. Cần bổ sung EPD điện gia dụng để kiểm định đúng nhóm đích.

## 7. Cách nối vào code

- `green/eeio.py`: hàm `embodied_from_eeio(category, price_vnd, year)` trả về `(giá trị kg CO₂e, khoảng bất định)`.
- `green/data/io_intensity.json`: bảng $\varepsilon_s$, $m_c$, ánh xạ danh mục → ngành, kèm nguồn và năm.
- `green/co2_formula.py`: thêm `embodied_source` vào chuỗi ưu tiên, trả cùng với kết quả để giao diện hiển thị nguồn.
- `tests/test_green.py`: test cho (a) chuỗi ưu tiên nguồn, (b) quy đổi CPI, (c) khi thiếu giá thì rơi về mặc định danh mục.

Ví dụ giao diện hàm (chưa cài đặt):

```python
def embodied_from_eeio(category: str, price_vnd: float, year: int) -> tuple[float, float] | None:
    """Trả về (E_emb_kg, rel_uncertainty) hoặc None nếu thiếu ánh xạ danh mục/giá."""
    ...
```

## 8. Việc còn phải làm

- [ ] Chọn bảng IO/MRIO, xác nhận giấy phép và năm.
- [ ] Lập bảng ánh xạ danh mục sản phẩm → ngành IO và ghi lý do từng ánh xạ.
- [ ] Ước lượng $m_c$ cho từng danh mục và ghi nguồn.
- [ ] Cài đặt `eeio.py` và test.
- [ ] Chạy kiểm định trên seed (§6), báo cáo cả trường hợp EEIO thua mặc định.
- [ ] Bổ sung EPD điện gia dụng để kiểm định đúng nhóm đích.
- [ ] Cập nhật §2, §3.5, §6, §7 của `co2-formula.md` cho khớp tài liệu này.
