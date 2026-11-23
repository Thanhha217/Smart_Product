# Công thức tính CO₂ cho sản phẩm trên sàn thương mại điện tử Việt Nam

*Bản nộp – Smart Product Finder. Cập nhật 23/11/2026.*

Bản nộp này tập trung vào **công thức CO₂**: công thức là gì, có gì mới, áp dụng vào đâu, chính xác đến mức nào và đã thử ra sao.

- Phần demo trên web, ChatGPT (MCP) và mua hàng thử nằm trong [02-dac-ta-ky-thuat-demo.md](02-dac-ta-ky-thuat-demo.md).
- Mọi con số trong bản này đều lấy từ một lần chạy có ghi nguồn. Chỗ nào chưa đo thì ghi rõ là **chưa đo**.

---

## 1. Bài toán

Khi mua một món đồ điện tử hay điện gia dụng, người dùng Việt Nam gần như không biết món nào gây ít khí nhà kính hơn.

- Các sàn (Thế Giới Di Động, Điện Máy Xanh, FPT Shop, CellphoneS, Phong Vũ…) không ghi con số này.
- Hãng sản xuất chỉ công bố cho một phần nhỏ mẫu máy, bằng tiếng Anh, trong các báo cáo EPD/PCF dài.
- Đồ điện gia dụng gần như không có báo cáo nào. Phần lớn CO₂ của chúng lại sinh ra trong lúc dùng điện, trên một lưới điện nhiều điện than như của Việt Nam.

**Mục tiêu.** Tự tính lượng CO₂ vòng đời, gọi là *PCF – Product Carbon Footprint*, đơn vị kg CO₂e, theo khung *cradle-to-grave* của ISO 14067, cho **từng sản phẩm** trên sàn. Sau đó dùng con số này để:

1. Hiển thị **điểm xanh 0–5** so trong cùng loại hàng.
2. **Xếp hạng**: món đúng nhu cầu nhất vẫn đứng đầu, CO₂ chỉ giúp chọn giữa các món ngang nhau.
3. Giải thích cho người dùng: số lấy từ đâu, tin được đến mức nào, và chọn món xanh hơn thì tiết kiệm được bao nhiêu.

**Nguyên tắc cốt lõi:**

- Luôn ưu tiên số thật của hãng.
- AI chỉ dùng để *tìm sản phẩm giống nhau*, không bao giờ tự sinh ra con số.
- Mỗi con số có **nhãn nguồn** và **độ tin cậy**.
- Không đủ căn cứ thì **để trống**: một con số sai còn tệ hơn không có số.

---

## 2. Công thức tổng quát: chuỗi ưu tiên

Gọi $p$ là sản phẩm cần tính, gồm tên, mô tả, loại hàng $c(p)$ và giá $g(p)$. Gọi $\mathcal{R}$ là danh sách mẫu có số thật của hãng. Hiện danh sách có **1.450 mẫu**:

| Loại | Số mẫu |
|---|---|
| Laptop | 587 |
| Màn hình | 330 |
| Máy để bàn | 238 |
| Điện thoại | 100 |
| Máy tính bảng | 60 |
| Chuột / bàn phím / webcam | 45 |
| Đồng hồ | 30 |
| Nhà thông minh | 28 |
| Loại khác | 32 |

Lượng CO₂ của $p$ là kết quả của **bước đầu tiên cho ra số**:

$$
\mathrm{CO_2}(p)=
\begin{cases}
\mathrm{CO_2^{exact}}(p) & \text{nếu hãng công bố đúng mẫu} & \text{(B1)}\\
\mathrm{CO_2^{nn}}(p) & \text{nếu có mẫu giống } \cos \ge \tau & \text{(B2)}\\
\mathrm{CO_2^{life}}(p) & \text{nếu } c(p) \text{ là đồ điện gia dụng} & \text{(B3a)}\\
\mathrm{CO_2^{cat}}(p) & \text{nếu loại } c(p) \text{ có} \ge 4 \text{ mẫu} & \text{(B3b)}\\
\mathrm{CO_2^{eeio}}(p) & \text{nếu có giá và mã ngành} & \text{(B3c)}\\
\varnothing & \text{không bước nào áp dụng được} & \text{(B4)}
\end{cases}
$$

| Bước | Nhãn nguồn (`co2e_source`) | Độ tin cậy | Code |
|---|---|---|---|
| B1 Trùng đúng mẫu | `manufacturer` | 0,9 | `green/matching.py` |
| B2 Trung bình mẫu giống | `neighbor_average` | 0,5 | `data/process/carbon_estimator.py` |
| B3a Công thức vòng đời | `lifecycle_formula` | 0,35 (có nhãn năng lượng) · 0,3 (có công suất) · 0,25 (dùng mức mặc định) | `green/co2_formula.py`, `green/fallback.py` |
| B3b Mức giữa của loại | `category_model` | 0,35 | `green/fallback.py` |
| B3c Theo giá (EEIO) | `eeio_price` | 0,15 | `green/fallback.py`, `green/data/eeio_factors.json` |
| B4 Để trống | `NULL` | – | – |

Các mức độ tin cậy trên là đặt tay theo kinh nghiệm, chưa hiệu chỉnh từ sai số. Cần hiệu chỉnh lại theo kết quả ở §5.

### 2.1 B1 – Trùng đúng mẫu

Hàm $\mathrm{tok}(\cdot)$ đổi chuỗi thành dãy từ và số viết thường. Ví dụ `MacBook Air 13" (M3)` thành `macbook air 13 m3`.

Một mẫu $r \in \mathcal{R}$ **khớp** $p$ khi tên của $r$ có ít nhất 3 từ và xuất hiện nguyên văn trong tên $p$:

- $|\mathrm{tok}(r)| \ge 3$, và
- $\mathrm{tok}(r)$ là chuỗi con theo từ của $\mathrm{tok}(p)$.

Được phép bỏ tên hãng ở đầu tên mẫu, vì sàn hay viết "Điện thoại iPhone 15 128GB" thay cho "Apple iPhone 15 128GB". Nếu có nhiều mẫu khớp, chọn mẫu có tên dài nhất:

$$
\mathrm{CO_2^{exact}}(p)=\mathrm{CO_2}(r^*),\qquad r^*=\arg\max_{r\ \text{khớp}}|\mathrm{tok}(r)|
$$

Ví dụ: "MacBook Air 13 inch M3" → **135 kg**, nguồn: số của hãng.

### 2.2 B2 – Trung bình mẫu giống, có ngưỡng

1. **Đổi chữ thành vector.** OpenCLIP ViT-B-32 (trọng số `laion2b_s34b_b79k`) đổi mỗi chuỗi thành vector 512 chiều:
   - phía sản phẩm: tên + mô tả, gọi là $\mathbf{e}_p$;
   - phía mẫu: hãng + tên + loại, gọi là $\mathbf{e}_r$.

   OpenCLIP chỉ đọc khoảng 77 token đầu, nên tên phải đứng đầu chuỗi.
2. **Lấy 5 mẫu giống nhất.** Tìm bằng FAISS theo cosine $s(p,r)=\cos(\mathbf{e}_p,\mathbf{e}_r)$, ưu tiên mẫu cùng loại. Tập này gọi là $N_5(p)$.
3. **Bỏ số bất thường** quanh trung vị $m$ của 5 mẫu:

$$
N'(p)=\{\,r\in N_5(p) : m/8 \le \mathrm{CO_2}(r) \le 8m\,\}
$$

4. **Lọc theo ngưỡng** giống $\tau = 0{,}66$ (bắt buộc), rồi lấy trung bình cộng:

$$
N_\tau(p)=\{\,r\in N'(p) : s(p,r)\ge\tau\,\},\qquad
\mathrm{CO_2^{nn}}(p)=\frac{1}{|N_\tau|}\sum_{r\in N_\tau}\mathrm{CO_2}(r)\quad\text{nếu } N_\tau\neq\varnothing
$$

Tên và số của các mẫu đã dùng được lưu vào `co2e_references`, để người đọc kiểm tra lại được.

*Ví dụ:* Dell Latitude 5450.

- 5 mẫu Latitude có số 290, 321, 312, 349 và 391 kg; trung vị là 321 kg.
- Khoảng giữ lại là 40,1–2.568 kg, nên không mẫu nào bị bỏ.
- Cả 5 mẫu đều có cosine ≥ 0,66.
- Kết quả: (290 + 321 + 312 + 349 + 391) ÷ 5 = **332,6 kg**.

### 2.3 B3a – Công thức vòng đời cho đồ điện gia dụng

Đồ điện gia dụng gần như không có số của hãng, và phần lớn CO₂ của chúng sinh ra lúc dùng điện. Vì vậy hệ thống tự cộng các giai đoạn:

$$
\boxed{\;\mathrm{CO_2^{life}} = E_{emb} + L\cdot\big(AEC\cdot EF_{VN} + R_{leak}\big) + E_{eol}\;}
$$

| Ký hiệu | Ý nghĩa | Lấy ở đâu |
|---|---|---|
| $E_{emb}$ | Phát thải nguyên liệu, sản xuất và vận chuyển | Mức của loại × $(\text{cỡ}/\text{cỡ chuẩn})^{\beta}$ (HP, lít, kg, inch) |
| $AEC$ | Điện tiêu thụ mỗi năm (kWh/năm) | **Nhãn năng lượng** → nếu không có thì **công suất** × giờ/ngày × ngày/năm × hệ số tải → nếu không có nữa thì **mức thường gặp của loại**. Mức thường gặp được giảm theo inverter và theo số sao trên nhãn |
| $EF_{VN}$ | Hệ số lưới điện Việt Nam | **0,681 kg CO₂e/kWh** (2024, ĐH Bách khoa Hà Nội và Bộ Nông nghiệp và Môi trường) |
| $R_{leak}$ | Rò rỉ môi chất lạnh mỗi năm | Lượng gas nạp × GWP × tỷ lệ rò mỗi năm (máy lạnh, tủ lạnh) |
| $E_{eol}$ | Phát thải khi thải bỏ | Mức của loại + lượng gas nạp × GWP × tỷ lệ thất thoát khi thải bỏ |
| $L$ | Số năm dùng | Mức của loại, ví dụ máy lạnh 10 năm, tủ lạnh 12 năm |

*Ví dụ:* máy lạnh Daikin Inverter 1,5 HP, nhãn 820 kWh/năm. Tham số chuẩn cho 1 HP là sản xuất 300 kg, dùng 10 năm, gas R32 0,6 kg với GWP 675, rò 3 %/năm.

| Thành phần | Phép tính | kg CO₂e |
|---|---|---|
| Sản xuất | 300 × 1,5 | 450 |
| Dùng điện 10 năm | 10 × 820 × 0,681 | 5.584 |
| Rò gas 10 năm | 10 × 0,6 × 675 × 3 % | 121,5 |
| Thải bỏ | 20 + 0,6 × 675 × 30 % | 141,5 |
| **Tổng** | | **≈ 6.297** |

Phần dùng điện chiếm 90,6 % tổng. Nếu dùng hệ số lưới năm 2023 (0,6592), tổng là 6.118 kg.

**Lượng CO₂ tiết kiệm khi dùng $T$ tháng**, so với một máy tiêu chuẩn **cùng công suất** (không inverter, nhãn 1–2 sao):

$$
\Delta\mathrm{CO_2}(T)=\tfrac{T}{12}\,(AEC_b-AEC_p)\,EF_{VN}+\tfrac{T}{12L}\,(E^{b}_{emb}-E^{p}_{emb})+\tfrac{T}{12}\,(R^{b}_{leak}-R^{p}_{leak})
$$

Công thức trả lời trực tiếp câu hỏi "dùng 6 tháng / 1 năm thì giảm được bao nhiêu kg CO₂, bao nhiêu kWh, bao nhiêu tiền điện". Code: `green.co2_formula.estimate_savings`.

**Khoảng bất định.** Sai số tương đối của phần dùng điện được đặt theo nguồn số kWh:

| Nguồn số kWh | Sai số đặt cho phần dùng điện |
|---|---|
| Nhãn năng lượng | ±10 % |
| Công suất | ±25 % |
| Mức thường gặp của loại | ±40 % |

Phần sản xuất được đặt ±30 %. Hệ thống trả về cả khoảng thấp–cao. Các mức này là giả định.

### 2.4 B3b – Mức giữa của loại, chỉnh theo hãng và cỡ màn hình

Cách này dùng cho đồ điện tử thuộc loại có ít nhất 4 mẫu, khi không tìm được mẫu đủ giống. Công thức tính trên thang log:

$$
\ln\mathrm{CO_2^{cat}}(p)=\underbrace{\operatorname{med}_{r\in\mathcal{R}_c}\ln\mathrm{CO_2}(r)}_{\text{mức của loại}}
+\underbrace{\delta_{b}}_{\text{chênh của hãng}}
+\underbrace{\beta_c\ln\!\big(\text{inch}_p/\text{inch}^{ref}_c\big)}_{\text{cỡ màn hình}}
$$

- $\delta_b$ là trung vị log CO₂ của hãng $b$ trong loại, trừ đi mức của loại. Chỉ dùng khi hãng có ≥ 3 mẫu trong loại, nếu không thì $\delta_b=0$. Lý do: mỗi hãng có cách tính riêng, ví dụ Apple thường ra số thấp, Dell thường ra số cao.
- $\beta_c$ được rút ra từ dữ liệu thật:
  - màn hình: $\beta=0{,}81$, cỡ chuẩn 23,8" (n = 304);
  - laptop: $\beta=0{,}53$, cỡ chuẩn 14" (n = 467).

  Nghĩa là màn hình to gấp đôi thì CO₂ tăng khoảng $2^{0{,}81}\approx1{,}75$ lần, không phải gấp đôi.

*Ví dụ:* màn hình Samsung 27". Samsung chưa đủ 3 mẫu màn hình nên dùng mức của cả loại: 491,5 × (27 ÷ 23,8)^0,81 = 491,5 × 1,108 = **544 kg**.

### 2.5 B3c – Theo giá bán × hệ số chuỗi cung ứng (EEIO)

Cách này dành cho loại không có công thức và không có mẫu, như quần áo, sách, mỹ phẩm, đồ chơi. Đây là cách của bài P5 (CaML).

- Hệ thống đổi giá bán sang USD năm 2022, theo tỷ giá và chỉ số giá CPI-U.
- Sau đó nhân với hệ số "kg CO₂e trên mỗi USD" của ngành tương ứng, theo bảng US EPA Supply Chain GHG Emission Factors v1.3.
- 58 loại hàng được gán vào 30 mã ngành.

$$
\mathrm{CO_2^{eeio}}(p)=\frac{g(p)}{25\,900}\times\frac{CPI_{2022}}{CPI_{now}}\times f_{\mathrm{NAICS}(c)}
=\frac{g}{25\,900}\times\frac{292{,}655}{336{,}940}\times f
$$

*Ví dụ:* áo thun 199.000 đ → 7,68 USD → 6,67 USD (giá 2022) × 0,12 = **0,8 kg**.

Cách này chỉ gồm phần sản xuất và vận chuyển, không tính điện lúc dùng. Nó cũng rất thô: hàng đắt vì thương hiệu bị tính nhiều CO₂ hơn. Vì vậy đây là cách cuối cùng trong chuỗi.

### 2.6 Dùng con số: điểm xanh 0–5

Điểm xanh tính theo Kalisvaart et al. 2025 (P1), so trong cùng loại hàng:

$$
G(p)=\operatorname{clip}_{[0,5]}\!\left(5\cdot\frac{\ln(U_c/\mathrm{CO_2}(p))}{\ln(U_c/L_c)}\right)
$$

- $[L_c,U_c]$ là khoảng CO₂ hợp lý của loại. Ví dụ laptop 60–1.000 kg, máy lạnh 1.400–25.000 kg. Bảng đầy đủ nằm trong `backend/services/db-search/green_score.py`.
- Khoảng riêng cho từng loại là đề xuất của nhóm. Công thức gốc đã được kiểm khớp 5.595/5.595 dòng dữ liệu mà tác giả bài P1 công bố.
- Thang log hợp với phân bố CO₂, vốn lệch phải và trải rộng nhiều bậc độ lớn.
- Sản phẩm chưa có số thì **không có điểm xanh**.

### 2.7 Dùng con số: xếp hạng bằng weighted RRF

Mỗi lần tìm kiếm có 50 ứng viên. Mỗi ứng viên có hai thứ hạng:

- $\rho_{rel}$: hạng hợp nhu cầu, do CatBoost tính;
- $\rho_{co2}$: hạng ít CO₂, với 1 là ít nhất.

Điểm cuối cùng theo Vestrum et al. 2026 (P3):

$$
S(p)=\frac{1}{k+\rho_{rel}(p)}+w\cdot\frac{1}{k+\rho_{co2}(p)},\qquad k=60,\ w=0{,}2
$$

- Chỉ dùng **thứ hạng**, không dùng số kg. Nhờ vậy, con số có sai một ít thì kết quả vẫn đúng, miễn là thứ tự đúng.
- Trọng số $w = 0{,}2$ giữ nhu cầu là chính; CO₂ chỉ phá thế hòa.
- Sản phẩm chưa có số nhận **hạng ở giữa**, $(n_{known}+1)/2$: không được thưởng, cũng không bị phạt.
- Code: `backend/services/ranking_system/rrf.py`, có 6 test.

### 2.8 Dùng con số: tách theo giai đoạn để hiển thị

Trang kết quả hiển thị sơ đồ "từ nơi sản xuất đến tay người dùng". Hệ thống tách tổng $\mathrm{CO_2}(p)$ thành 4 giai đoạn: nguyên liệu và sản xuất, vận chuyển, sử dụng, thải bỏ.

Phép tách này **chỉ để hiển thị**: tổng luôn bằng đúng con số `co2e_kg` đã lưu (yêu cầu YC-5). Code: `green/lifecycle.py` và `green/explain.py` (công thức thế số), có test `tests/test_explain.py`; etl-worker lưu kết quả vào cột `co2e_detail`, `co2e_breakdown`.

- **Nguồn `lifecycle_formula`.** Tách chính xác theo các số hạng của §2.3:
  - phần vận chuyển được tính riêng và trừ ra khỏi $E_{emb}$:

$$
E_{trans}=m\cdot d\cdot EF_{mode}
$$

  - $m$ là khối lượng sản phẩm (tấn), $d$ là quãng đường từ nước sản xuất về Việt Nam (km), $EF_{mode}$ là hệ số của phương tiện (kg CO₂e/tấn·km, đường biển / đường bộ / hàng không);
  - phần sử dụng bằng $L\cdot(AEC\cdot EF_{VN}+R_{leak})$;
  - phần thải bỏ bằng $E_{eol}$.
- **Các nguồn khác** (số của hãng, trung bình mẫu giống, mức giữa của loại, theo giá):
  - tổng được chia theo **tỷ lệ giai đoạn điển hình của loại**, lấy từ `green/data/stage_shares.json`;
  - trên giao diện luôn ghi nhãn "tỷ lệ điển hình – giả định".

  Khi danh sách mẫu có trường `stage_share` lấy từ báo cáo của hãng (việc A6), tỷ lệ của hãng sẽ thay cho tỷ lệ điển hình.
- Giá trị cụ thể của $EF_{mode}$, quãng đường và tỷ lệ điển hình là **tham số giả định**, chưa kiểm định.

---

## 3. Tính mới

| Khía cạnh | Các cách làm trước | Cách của nhóm |
|---|---|---|
| Nguồn con số | Một số công trình (Vestrum et al., Spillo et al.) hỏi mô hình ngôn ngữ để ra **một con số tổng** | Số luôn truy về báo cáo của hãng hoặc một công thức minh bạch. AI chỉ đo độ giống. Trong thử nghiệm, mô hình ngôn ngữ (Qwen) sai trung bình **77,2 kg**, còn trung bình mẫu giống sai **68,0 kg**. Mô hình 0,8B còn đoán chuột máy tính khoảng 76 kg, trong khi số thật dưới 5 kg |
| Cách tính | Mỗi bài dùng một cách: P1 dùng số có sẵn, P5 dùng EEIO theo giá | **Ghép năm cách thành một chuỗi có thứ tự ưu tiên rõ ràng.** Mỗi con số mang nhãn nguồn, độ tin cậy và danh sách mẫu đã dùng |
| Khi không đủ căn cứ | Vẫn ra một con số | **Ngưỡng giống 0,66 + để trống.** Bỏ ngưỡng thì 9/12 sản phẩm thuộc loại chưa có mẫu bị lệch quá 2 lần |
| Giai đoạn sử dụng | Dùng số của hãng, vốn tính theo lưới điện Mỹ hoặc châu Âu | **Tính phần dùng điện theo lưới điện Việt Nam** (0,681 kg CO₂e/kWh năm 2024) và theo **nhãn năng lượng Việt Nam** (1–5 sao, kWh/năm) |
| Đồ điện gia dụng | Gần như không có số | **Công thức vòng đời** có rò rỉ môi chất lạnh, cộng **lượng CO₂ tiết kiệm sau 6 và 12 tháng** so với máy cùng công suất |
| Cỡ màn hình | Bỏ qua, hoặc cho CO₂ tỷ lệ thuận với cỡ | **Hệ số mũ rút từ dữ liệu thật:** 0,81 cho màn hình, 0,53 cho laptop |
| Dùng con số | Trộn số kg vào điểm xếp hạng | **Chỉ dùng thứ hạng** (weighted RRF), nên ít nhạy với sai số tuyệt đối. Điểm xanh dùng thang log và so trong cùng loại |

## 4. Tính ứng dụng

- **Dùng được ngay trên sàn Việt Nam.**
  - Đầu vào chỉ là tên, mô tả, danh mục và giá mà bộ cào đã lấy từ các sàn.
  - Hiểu cách ghi tiếng Việt: "Máy lạnh … 1 HP", "Nhãn năng lượng 5 sao", "Tiêu thụ điện 280 kWh/năm", "Điện năng tiêu thụ: 1.02 kW/h" (`green/spec_parser.py`).
- **Tính được cho phần lớn danh mục.**
  - Trên 10.000 sản phẩm thử, hệ thống ra số cho **7.406 sản phẩm (74 %)**.
  - Sản phẩm thuộc loại chưa có cách tính thì để trống chứ không đoán.
- **Minh bạch.**
  - Giao diện hiện nhãn nguồn, độ tin cậy, câu giải thích tiếng Việt và tiếng Anh, và các mẫu đã dùng (tên, số kg, độ giống).
  - Trang AI hiện **công thức đã thế số thật**, ví dụ 491,5 × (27 ÷ 23,8)^0,81 = 544 kg.
- **Không phụ thuộc AI trả phí.**
  - Toàn bộ phần tính nằm trong gói Python thuần `green/`: không gọi mạng, không gọi cơ sở dữ liệu, có 47 test.
  - Mô hình AI chỉ dùng để đo độ giống (OpenCLIP, chạy cục bộ) và viết lời giải thích.
- **Mở ra các kênh khác.**
  - Cùng con số được trả qua API cho trang web, cho ChatGPT dưới dạng MCP server, và cho luồng "AI so sánh rồi đặt mua thử".
  - Con số giống hệt nhau ở mọi nơi vì cùng lấy từ cột `co2e_kg`.
- **Dễ mở rộng.**
  - Thêm một mẫu mới chỉ cần thêm một dòng JSON có link báo cáo gốc.
  - Đổi hệ số lưới điện, tỷ giá hay CPI chỉ cần đổi biến môi trường `CO2_GRID_EF`, `CO2_VND_PER_USD`, `CO2_CPI_NOW`.

## 5. Độ hiệu quả

### 5.1 Bộ thử 28 sản phẩm có số thật

Điều kiện chạy: danh sách 121 mẫu, CLIP thay thế (ViT-B-32-quickgelu, trọng số LAION-400M), chưa chạy Qwen.

**Nhóm A** – 16 sản phẩm thuộc loại đã có mẫu:

| Cách | Có số | Sai trung bình | Sai % | Lệch > 2× | Spearman |
|---|---|---|---|---|---|
| Bản chốt, tên tiếng Việt | 15/16 | 56,4 kg | 21,9 % | 0 | 0,95 |
| Bản chốt, tên tiếng Anh | 16/16 | 48,5 kg | 20,4 % | 0 | 0,95 |
| Trung vị cả loại (để so) | 16/16 | 58,0 kg | 24,0 % | 0 | 0,97 |

**Nhóm B** – 12 sản phẩm thuộc loại chưa có mẫu:

| Cách | Kết quả |
|---|---|
| Bỏ ngưỡng 0,66 | 12/12 có số, nhưng **9/12 lệch quá 2 lần**. Ví dụ webcam C920: thật 5,66 kg → đoán 375 kg |
| Có ngưỡng, tên tiếng Việt | 0/12 có số: đều để trống, không có số sai |
| Có ngưỡng, tên tiếng Anh | 3/12 lọt ngưỡng, 2 trong 3 lệch quá 2 lần |

→ **Ngưỡng 0,66 là bắt buộc.**

### 5.2 Bỏ cả dòng máy (1.450 mẫu, chạy lại 23/11/2026)

Lệnh chạy lại: `python scripts/research/eval_co2_methods.py`. Chi tiết trong [../research/results-co2-eval.md](../research/results-co2-eval.md).

Mỗi mẫu được đoán từ các mẫu còn lại, sau khi bỏ cả dòng máy của nó. Bảng dưới là kết quả trên n = 1.435 sản phẩm:

| Cách | MdAPE | MAPE | Lệch > 2× | Spearman | Đúng thứ tự cặp trong loại |
|---|---|---|---|---|---|
| Trung vị loại | 24,1 % | 41,9 % | 10,5 % | 0,644 | (không mang thông tin thứ tự) |
| **Mức giữa của loại + hãng + cỡ màn hình (B3b)** | **20,9 %** | 39,0 % | **8,9 %** | **0,738** | 55,4 % |

| Loại (B3b) | n | MdAPE |
|---|---|---|
| Màn hình | 330 | 13,8 % |
| Điện thoại | 100 | 13,7 % |
| Máy để bàn | 238 | 22,2 % |
| Laptop | 587 | 22,6 % |
| Máy tính bảng | 60 | 25,0 % |
| Đồng hồ, chuột / bàn phím / webcam, nhà thông minh | | 36–40 % |

**Cách đọc kết quả:**

- B3b cho **độ lớn** đúng trong khoảng ±20 % với các loại chính, và giữ đúng thứ tự giữa các loại.
- Nhưng **thứ tự trong cùng một loại** chỉ đúng khoảng 55 % số cặp, vì cách này chỉ dựa vào hãng và cỡ màn hình.
- Vì thế CO₂ chỉ dùng để phá thế hòa ($w=0{,}2$), và giao diện luôn hiện nguồn số.
- Muốn xếp đúng thứ tự trong loại thì cần B1 hoặc B2, tức cần **thêm số thật của hãng**.

**Ghi chú trung thực.** Tài liệu cũ `docs/research/co2-fallback.md` ghi MdAPE 18,5 % (màn hình 9,4 %), chạy bằng một script nằm ngoài repo.

- Lần chạy lại bằng code hiện tại ra 20,9 % (màn hình 13,8 %), sau khi đã sửa bộ đọc cỡ màn hình dạng "27-inch".
- Phần trung vị loại ra trùng số cũ (24,1 %), nên dữ liệu khớp; chênh lệch nằm ở bước đọc cỡ màn hình.
- Bộ đọc hiện lấy được cỡ màn hình cho 44/330 tên màn hình trong danh sách mẫu (phần lớn tên mẫu không ghi cỡ).
- Bản nộp này dùng số chạy lại được.

### 5.3 Kiểm tra bước trùng đúng mẫu

| Kiểm tra | Kết quả |
|---|---|
| Tra lại 1.423 tên mẫu đủ điều kiện | 1.423 tìm thấy (100 %) |
| … trong đó khớp sang mẫu khác có số khác | Ban đầu 4 trường hợp, do dấu "+" hoặc "-" (S9+ → S9, Surface Pro 7+ → 7). Đã sửa dấu "+" (23/11/2026, có test): còn 2 trường hợp do dấu "-" |
| Tên kiểu cửa hàng (bỏ tên hãng, thêm chữ tiếng Việt) | 68,7 % vẫn khớp |

### 5.4 So với AI đoán số

Trên cùng bộ thử, mô hình ngôn ngữ (Qwen 3.5 0,8B) **không thắng** cách lấy trung bình mẫu giống ở chỉ số nào: sai trung bình 77,2 kg so với 68,0 kg. Vì vậy bản chốt không để AI ra số.

### 5.5 Độ phủ trên 10.000 sản phẩm

Bộ thử gồm 1.450 mẫu cộng 8.550 sản phẩm điện tử từ bộ dữ liệu Amazon (EcoAmazon):

| Cách có số CO₂ | Số sản phẩm |
|---|---|
| Danh sách mẫu (số của hãng) | 1.450 |
| Trùng đúng mẫu | 33 |
| Trung bình mẫu giống | 398 |
| Công thức vòng đời | 52 |
| Mức giữa của loại | 2.271 |
| Theo giá (EEIO) | 3.202 |
| Chưa có số | 2.594 |
| **Có số** | **7.406 (74 %)** |

- Có 460 dòng bị đánh dấu cảnh báo vì nằm ngoài khoảng hợp lý của loại. Phần lớn là phụ kiện rẻ tính theo giá.
- Các số mới **chưa được kiểm tra bằng tay** (việc A8).

### 5.6 Công thức vòng đời

Kết quả chạy `estimate_co2` với tham số mặc định:

| Sản phẩm | Tổng (lưới 0,681) | Phần dùng điện | Ghi chú |
|---|---|---|---|
| Máy lạnh Daikin 1,5 HP, nhãn 820 kWh/năm | 6.297 kg | 90,6 % | Với lưới 0,6592: 6.118 kg |
| Tủ lạnh inverter 322 L (mặc định loại) | 2.047 kg | 83,9 % | |
| Tivi 75" (mặc định loại) | 1.971,5 kg | 74,4 % | Samsung công bố 982–2.388 kg cho 4 mẫu 75" |
| Máy giặt inverter 9 kg | 720 kg | 63,9 % | |

Ngoài tivi, công thức **chưa được kiểm định** với số thật của hãng, vì mới có 5 số thật cho đồ gia dụng.

## 6. Thử nghiệm thực tế

**Chạy trên toàn hệ thống.** Hệ thống chạy với sản phẩm thật cào từ sàn Việt Nam: bộ cào trên Airflow → Kafka → etl-worker → Postgres. Một số kết quả:

| Sản phẩm trên sàn | CO₂ | Cách tính |
|---|---|---|
| Dell Latitude 5420 | 300 kg | |
| Màn hình Samsung Odyssey G5 27" | 544 kg | Mức giữa của loại |
| Máy lạnh Daikin 1,5 HP, nhãn 820 kWh/năm | ≈ 6.300 kg | Công thức vòng đời |
| Áo thun | 0,8 kg | Theo giá |

**Cách chạy lại:**

```bash
# test phần CO₂ và xếp hạng (không cần Docker)
cd backend/services/etl-worker && python -m pytest tests/test_exact_match.py tests/test_fallback.py tests/test_green.py tests/test_explain.py
# trang AI, đơn hàng thử, MCP (cài requirements của từng dịch vụ trước)
cd backend/services/assistant && python -m pytest
cd backend/services/mcp-server && python -m pytest
cd backend/services/ranking_system && python -m pytest test_rrf.py
# kiểm định bằng cách bỏ cả dòng máy (§5.2)
python scripts/research/eval_co2_methods.py
# toàn hệ thống
docker compose -f docker-compose.dev.yml up --build -d
```

**Bộ câu hỏi demo cố định:** [scripts/research/demo_queries.txt](../../scripts/research/demo_queries.txt), gồm 12 câu. Ví dụ: "laptop dưới 20 triệu ít CO2", "màn hình 27 inch xanh nhất", "máy lạnh 1 HP tiết kiệm điện".

- Mỗi câu hỏi tạo một trang AI có công thức thế số, sơ đồ vòng đời, biểu đồ và lượng tiết kiệm.
- Hệ thống ghi lại số câu AI viết sai số (`number_check_failures`). Mục tiêu là 0.
- Kết quả của bộ câu hỏi này trên bản dựng demo **chưa đo**. Sẽ bổ sung sau khi quay video.

## 7. Hạn chế và hướng phát triển

**Hạn chế:**

| Hạn chế | Ảnh hưởng |
|---|---|
| Danh sách mẫu lệch về laptop, màn hình và máy để bàn | Loại chưa có mẫu thì gần như luôn để trống, hoặc chỉ có số theo giá |
| Tên tiếng Việt cho kết quả kém hơn tên tiếng Anh, vì OpenCLIP học chủ yếu bằng tiếng Anh | Ít sản phẩm tìm được mẫu giống hơn |
| Thử nghiệm 28 sản phẩm chạy với 121 mẫu và CLIP thay thế | Cần chạy lại với 1.450 mẫu và mô hình thật để chỉnh lại ngưỡng 0,66 |
| Các cách tính không cùng phạm vi: số của hãng dùng lưới điện nước ngoài, số theo giá không tính điện lúc dùng | Chỉ nên so trong cùng loại. Giao diện hiện nguồn số bên cạnh con số |
| Tham số của công thức đồ gia dụng, hệ số vận chuyển và tỷ lệ giai đoạn điển hình đều là giả định | Chưa kiểm định |
| Các cách dự phòng xếp thứ tự trong cùng loại yếu (≈ 55 % cặp đúng) | CO₂ chỉ dùng để phá thế hòa |

**Hướng phát triển** (mã việc theo đặc tả):

| Mã | Việc |
|---|---|
| A1 | Chạy lại thử nghiệm với 1.450 mẫu và CLIP thật, quét các ngưỡng khác nhau |
| A2 | Thêm số thật của hãng cho đồ gia dụng, ít nhất 5 mẫu mỗi loại, để kiểm định công thức |
| A3 | Cào kWh/năm và công suất từ Điện Máy Xanh và Thế Giới Di Động. Hiện chưa bộ cào nào lấy hai trường này |
| A4 | Dịch tên tiếng Việt trước khi so, hoặc dùng mô hình đa ngôn ngữ |
| A5 | Bước trùng mẫu: bỏ qua khác biệt dung lượng, sửa nốt lỗi dấu "-" (dấu "+" đã sửa) |
| A6 | Tính lại phần sử dụng theo lưới điện Việt Nam cho số của hãng, khi báo cáo có tách giai đoạn |
| A7 | Thay hệ số US EPA bằng bảng Input–Output của Việt Nam |
| A8 | Kiểm tra tay 200 dòng trong 8.550 số mới |
| – | ~~Sửa `spec_parser` để đọc được cỡ màn hình dạng "27-inch"~~ — đã xong 23/11/2026 |

## Nguồn

- Bài báo nhóm: *Eco-Conscious AI-Powered Multimodal Product Recommendation System for Vietnamese E-Commerce* (`paper/research_paper.tex`).
- P1 – Kalisvaart et al. 2025, *Carbon Footprint-Aware RecSys* (arXiv 2503.17201).
- P3 – Vestrum et al. 2026, *Carbon-Aware Re-ranking* (arXiv 2606.04550).
- P5 – CaML / EEIO; US EPA Supply Chain GHG Emission Factors v1.3.
- Hệ số lưới điện Việt Nam 2024: 0,681 kg CO₂e/kWh (Vietnam News, 2025).
- Giả định số năm dùng: Apple Environment Answers; Dell Latitude E5540 PCF.
- Tài liệu chi tiết: [source/phuong-phap-tinh-co2-ban-chi-tiet.md](source/phuong-phap-tinh-co2-ban-chi-tiet.md), [../research/co2-formula.md](../research/co2-formula.md), [../research/co2-fallback.md](../research/co2-fallback.md), [../research/co2-eeio-extension.md](../research/co2-eeio-extension.md), [../research/results-co2-eval.md](../research/results-co2-eval.md).
