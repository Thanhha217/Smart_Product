# **Phương pháp tính CO₂ cho sản phẩm – bản chi tiết**

## **1\. Mục đích và khái niệm**

Tài liệu này mô tả đầy đủ cách CarbonSense AI (nhánh new-research) tính lượng CO₂ cho từng sản phẩm điện tử lấy từ các sàn Việt Nam, và cách dùng con số đó để xếp hạng.

**Mục tiêu:** khi người dùng tìm một món đồ, những món vừa đúng nhu cầu vừa ít phát thải được đưa lên trước. Hệ thống không cần biết chính xác từng kg; nó cần biết đúng **thứ tự** món nào xanh hơn món nào trong cùng loại.

**CO₂ của sản phẩm (PCF – Product Carbon Footprint)** là tổng khí nhà kính một món đồ gây ra trong cả vòng đời, quy về **kg CO₂e** (CO₂ tương đương). Theo khung *cradle-to-grave* của ISO 14067, vòng đời gồm 5 giai đoạn:

1. Khai thác nguyên liệu

2. Sản xuất

3. Vận chuyển, phân phối

4. Sử dụng (chủ yếu là điện tiêu thụ)

5. Thải bỏ, tái chế

**Phạm vi hiện tại:** đồ điện tử (điện thoại, laptop, máy tính bảng, màn hình, và dần mở rộng sang đồng hồ, loa, tivi, phụ kiện). Đồ gia dụng như tủ lạnh, điều hòa là câu hỏi còn mở (xem mục 9).

**Nguyên tắc cốt lõi:** con số CO₂ luôn truy về được báo cáo của hãng. AI chỉ dùng để tìm sản phẩm giống nhau, không tự sinh ra con số. Không đủ căn cứ thì **để trống**, không đoán.

## **2\. Dữ liệu đầu vào**

| Đầu vào | Nội dung | Ghi chú |
| :---- | :---- | :---- |
| Thông tin sản phẩm từ sàn | Tên, mô tả, danh mục cửa hàng | Danh mục được đổi sang nhóm chuẩn bằng bảng từ khóa. **Không dùng giá.** |
| Danh sách mẫu | 121 sản phẩm có số CO₂ thật từ báo cáo của hãng (EPD/PCF) | Hiện có: điện thoại 39, màn hình 37, laptop 29, máy tính bảng 15, tai nghe 1\. |
| Khoảng hợp lý theo loại \[L, U\] | Mức CO₂ thấp nhất và cao nhất hợp lý cho mỗi loại | Ví dụ laptop 60–800 kg. Dùng để kẹp điểm xanh (mục 6). |
| Hệ số lưới điện Việt Nam | 0,681 kg CO₂e/kWh (2024) | Chỉ dùng nếu tính riêng giai đoạn sử dụng (mục 5). |

**Mỗi dòng trong danh sách mẫu cần có:** hãng, tên mẫu, loại sản phẩm, số kg CO₂e, link báo cáo gốc. Thiếu link nguồn thì chưa được dùng.

**Cách thêm mẫu mới:** lấy báo cáo môi trường của hãng (Apple, Dell, HP, Lenovo, Samsung, Google, Logitech…), ghi đúng con số tổng vòng đời, ghi loại theo nhóm chuẩn (ví dụ headphone, không phải earphone), và dán link. Mục tiêu: mỗi loại có ít nhất 5 mẫu.

## **3\. Quy trình tính cho một sản phẩm**

Mỗi sản phẩm đi qua 3 bước theo thứ tự. Dừng ở bước đầu tiên cho ra kết quả.

### **Bước 1 – Hãng đã công bố cho đúng mẫu này chưa?**

* So tên sản phẩm (hãng \+ dòng máy \+ phiên bản) với danh sách mẫu.

* Khớp đúng mẫu → dùng luôn số của hãng. Nguồn ghi là **số của hãng**.

* Ví dụ: "MacBook Air 13 inch M3" có trong danh sách mẫu với 135 kg → kết quả 135 kg.

* *Trạng thái code:* bước này **chưa có** trong carbon\_estimator.py, cần thêm.

### **Bước 2 – Tìm sản phẩm giống nhất**

1. **Biến chữ thành vector:** OpenCLIP đọc *tên \+ mô tả* của sản phẩm cần tính, và *hãng \+ tên \+ loại* của từng mẫu, rồi đổi mỗi cái thành một vector 512 chiều. Lưu ý OpenCLIP chỉ đọc khoảng 77 token đầu, nên tên sản phẩm phải nằm ở đầu chuỗi.

2. **Đo độ giống:** tính cosine giữa sản phẩm cần tính và từng mẫu (0 \= không giống, 1 \= giống hệt).

3. **Lấy 5 mẫu giống nhất**, ưu tiên mẫu **cùng loại** (cùng là laptop, cùng là điện thoại…).

4. **Bỏ số bất thường:** tính trung vị CO₂ của 5 mẫu; bỏ mẫu nào nằm ngoài khoảng *trung vị ÷ 8* đến *trung vị × 8*.

5. **Lọc theo ngưỡng:** chỉ giữ mẫu có cosine **≥ 0,66**. Đây là bước bắt buộc; thử nghiệm cho thấy bỏ ngưỡng thì 9/12 sản phẩm loại mới bị lệch quá 2 lần.

### **Bước 3 – Ra con số**

* **Còn ít nhất 1 mẫu** → CO₂ \= trung bình cộng CO₂ của các mẫu còn lại. Nguồn ghi là **trung bình**, kèm tên các mẫu đã dùng.

* **Không còn mẫu nào** → **để trống** (NULL). Không đoán, không hỏi AI.

![][image1]

### **Tóm tắt quy tắc**

| Quy tắc | Giá trị | Lý do |
| :---- | :---- | :---- |
| Số mẫu xét | 5 giống nhất | Theo bài Vestrum 2026 (P3) |
| Ưu tiên | Cùng loại | Tránh lấy điện thoại để ước tính đồng hồ |
| Lọc bất thường | trung vị ÷ 8 đến × 8 | Loại mẫu sai đơn vị hoặc khác hẳn cỡ |
| Ngưỡng giống | cosine ≥ 0,66 | Thấp hơn thì thường là khác loại |
| Không đủ mẫu | Để trống | Một con số sai còn tệ hơn không có số |

## **4\. Ví dụ tính tay**

**Ví dụ 1 – MacBook Air 13" M3 (dừng ở Bước 1\)**

* Có đúng mẫu trong danh sách: hãng công bố **135 kg CO₂e**.

* Kết quả: 135 kg · nguồn: số của hãng.

**Ví dụ 2 – Dell Latitude 5450 (dừng ở Bước 3, lấy trung bình)**

* Không có đúng mẫu → tìm sản phẩm giống.

* 5 mẫu giống nhất đều là laptop Dell Latitude, CO₂: 290, 321, 312, 349, 391 kg.

* Trung vị \= 321 kg → khoảng giữ lại 40,1–2.568 kg → cả 5 mẫu đều nằm trong.

* Cả 5 mẫu có cosine ≥ 0,66 → giữ hết.

* CO₂ \= (290 \+ 321 \+ 312 \+ 349 \+ 391\) ÷ 5 \= 1.663 ÷ 5 \= **332,6 kg**.

* Kết quả: 332,6 kg · nguồn: trung bình · mẫu đã dùng: 5 máy Latitude.

**Ví dụ 3 – Đồng hồ thông minh (để trống)**

* Danh sách mẫu chưa có đồng hồ. Với tên tiếng Việt, mọi mẫu giống nhất (máy tính bảng, điện thoại) đều có cosine dưới 0,66.

* Không còn mẫu nào → **để trống**.

* Ngưỡng chưa tách sạch hoàn toàn: với tên tiếng Anh, Apple Watch vẫn lọt ngưỡng vì giống iPad Pro và bị tính ra khoảng 93 kg, trong khi Apple Watch S11 thật chỉ 8,1 kg. Cách chữa tận gốc là thêm mẫu đồng hồ vào danh sách (mục 9).

## **5\. Giai đoạn sử dụng (hướng mở rộng)**

Số của hãng là tổng cả vòng đời, nhưng phần "sử dụng" được hãng tính theo lưới điện nơi khác (thường là Mỹ hoặc châu Âu). Lưới điện Việt Nam nhiều điện than hơn, nên dùng ở Việt Nam thực tế thải nhiều hơn. Có thể tính lại riêng phần này bằng công thức:

**CO₂ khi dùng (kg) \= Điện mỗi năm (kWh/năm) × Số năm dùng × Hệ số lưới điện (kg CO₂e/kWh)**

| Ký hiệu | Ý nghĩa | Lấy ở đâu |
| :---- | :---- | :---- |
| E năm | Điện tiêu thụ mỗi năm | Nhãn năng lượng (tủ lạnh, điều hòa…), hoặc công suất W × giờ dùng/ngày × 365 ÷ 1000 |
| T | Số năm dùng | Giả định của hãng: Apple tính 3 năm cho iPhone, 4 năm cho Mac; Dell tính 4 năm cho laptop |
| EF VN | Hệ số lưới điện Việt Nam | 0,681 kg CO₂e/kWh năm 2024 (ĐH Bách khoa Hà Nội và Bộ Nông nghiệp và Môi trường) |

**Cách ghép với số của hãng** (để không tính trùng):

**CO₂ ở Việt Nam \= CO₂ hãng công bố − Phần sử dụng hãng tính \+ Phần sử dụng tính theo lưới điện Việt Nam**

Chỉ làm được khi báo cáo của hãng tách riêng phần trăm giai đoạn sử dụng. Không có thì giữ nguyên số của hãng.

**Ví dụ:** tủ lạnh nhãn 485 kWh/năm, giả sử dùng 10 năm (giả định, chưa có nguồn): 485 × 10 × 0,681 ≈ 3.303 kg CO₂e chỉ riêng phần dùng điện.

**Khi nào đáng làm:** với điện thoại, phần dùng điện nhỏ (iPhone 5 khoảng 18%), nên ít đổi thứ hạng. Với máy chạy liên tục (tủ lạnh, điều hòa, tivi), phần này lớn và nên tính riêng.

*Trạng thái:* chưa có trong code. Cần cào thêm cột "Điện năng tiêu thụ (kWh/năm)" hoặc "Công suất (W)" từ trang sản phẩm.

## **6\. Dùng kết quả: xếp hạng và điểm xanh**

### **6.1 Xếp hạng (weighted RRF)**

Với mỗi lần tìm kiếm, 50 sản phẩm ứng viên có hai thứ hạng: hạng hợp nhu cầu (từ CatBoost) và hạng ít CO₂ (1 \= ít nhất). Điểm cuối:

**Điểm \= 1 ÷ (60 \+ hạng nhu cầu) \+ 0,2 × 1 ÷ (60 \+ hạng CO₂)**

* k \= 60 làm khoảng cách giữa các hạng đều nhau, không để hạng 1 áp đảo.

* Trọng số 0,2 giữ cho nhu cầu là chính; CO₂ chỉ phá thế hòa.

* Chỉ dùng **hạng**, không dùng số kg, nên sai số tuyệt đối không ảnh hưởng nếu thứ tự đúng.

**Ví dụ:** A có hạng nhu cầu 1, hạng CO₂ 10 → 1/61 \+ 0,2/70 ≈ 0,01925. B có hạng nhu cầu 2, hạng CO₂ 1 → 1/62 \+ 0,2/61 ≈ 0,01941. B vượt A.

**Sản phẩm để trống CO₂:** bản chốt cho nhận **hạng ở giữa** (không đẩy lên, không dìm xuống). Bài báo V1 ghi "hạng cuối", tức bị phạt nhẹ; cần thống nhất lại một cách.

### **6.2 Điểm xanh 0–5**

Để hiển thị cho người dùng. Điểm càng cao càng xanh, so trong cùng loại:

**Điểm xanh \= 5 × ln(U ÷ c) ÷ ln(U ÷ L)**

L, U là khoảng của loại. Ví dụ laptop L \= 60, U \= 800:

| Sản phẩm | CO₂ (kg) | Điểm xanh |
| :---- | :---- | :---- |
| MacBook Air 13" M3 | 135 | 5 × ln(800/135) / ln(800/60) \= 5 × 1,779 / 2,590 ≈ **3,4** |
| Dell Latitude 5450 | 332,6 | 5 × ln(800/332,6) / 2,590 \= 5 × 0,878 / 2,590 ≈ **1,7** |

Công thức theo bài Kalisvaart 2025 (P1), đã kiểm chứng khớp 5.595/5.595 dòng dữ liệu tác giả công bố. Khoảng L–U riêng cho điện tử là đề xuất của nhóm. *Trạng thái:* RRF được mô tả trong bài báo V1 cho bộ xếp hạng; etl-worker chưa có code cho cả RRF lẫn điểm xanh theo bản chốt.

## **7\. AI dùng ở đâu và đầu ra lưu gì**

### **7.1 Các mô hình**

| Mô hình | Dùng để | Vào | Ra | Trong bản chốt |
| :---- | :---- | :---- | :---- | :---- |
| OpenCLIP ViT-B-32, laion2b\_s34b\_b79k (open\_clip\_torch 3.3.0) | Đo độ giống tên sản phẩm | Sản phẩm: tên \+ mô tả; mẫu: hãng \+ tên \+ loại | Vector 512 chiều → cosine | Bắt buộc |
| Qwen3.5 0.8B qua Ollama (qwen3.5:0.8b, temperature 0,05, tối đa 300 token, JSON, timeout 90 s) | Đoán số kg và viết câu giải thích | Tên, 300 ký tự mô tả, mẫu giống làm tham chiếu | co2e\_kg, explanation\_en, explanation\_vi | Không dùng để ra số; có thể dùng để viết câu giải thích |
| paraphrase-multilingual-MiniLM-L12-v2 | Đoán danh mục khi bảng từ khóa không nhận ra | Tên danh mục | Loại gần nhất | Đang tắt (CATEGORY\_EMBEDDINGS=off) |

**Vì sao không để Qwen ra số:** trong thử nghiệm của bài báo V1, Qwen không thắng cách lấy trung bình hàng xóm ở chỉ số nào (sai TB 77,2 kg so với 68,0 kg). Mô hình 0,8B còn đoán chuột máy tính khoảng 76 kg, trong khi thật dưới 5 kg.

**Khác biệt với code hiện tại:** code đang hỏi Qwen trước, chỉ dùng trung bình khi Qwen bị loại (lệch \> 4 lần trung bình, ngoài \[L, U\], đồ nhỏ \> 150 kg, hoặc ngoài 0,1–5.000 kg). Bản chốt đảo lại: trung bình là kết quả chính.

### **7.2 Đầu ra lưu trong bảng product**

| Cột | Ý nghĩa |
| :---- | :---- |
| co2e\_kg | Số kg CO₂e, hoặc NULL nếu để trống |
| co2e\_source | Nguồn: số của hãng / trung bình (code hiện dùng llm\_estimate / neighbor\_fallback) |
| co2e\_confidence | Mức tin cậy (hiện đặt tay 0,6 / 0,4 / 0,3) |
| co2e\_explanation, co2e\_explanation\_vi | Câu giải thích tiếng Anh và tiếng Việt |
| *(cần thêm)* tên mẫu đã dùng | Để người đọc kiểm tra lại được con số |

Lưu ý khi chuyển sang bản chốt: sản phẩm đã có co2e\_kg (theo product\_url) sẽ được dùng lại, nên phải xóa số cũ để tính lại.

## **8\. Kết quả thử nghiệm**

**Bộ thử:** 28 sản phẩm có số thật của hãng, chia hai nhóm.

* **Nhóm A (16, loại đã có mẫu):** điện thoại 4, laptop 4, máy tính bảng 3, màn hình 5\.

* **Nhóm B (12, loại chưa có mẫu):** đồng hồ 2, loa 2, Apple TV 1, tivi 75" 2, webcam/bàn phím/chuột 4, tai nghe chụp tai 1\.

*Mô hình khi chạy thử:* CLIP ViT-B-32-quickgelu, trọng số LAION-400M (bản laion2b và Ollama không tải được trên máy thử). Chưa chạy Qwen.

### **Nhóm A**

| Cách | Có số | Sai trung bình | Sai % | Lệch \> 2 lần | Spearman |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Bản chốt, tên tiếng Việt | 15/16 | 56,4 kg | 21,9% | 0 | 0,95 |
| Bản chốt, tên tiếng Anh | 16/16 | 48,5 kg | 20,4% | 0 | 0,95 |
| Trung vị cả loại (để so) | 16/16 | 58,0 kg | 24,0% | 0 | 0,97 |

### **Nhóm B**

* **Bỏ ngưỡng 0,66:** 12/12 có số nhưng 9/12 lệch quá 2 lần (tên Việt). Ví dụ chuột M185 thật 3,97 kg → 71,6 kg; webcam C920 5,66 kg → 375 kg; tivi QN900D 2.388 kg → 211 kg.

* **Có ngưỡng:** tên Việt 0/12 có số (đều để trống). Tên Anh 3/12 lọt ngưỡng, 2 trong số đó sai quá 2 lần.

### **Điều rút ra**

1. Ngưỡng 0,66 là bắt buộc.

2. Ưu tiên cùng loại không đổi kết quả nào trong 28 sản phẩm.

3. Tên tiếng Việt làm kết quả kém hơn (ít có số hơn, sai nhiều hơn).

4. 0,66 chưa tách sạch với bản CLIP thay thế: 34,8% cặp cùng loại đạt, 4,9% cặp khác loại vẫn đạt.

5. Thiếu mẫu là điểm yếu lớn nhất: loại nào chưa có mẫu thì gần như luôn để trống.

*File:* thu\_nghiem\_CO2\_28\_san\_pham.xlsx, test\_products.csv (có link nguồn từng sản phẩm), experiment\_co2\_docker.py trong F:\\Price Optimization\\carbon footprint.

## **9\. Hạn chế, việc cần làm và câu hỏi mở**

### **Hạn chế**

* Danh sách mẫu nhỏ (121) và lệch về 4 loại; các loại khác gần như luôn để trống.

* Tên tiếng Việt cho kết quả kém hơn vì OpenCLIP học chủ yếu bằng tiếng Anh.

* Ngưỡng 0,66 mới thử với bản CLIP thay thế, chưa chạy lại với mô hình thật.

* Số của hãng tính phần sử dụng theo lưới điện nước ngoài, có thể thấp hơn thực tế ở Việt Nam.

* Khoảng \[L, U\] hiện tại chưa khớp số thật ở vài loại: Apple Watch S11 8,1 kg \< 10; tivi 75" 2.388 kg \> 800\.

### **Việc cần làm**

| Việc | Vì sao | Ưu tiên |
| :---- | :---- | :---- |
| Sửa estimate\_product\_co2e: trung bình là kết quả chính, không hỏi Qwen khi không có mẫu giống | Code đang hỏi Qwen trước | Cao |
| Thêm Bước 1: so khớp đúng mẫu | Chưa có trong code | Cao |
| Thêm số của hãng cho loại còn thiếu (mỗi loại ≥ 5 mẫu): Apple, Google, Logitech, Samsung TV | Nhóm B đang để trống hết | Cao |
| Chạy lại thử nghiệm bằng mô hình thật trong Docker, chỉnh lại ngưỡng 0,66 | Ngưỡng chưa tách sạch | Cao |
| Đặt khoảng L–U riêng cho điểm xanh | Chưa khớp số thật | Vừa |
| Xử lý tên tiếng Việt (dịch trước khi so, hoặc mô hình đa ngôn ngữ) | Tên Việt sai nhiều hơn | Vừa |
| Thống nhất hạng CO₂ cho sản phẩm để trống (giữa hay cuối) | Bài báo và bản chốt đang khác nhau | Vừa |
| Thêm cột lưu tên mẫu đã dùng | Để kiểm tra lại được | Vừa |
| Tính riêng giai đoạn sử dụng cho đồ gia dụng (mục 5\) | Lưới điện Việt Nam nhiều điện than | Thấp |
| Đổi category mẫu tai nghe earphone → headphone; sửa docs/co2-setup.md cho khớp code | Lệch tên, lệch tài liệu | Thấp |

### **Câu hỏi xin ý kiến**

1. Phạm vi chỉ đồ điện tử, hay thêm đồ gia dụng (cần tính phần sử dụng)?

2. Không đủ giống thì để trống – có chấp nhận không, hay cần ước lượng theo giá bán (cách của P5)?

3. Có dịch tên tiếng Việt sang tiếng Anh trước khi so?

4. Sai số bao nhiêu là đạt (hiện khoảng 20% với loại đã có mẫu)?

## **Nguồn**

* Bài báo nhóm: *Eco-Conscious AI-Powered Multimodal Product Recommendation System for Vietnamese E-Commerce* (ResearchPaperV1).

* Tài liệu dự án: phuong-phap-tinh-co2-ban-chot.md, dac-ta-ai-trong-tinh-co2.md, doi-chieu-cong-thuc-co2-v2.md.

* [Vestrum et al. 2026 – Carbon-Aware Re-ranking (arXiv 2606.04550)](https://arxiv.org/pdf/2606.04550)

* [Kalisvaart et al. 2025 – Carbon Footprint-Aware RecSys (arXiv 2503.17201)](https://arxiv.org/abs/2503.17201v1)

* [Hệ số lưới điện Việt Nam 2024 – Vietnam News](https://vietnamnews.vn/environment/1716087/study-shows-coal-power-dominant-as-viet-nam-s-grid-emissions-climbed-in-2024)

* [Giả định số năm dùng – Apple](https://www.apple.com/ph/environment/answers/)

* [Dell Latitude E5540 PCF](https://i.dell.com/sites/csdocuments/Corporate_corp-Comm_Documents/en/PCF-WP-E5540.pdf)

* [Nhãn năng lượng tủ lạnh – Điện Máy Xanh](https://www.dienmayxanh.com/kinh-nghiem-hay/lua-chon-tu-lanh-tiet-kiem-dien-qua-thong-tin-tren-1255558)

Cào thêm đồ dụng thiết bị điện dân dụng, ít nhất 1000

Test chạy thử trên hệ thống 

![][image2]

***Cách 1: công thức vòng đời (cho đồ điện gia dụng)*** 

Đồ điện gia dụng gần như không hãng nào công bố số CO₂. Phần lớn CO₂ của chúng sinh ra lúc dùng điện, nên hệ thống tự cộng ba phần:

CO₂ \= phát thải sản xuất \+ số năm dùng × (điện mỗi năm × 0,6592 \+ rò rỉ ga lạnh) \+ phát thải lúc thải bỏ

Trong đó 0,6592 kg CO₂/kWh là hệ số của lưới điện Việt Nam. Số điện mỗi năm lấy theo thứ tự ưu tiên: số kWh/năm trên nhãn năng lượng, nếu không có thì tính từ công suất ghi trên sản phẩm, nếu không có nữa thì dùng mức điển hình của loại đó.

Ví dụ máy lạnh Daikin Inverter 1,5 HP, nhãn ghi 820 kWh/năm (thông số chuẩn của máy lạnh là 1 HP: 300 kg sản xuất, dùng 10 năm):

* Sản xuất: 300 × 1,5 \= 450 kg  
* Dùng điện 10 năm: 10 × 820 × 0,6592 \= 5.405 kg  
* Rò ga 10 năm: 10 × 0,6 kg ga × hệ số 675 × 3%/năm \= 122 kg  
* Thải bỏ: 20 \+ 0,6 × 675 × 30% \= 141,5 kg  
* **Tổng: ≈ 6.118 kg**

***Cách 2: trung vị của loại (cho đồ điện tử)***

Cách này dùng khi loại sản phẩm có ít nhất 4 mẫu có số do hãng công bố. Có ba bước:

1. Lấy trung vị (con số ở giữa) CO₂ của cả loại. Ví dụ 330 màn hình có trung vị 491,5 kg.  
2. Nếu hãng đó có từ 3 mẫu trở lên trong loại, dùng trung vị riêng của hãng. Lý do là mỗi hãng tính theo cách riêng: Apple thường ra số thấp, Dell thường ra số cao.  
3. Với màn hình và laptop, nhân thêm hệ số theo cỡ màn hình:  
   * Màn hình: (inch ÷ 23,8) mũ 0,81  
   * Laptop: (inch ÷ 14\) mũ 0,53  
4. Hai số mũ này rút ra từ 304 màn hình và 467 laptop: màn hình to gấp đôi thì CO₂ tăng khoảng 1,75 lần, không phải gấp đôi.

Ví dụ:

* Màn hình Samsung 27": Samsung chưa đủ 3 mẫu màn hình nên dùng trung vị cả loại. Tính: 491,5 × (27 ÷ 23,8)^0,81 \= 491,5 × 1,108 \= 544 kg.  
* Laptop Acer 15,6": trung vị 25 laptop Acer là 255 kg. Tính: 255 × (15,6 ÷ 14)^0,53 \= 270 kg.  
* Chuột Logitech M240: dùng trung vị 40 sản phẩm Logitech, ra 7,4 kg.  
* Đồng hồ Huawei: Huawei không có mẫu nào nên dùng trung vị 30 đồng hồ, ra 24,5 kg.

Khi thử bằng cách che từng dòng máy rồi đoán lại, sai số trung vị của cách này là khoảng 18%. Màn hình chính xác nhất (9%), còn đồng hồ, chuột, bàn phím, webcam kém nhất (khoảng 40%).

***Cách 3: giá bán × hệ số của US EPA (cách của paper P5)***

Cách này dành cho các loại không có công thức và không có mẫu, như quần áo, sách, mỹ phẩm, đồ chơi. US EPA công bố cho mỗi ngành sản xuất một hệ số “bao nhiêu kg CO₂ trên mỗi đô-la” (tính theo giá năm 2022). Hệ thống đổi giá bán sang đô-la năm 2022 rồi nhân với hệ số đó.

Ví dụ áo thun 199.000 đ:

* 199.000 ÷ 25.900 đ/USD \= 7,68 USD  
* Quy về giá năm 2022: × 292,655/336,940 \= 6,67 USD  
* Nhân hệ số ngành may mặc: × 0,12 \= 0,8 kg

Hệ số tính trên USD năm 2022, nên phải đổi giá về USD 2022 trước khi nhân:

**CO₂ (kg) \= giá (đ) ÷ 25.900 × (292,655 ÷ 336,940) × hệ số**

Cách này chỉ tính phần sản xuất và vận chuyển, không tính điện lúc dùng, và rất thô: hàng đắt vì thương hiệu cũng bị tính nhiều CO₂ hơn. Vì vậy nó là cách cuối cùng.

Crawl min 6k

Có chi phí sản xuất 

# **1\. Đã làm được gì**

Trước đây danh sách có 1.450 sản phẩm điện tử có số CO₂ thật do hãng công bố. Lần này nhóm mở rộng lên đủ 10.000 sản phẩm, lấy thêm 8.550 sản phẩm điện tử từ bộ dữ liệu Amazon (EcoAmazon), rồi dùng chính mô hình tính CO₂ của hệ thống để ra số cho từng món.

Kết quả: **7.406/10.000 sản phẩm (74%) đã có số CO₂**, 2.594 sản phẩm còn để trống vì chưa đủ căn cứ. Toàn bộ nằm trong file danh\_sach\_mau\_10000\_san\_pham\_CO2.xlsx, mỗi dòng đều ghi rõ số lấy từ đâu và cách tính.

Song song, mô hình mới đã được đưa vào code, đẩy lên repo riêng của nhóm (Thanhha217/Smart\_Product), và có thêm một nhánh để hiển thị CO₂ cùng điểm xanh 0–5 lên trang web.

# **2\. Cách tính, nói ngắn gọn**

Mỗi sản phẩm được thử lần lượt các cách dưới đây, cách nào cho ra số trước thì dừng ở đó:

•     **Trùng đúng mẫu:** nếu hãng đã công bố cho đúng model này thì dùng luôn số của hãng.

•     **Tìm sản phẩm giống:** AI (OpenCLIP) so tên sản phẩm với 1.450 mẫu. Mẫu nào giống từ 66% trở lên thì lấy trung bình CO₂ của các mẫu đó.

•     **Dự phòng khi không có mẫu giống:** đồ gia dụng thì tính theo điện năng; loại đã có đủ mẫu thì lấy mức thường gặp của loại đó; còn lại thì ước tính thô theo giá bán.

•     **Không cách nào dùng được** thì để trống,

3\. Kết quả theo từng cách tính

| Cách có số CO₂ | Số sản phẩm | Ý nghĩa |
| :---- | ----: | :---- |
| Danh sách cũ (số của hãng) | 1.450 | Đã có từ trước, lấy từ báo cáo môi trường của hãng |
| Trùng đúng mẫu đã có | 33 | Dùng luôn số hãng công bố |
| Lấy trung bình sản phẩm giống | 398 | Giống ít nhất 66% với các mẫu có số của hãng |
| Công thức vòng đời | 52 | Tivi, quạt, đèn: tính theo điện năng tiêu thụ |
| Mô hình theo loại | 2.271 | Mức thường gặp của loại, chỉnh theo hãng và cỡ màn hình |
| Theo giá bán (EEIO) | 3.202 | Giá Amazon nhân hệ số phát thải của ngành (US EPA) |
| Chưa có số | 2.594 | Không cách nào áp dụng được |
| **Tổng** | **10.000** | **7.406 sản phẩm có số (74%)** |

 

# **4\. Những điểm cần lưu ý**

•     **Số theo giá bán chỉ là ước tính thô.** Cách này chỉ tính phần sản xuất và vận chuyển, không tính điện khi sử dụng, nên số thường thấp hơn các cách khác (trung bình khoảng 2 kg cho một phụ kiện). Không nên so trực tiếp với số của hãng.

•     **Có 460 dòng bị đánh dấu cảnh báo** vì số nằm ngoài khoảng hợp lý của loại. Phần lớn là phụ kiện rẻ tính theo giá (357 dòng), và tivi tính theo công thức vòng đời ra hơn 800 kg. Với tivi, khả năng cao là khoảng hợp lý đang đặt quá thấp, vì tivi 75 inch thật có thể tới 2.388 kg.

•     **Sản phẩm còn trống** chủ yếu là ống kính, phụ kiện máy ảnh, đầu đĩa, đầu thu (2.196 món chưa xếp được loại), cùng các phụ kiện mà Amazon không ghi giá.

•     **Chưa ai kiểm tra lại bằng tay** các số mới. Trong quá trình làm đã phát hiện và sửa một lỗi phân loại (giá treo tivi bị xếp nhầm vào loại tivi).

Chạy hết CO2 đề xuất, \+ module của bài báo so sánh

# **Công thức tính CO₂ cho sản phẩm trên sàn thương mại điện tử Việt Nam**

## **Phần 1\.** 

## **Bài toán**

Khi mua một món đồ điện tử, người dùng gần như không biết món nào gây ít khí thải hơn. Các sàn Việt Nam không ghi con số này. Hãng sản xuất thì chỉ công bố cho một số ít mẫu máy, bằng tiếng Anh, trong các báo cáo dài.

Hệ thống của nhóm tự tính lượng CO₂ cho từng sản phẩm trên sàn, rồi đưa món ít CO₂ hơn lên trước khi hai món đáp ứng nhu cầu ngang nhau.

### **Ý tưởng chính**

Hệ thống luôn ưu tiên số thật của hãng, và chỉ ước lượng khi không có số thật. Mỗi con số đều ghi rõ lấy từ đâu và tin được đến mức nào. AI chỉ dùng để tìm sản phẩm giống nhau, không bao giờ tự đoán ra con số. Nếu không đủ căn cứ thì để trống.

### **Cách tính, từng bước**

Mỗi sản phẩm đi lần lượt qua các bước dưới đây. Bước nào ra số trước thì dừng ở bước đó.

1. Trùng đúng mẫu. Hãng đã công bố cho đúng máy này thì dùng luôn số của hãng.

2. Sản phẩm giống. AI so tên sản phẩm với 1.450 sản phẩm mẫu có số thật. Mẫu nào giống từ 66% trở lên thì lấy trung bình CO₂ của các mẫu đó.

3. Không có mẫu giống, thì tùy loại hàng:

   * Đồ gia dụng: tính theo lượng điện dùng trong nhiều năm, với lưới điện Việt Nam.

   * Đồ điện tử: lấy mức giữa của loại, chỉnh theo hãng và cỡ màn hình.

   * Hàng khác: ước tính thô theo giá bán.

4. Không cách nào dùng được thì để trống.

### **Dùng con số để làm gì**

* Điểm xanh từ 0 đến 5, so trong cùng loại hàng, hiện trên trang web.

* Xếp hạng: nhu cầu của người dùng vẫn là chính. CO₂ chỉ giúp chọn giữa hai món ngang nhau.

* Hệ thống chỉ dùng thứ tự món nào ít CO₂ hơn, không dùng số kg. Nhờ vậy, con số có sai một ít thì kết quả vẫn đúng, miễn là thứ tự đúng.

### **Điểm mới**

* Ghép nhiều cách tính thành một chuỗi có thứ tự ưu tiên rõ ràng, và mỗi con số đều có nhãn nguồn cùng độ tin cậy.

* Có ngưỡng giống 66%: không đủ giống thì không lấy số. Thử nghiệm cho thấy nếu bỏ ngưỡng, 9/12 sản phẩm thuộc loại chưa có mẫu bị lệch quá 2 lần.

* Tính phần điện tiêu thụ theo lưới điện Việt Nam (0,681 kg CO₂ cho mỗi kWh, năm 2024). Lưới điện Việt Nam dùng nhiều điện than hơn lưới điện mà hãng thường dùng khi tính.

* Hai hệ số theo cỡ màn hình rút ra từ dữ liệu thật của 304 màn hình và 467 laptop: màn hình to gấp đôi thì CO₂ tăng khoảng 1,75 lần, không phải gấp đôi.

* Không để AI đoán số. Trong thử nghiệm, mô hình ngôn ngữ đoán sai nhiều hơn cách lấy trung bình mẫu giống (sai trung bình 77,2 kg so với 68,0 kg).

### **Hiệu quả**

* Với loại hàng đã có mẫu, sai số khoảng 20%. Thứ tự xếp hạng gần như đúng hoàn toàn (Spearman 0,95).

* Với cách "mức giữa của loại", sai số khoảng 18%. Màn hình chính xác nhất (9%).

* Trên 10.000 sản phẩm, hệ thống tính được cho 7.406 sản phẩm (74%).

---

## **Phần 2\. Bảng chi tiết**

### **2.1 Các bước tính**

| Bước | Khi nào dùng | Công thức | Dữ liệu cần | Ví dụ | Độ chính xác | Nhãn nguồn · độ tin cậy |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| 1\. Trùng đúng mẫu | Tên sản phẩm chứa nguyên tên một mẫu (ít nhất 3 từ) | CO₂ \= số của hãng | Tên sản phẩm, danh sách mẫu | MacBook Air 13" M3 → 135 kg | Bằng số của hãng | manufacturer · 0,9 |
| 2\. Trung bình mẫu giống | Có ít nhất 1 mẫu giống ≥ 0,66 | CO₂ \= trung bình CO₂ các mẫu còn lại, sau khi lấy 5 mẫu giống nhất, ưu tiên cùng loại, bỏ mẫu nằm ngoài \[trung vị ÷ 8; trung vị × 8\] | Tên và mô tả sản phẩm; AI OpenCLIP đổi chữ thành vector 512 chiều rồi đo độ giống (cosine) | Dell Latitude (5 mẫu 290–391 kg) → 332,6 kg | Sai \~20%, Spearman 0,95 | neighbor\_average · 0,5 |
| 3a. Tính theo điện | Đồ gia dụng: máy lạnh, tủ lạnh, máy giặt, tivi, quạt, nồi cơm, máy lọc, máy hút bụi, lò, bếp, đèn | CO₂ \= sản xuất \+ số năm × (kWh/năm × 0,681 \+ rò rỉ môi chất lạnh) \+ thải bỏ | Nhãn năng lượng → công suất → mức thường gặp của loại | Tivi 75" → \~1.970 kg (Samsung công bố 982–2.388 kg) | Chưa kiểm định được (mới có 5 số thật) | lifecycle\_formula · 0,25–0,35 |
| 3b. Mức giữa của loại | Đồ điện tử thuộc loại có ≥ 4 mẫu | CO₂ \= trung vị của loại (hoặc của hãng nếu hãng có ≥ 3 mẫu) × (inch ÷ inch chuẩn)^b. Màn hình: b \= 0,81, inch chuẩn 23,8; laptop: b \= 0,53, inch chuẩn 14 | Loại, hãng, cỡ màn hình | Màn hình Samsung 27" → 491,5 × 1,108 \= 544 kg; laptop Acer 15,6" → 270 kg | Sai \~18% (màn hình 9%, đồng hồ và ngoại vi \~40%) | category\_model · 0,35 |
| 3c. Theo giá bán (US EPA) | Loại không có công thức và không có mẫu (quần áo, sách, mỹ phẩm…) | CO₂ \= giá ÷ 25.900 × (292,655 ÷ 336,940) × hệ số ngành | Giá bán, loại → mã ngành (58 loại → 30 mã ngành) | Áo thun 199.000 đ → 0,8 kg | Rất thô, chỉ gồm sản xuất và vận chuyển | eeio\_price · 0,15 |
| 4\. Để trống | Không bước nào áp dụng được | — | — | Phần mềm, ống kính máy ảnh | — | NULL |

### **2.2 Dùng kết quả**

| Thành phần | Công thức | Ý nghĩa |
| :---- | :---- | :---- |
| Điểm xanh | 5 × ln(U ÷ CO₂) ÷ ln(U ÷ L), giới hạn trong 0–5 | L, U là mức thấp nhất và cao nhất hợp lý của loại. Điểm càng cao càng xanh (theo bài Kalisvaart 2025\) |
| Xếp hạng | 1 ÷ (60 \+ hạng nhu cầu) \+ 0,2 × 1 ÷ (60 \+ hạng CO₂) | Nhu cầu là chính, CO₂ phá thế hòa (theo bài Vestrum 2026). Sản phẩm không có số nhận hạng CO₂ ở giữa |
| Lưu kèm | Nguồn, độ tin cậy, câu giải thích tiếng Việt và tiếng Anh, tên các mẫu đã dùng | Người đọc kiểm tra lại được từng con số |

### **2.3 Dữ liệu**

| Dữ liệu | Số lượng | Nguồn |
| :---- | :---- | :---- |
| Sản phẩm mẫu có số thật của hãng | 1.450 (laptop 587, màn hình 330, máy để bàn 238, điện thoại 100, máy tính bảng 60, chuột/bàn phím/webcam 45, đồng hồ 30, nhà thông minh 28…) | Báo cáo môi trường của hãng, Boavizta, EcoAmazon |
| Hệ số lưới điện Việt Nam | 0,681 kg CO₂/kWh (2024) | ĐH Bách khoa Hà Nội và Bộ Nông nghiệp và Môi trường |
| Hệ số theo ngành | 30 mã ngành | US EPA Supply Chain GHG Emission Factors v1.3 |
| Tỷ giá, CPI | 25.900 đ/USD; CPI 2022 \= 292,655, 9/2026 \= 336,940 | Vietcombank, Cục Thống kê Lao động Mỹ (BLS) |

### **2.4 Thử nghiệm**

| Thử nghiệm | Cách làm | Kết quả chính |
| :---- | :---- | :---- |
| 28 sản phẩm có số thật | 16 sản phẩm thuộc loại đã có mẫu, 12 thuộc loại chưa có mẫu; danh sách 121 mẫu; dùng bản CLIP thay thế | Loại đã có mẫu: sai 20–22%, không sản phẩm nào lệch quá 2 lần, Spearman 0,95. Bỏ ngưỡng 0,66: 9/12 sản phẩm loại mới lệch quá 2 lần |
| Che từng dòng máy (1.450 mẫu) | Đoán mỗi sản phẩm từ các mẫu còn lại, sau khi bỏ cả dòng máy của nó | Mức giữa của loại có chỉnh hãng và cỡ màn hình: sai 18,5%, tốt hơn chỉ lấy trung vị (24,1%). Màn hình 9,4%, điện thoại 13,7%, laptop 20,1%, máy để bàn 22,2% |
| So với AI đoán số (Qwen) | Cùng bộ thử | AI sai trung bình 77,2 kg, trung bình mẫu giống sai 68,0 kg. AI đoán chuột máy tính \~76 kg, số thật dưới 5 kg |
| 10.000 sản phẩm | 1.450 mẫu cộng 8.550 sản phẩm Amazon | 7.406 có số (74%): trùng mẫu 33, mẫu giống 398, theo điện 52, mức giữa của loại 2.271, theo giá 3.202. Để trống 2.594 |
| Chạy thử toàn hệ thống | Sản phẩm thật từ sàn Việt Nam | Ví dụ: Dell Latitude 5420 → 300 kg; màn hình Samsung Odyssey G5 27" → 544 kg; máy lạnh Daikin 1,5 HP có nhãn 820 kWh/năm → \~6.300 kg; áo thun → 0,8 kg |

### **2.5 Hạn chế**

| Hạn chế | Ảnh hưởng |
| :---- | :---- |
| Thử nghiệm 28 sản phẩm chạy với 121 mẫu và bản CLIP thay thế | Cần chạy lại với 1.450 mẫu và mô hình thật |
| Tên tiếng Việt cho kết quả kém hơn tên tiếng Anh | Ít sản phẩm tìm được mẫu giống hơn |
| Các cách tính không cùng phạm vi: số của hãng dùng lưới điện nước ngoài, cách theo giá không tính điện lúc dùng | Chỉ nên so trong cùng loại. Web hiện nguồn số bên cạnh con số |
| Công thức đồ gia dụng chưa có đủ số thật để kiểm định | Các tham số vẫn là giả định |
| Cách theo giá dùng hệ số của Mỹ | Rất thô, là cách cuối cùng |

---

## **Phần 3\. Hướng làm tiếp**

* Chạy lại thử nghiệm 28 sản phẩm với 1.450 mẫu và mô hình CLIP thật, rồi chỉnh lại ngưỡng 0,66.

* Thêm số thật của hãng cho đồ gia dụng (tủ lạnh, máy lạnh, máy giặt), mỗi loại ít nhất 5 mẫu, để kiểm định công thức theo điện.

* Cào thêm thông số "kWh/năm" trên nhãn năng lượng từ Điện Máy Xanh và Thế Giới Di Động.

* Dịch tên tiếng Việt sang tiếng Anh trước khi so, hoặc dùng mô hình đa ngôn ngữ.

* Cho bước "trùng đúng mẫu" bỏ qua khác biệt dung lượng (128GB / 256GB).

* Tính lại phần sử dụng theo lưới điện Việt Nam cho đồ điện tử có số của hãng, khi báo cáo của hãng có tách riêng giai đoạn sử dụng.

* Thay hệ số US EPA bằng bảng Input–Output của Việt Nam.

* Kiểm tra tay một phần trong 8.550 số mới của danh sách 10.000 sản phẩm.

* Demo trên web: AI tự sinh trang kết quả gồm công thức, các giai đoạn từ sản xuất đến tay người dùng, biểu đồ, sản phẩm liên quan và lời giải thích.

* Đưa hệ thống vào ChatGPT dưới dạng MCP server (nếu có tài khoản và địa chỉ công khai).

* Demo AI tự so sánh rồi đặt mua ở chế độ thử, không trả tiền thật.

Tập dataset: [https\://docs.google.com/spreadsheets/d/14IXKQ-osZTGjZ83KqHmvCFMWF7u8Ki4sJs7BpWYpeOY/edit?usp=sharing](https://docs.google.com/spreadsheets/d/14IXKQ-osZTGjZ83KqHmvCFMWF7u8Ki4sJs7BpWYpeOY/edit?usp=sharing) 

## Demo trên web: AI tự sinh trang kết quả

### Luồng sử dụng

1\. Người dùng gõ hoặc nói câu hỏi. Ví dụ: "Tìm laptop dưới 20 triệu để học, ít phát thải".

2\. AI hiểu câu hỏi rồi lập kế hoạch tìm kiếm: loại hàng, khoảng giá, nhu cầu.

3\. Hệ thống tìm sản phẩm, xếp hạng theo nhu cầu và CO₂, rồi lấy số CO₂ và các giai đoạn đã tính sẵn trong cơ sở dữ liệu.

4\. AI chọn các phần cần hiển thị, chọn loại biểu đồ và viết lời giải thích. Hệ thống ghép dữ liệu thật vào thành **một trang hoàn chỉnh**.

5\. Người dùng xem, so sánh, hỏi tiếp, hoặc thêm vào giỏ hàng thử.

Nền đã có sẵn: trang /assistant và dịch vụ assistant (AI lập kế hoạch → tìm kiếm → tính CO₂ → vẽ biểu đồ). Việc còn lại là nâng cấp thành một trang kết quả đầy đủ.

### Danh sách trang

| Trang | Đường dẫn | Mới hay sửa | Dùng để |
| :---- | :---- | :---- | :---- |
| Trang chủ | / | Sửa | Thêm ô "Hỏi AI" và các câu hỏi gợi ý |
| Hỏi AI | /assistant | Sửa | Nhập câu hỏi bằng chữ hoặc giọng nói, xem lịch sử hỏi |
| **Trang kết quả do AI sinh** | /assistant/:id | **Mới** | Trang hoàn chỉnh cho một câu hỏi. Có đường dẫn riêng để chia sẻ và mở lại |
| Kết quả tìm kiếm | /search | Sửa | Thêm bộ lọc "điểm xanh ≥ …" và nhãn nguồn số trên mỗi thẻ sản phẩm |
| Chi tiết sản phẩm | /product/:productId | Sửa | Thêm phần các giai đoạn vòng đời, sản phẩm thay thế xanh hơn, nút "Hỏi AI về sản phẩm này" |
| **So sánh** | /compare?ids=… | **Mới** | So 2–4 sản phẩm cạnh nhau |
| **Phương pháp tính CO₂** | /method | **Mới** | Giải thích công thức cho người xem và hội đồng |
| **Giỏ hàng (thử)** | /cart | **Mới** | Xem mục 3.4 |
| **Thanh toán (thử)** | /checkout | **Mới** | Xem mục 3.4 |
| **Đơn hàng (thử)** | /orders/:id | **Mới** | Xem mục 3.4 |

 

### Các phần của trang kết quả do AI sinh (/assistant/:id)

| \# | Phần | Nội dung | Dữ liệu lấy từ đâu |
| :---- | :---- | :---- | :---- |
| 1 | Câu trả lời ngắn | 2–3 câu trả lời thẳng câu hỏi, nêu món đề xuất và lý do chính | AI viết, dựa trên số ở các phần bên dưới |
| 2 | Sản phẩm đề xuất | 3 thẻ: ảnh, tên, giá, nơi bán, số kg CO₂, điểm xanh 0–5, nhãn nguồn (số của hãng / trung bình mẫu giống / công thức / theo giá), độ tin cậy | Cơ sở dữ liệu sản phẩm |
| 3 | Công thức áp dụng | Công thức của đúng cách tính đã dùng, **thế số thật vào từng bước**. Ví dụ: 491,5 × (27 ÷ 23,8)^0,81 \= 544 kg. Có nút "Xem cách tính" mở chi tiết | Cột nguồn và chi tiết tính đã lưu |
| 4 | Vòng đời: từ nơi sản xuất đến tay người dùng | Sơ đồ 5 bước: nguyên liệu → sản xuất (nước sản xuất) → vận chuyển về Việt Nam → sử dụng tại Việt Nam (số năm, kWh/năm, lưới điện 0,681) → thải bỏ. Mỗi bước ghi số kg và phần trăm; thêm thanh chồng thể hiện tỷ lệ | Có số theo giai đoạn thì vẽ (công thức theo điện; số của hãng sau khi làm A6). Không có thì chỉ hiện tổng và ghi "hãng không tách theo giai đoạn" |
| 5 | Biểu đồ so sánh | (a) Cột ngang: kg CO₂ của các ứng viên, tô màu theo điểm xanh. (b) Điểm: giá – CO₂, để thấy món vừa rẻ vừa xanh | Dữ liệu ứng viên |
| 6 | Thống kê trong loại | Món này xanh hơn bao nhiêu % sản phẩm cùng loại; trung vị của loại; số sản phẩm trong loại | Thống kê từ danh sách mẫu và cơ sở dữ liệu |
| 7 | Tiết kiệm được | Chọn món xanh nhất thay vì món trung bình: giảm bao nhiêu kg CO₂, bao nhiêu kWh, bao nhiêu tiền điện sau 6 và 12 tháng; quy đổi ra số cây xanh hấp thụ trong một năm | Công thức tiết kiệm đã có (estimate\_savings) |
| 8 | Vì sao nên chọn món ít CO₂ | 3–5 gạch đầu dòng, mỗi ý dẫn đúng con số ở trên (không dùng câu chung chung) | AI viết, chỉ dùng số đã có |
| 9 | Sản phẩm liên quan | 4–6 món cùng loại, xếp theo điểm xanh; món thay thế xanh hơn ở mức giá gần nhau | Tìm kiếm và xếp hạng |
| 10 | Nguồn và giới hạn | Tên các mẫu đã dùng (có link báo cáo của hãng), nhãn nguồn, độ tin cậy, ghi chú giới hạn (ví dụ "ước tính theo giá chỉ gồm sản xuất và vận chuyển") | Cột co2e\_references và nguồn |
| 11 | Thanh hành động | Hỏi tiếp, So sánh, Xem chi tiết, Thêm vào giỏ (thử), Chia sẻ trang | — |

 

### Trang So sánh (/compare)

·       Bảng cạnh nhau, mỗi cột một sản phẩm. Các dòng: giá, CO₂, điểm xanh, nguồn số, độ tin cậy, cách tính, kWh/năm (nếu có), tiền điện mỗi năm, các giai đoạn vòng đời.  
·       Ô tốt nhất ở mỗi dòng được tô đậm. Một dòng kết luận do AI viết, dựa trên bảng.  
·       Thêm hoặc bớt sản phẩm ngay trên trang (tối đa 4).

### Trang Phương pháp (/method)

·       Sơ đồ chuỗi tính: trùng đúng mẫu → mẫu giống → công thức theo điện / mức giữa của loại / theo giá → để trống.  
·       Mỗi cách có công thức, một ví dụ tính tay, độ chính xác, nhãn nguồn.  
·       Bảng kết quả thử nghiệm và phần hạn chế (lấy từ Phần 2 của bản nộp).

### Yêu cầu chức năng

·       **YC-1.** Một câu hỏi tạo ra một trang có đường dẫn riêng (/assistant/:id), mở lại được và chia sẻ được.  
·       **YC-2.** Dịch vụ AI trả về **bản mô tả trang** dạng JSON (danh sách các phần, loại biểu đồ, lời giải thích). Giao diện dựng trang từ bản mô tả đó. AI không viết HTML trực tiếp.  
·       **YC-3.** Mọi con số trên trang được hệ thống ghép từ dữ liệu thật. Lời AI viết chỉ được nhắc tới số có trong dữ liệu; số nào không khớp thì hệ thống loại câu đó.  
·       **YC-4.** Mã biểu đồ do AI viết phải qua bước làm sạch (đã có chart\_sanitizer), chỉ cho phép một số loại biểu đồ nhất định.  
·       **YC-5.** Số CO₂ trên trang này phải giống hệt số trên trang chi tiết sản phẩm, tức là cùng lấy từ cột co2e\_kg, không tính lại bằng cách khác.  
·       **YC-6.** Hỏi tiếp trên cùng trang (ví dụ "còn loại rẻ hơn không?") thì trang cập nhật lại theo câu hỏi mới.  
·       **YC-7.** Có tiếng Việt và tiếng Anh; nhập được bằng giọng nói (đã có).  
·       **YC-8.** Sản phẩm chưa có số: hiện "chưa có số CO₂", không có điểm xanh, đứng giữa khi xếp theo CO₂.

### Yêu cầu phi chức năng

·       Phần 1 và 2 hiện trong ≤ 5 giây; cả trang xong trong ≤ 20 giây. Trong lúc chờ, hiện khung trống và tải dần từng phần.  
·       Dùng tốt trên điện thoại (màn hình rộng 375 px).  
·       Lỗi AI hoặc quá thời gian: vẫn hiện danh sách sản phẩm và số CO₂, kèm thông báo "chưa tạo được phần giải thích".  
·       Ghi log câu hỏi, thời gian chạy và số lần AI viết sai số, để đưa vào phần đánh giá.

### Dịch vụ phía sau cần thêm

| Đầu API | Làm gì |
| :---- | :---- |
| POST /assistant (sửa) | Nhận câu hỏi, trả về id trang và bản mô tả trang |
| GET /assistant/:id (mới) | Mở lại trang đã tạo |
| GET /products/:id/co2 (mới) | Số CO₂, nguồn, độ tin cậy, chi tiết cách tính, các giai đoạn, các mẫu đã dùng |
| GET /products/:id/related (mới) | Sản phẩm liên quan và món thay thế xanh hơn |
| GET /compare?ids= (mới) | Dữ liệu cho trang so sánh |
| GET /categories/:cat/stats (mới) | Trung vị, phân vị và số sản phẩm của loại |

 

## Đưa vào ChatGPT bằng MCP (nếu được)

**Mục tiêu:** người dùng hỏi ngay trong ChatGPT, ChatGPT gọi hệ thống của nhóm để lấy sản phẩm và số CO₂, rồi trả lời kèm link về trang kết quả.

**Công cụ (tool) mà MCP server cung cấp**

| Công cụ | Đầu vào | Trả về |
| :---- | :---- | :---- |
| search\_products | câu hỏi, loại hàng, giá tối đa, số kết quả | Danh sách sản phẩm đã xếp hạng: tên, giá, kg CO₂, điểm xanh, nguồn, link |
| get\_product\_co2 | mã sản phẩm | Số CO₂, cách tính, công thức đã thế số, các giai đoạn, các mẫu đã dùng |
| compare\_products | 2–4 mã sản phẩm | Bảng so sánh và link trang /compare |
| explain\_co2\_method | (không có) | Tóm tắt phương pháp và link trang /method |
| create\_test\_order | mã sản phẩm, số lượng | Đơn hàng **thử** (xem mục 3.4) và link xác nhận |

 

**Yêu cầu**

·       Thêm dịch vụ mới backend/services/mcp-server/, chạy cùng docker-compose. Dịch vụ này chỉ gọi lại db-search và assistant, không tính CO₂ riêng.  
·       Cần địa chỉ HTTPS công khai (máy chủ của trường, hoặc ngrok khi quay demo) và một tài khoản ChatGPT cho phép thêm MCP server (chế độ dành cho nhà phát triển).  
·       Các công cụ đọc dữ liệu không cần đăng nhập. create\_test\_order chỉ tạo đơn thử và cần người dùng bấm xác nhận trên web.  
·       Giới hạn số lần gọi mỗi phút; ghi log mọi lần gọi.  
·       Câu trả lời trong ChatGPT phải ghi rõ nguồn số và có link về trang của nhóm.

**Tiêu chí đạt:** trong ChatGPT hỏi "laptop nào ít CO₂ dưới 20 triệu", ChatGPT gọi search\_products và trả lời đúng số trên web của nhóm.

**Rủi ro:** chưa chắc tài khoản của nhóm dùng được tính năng này. Nếu không được, quay demo bằng một ứng dụng hỗ trợ MCP khác, hoặc chỉ demo trên web.

## 3.4 Nhóm B – AI tự so sánh rồi đặt mua ở chế độ thử (nếu được)

**Về "ChatGPT Wallet":** nhóm chưa xác nhận được đây có phải một sản phẩm thanh toán đang mở cho bên ngoài hay không. Thanh toán thật trong ChatGPT thường đòi hỏi người bán được OpenAI duyệt, nằm ngoài phạm vi đề tài. Vì vậy demo dùng **thanh toán giả lập**: không trừ tiền thật, không nhập thẻ thật.

**Luồng**

1\. Người dùng: "Chọn giúp tôi máy lạnh 1 HP tiết kiệm điện nhất dưới 10 triệu rồi đặt mua."

2\. AI so sánh các ứng viên, hiện bảng so sánh và đề xuất một món, kèm lý do theo CO₂, tiền điện và giá.

3\. AI tạo giỏ hàng thử.

4\. **Người dùng phải bấm "Xác nhận đặt hàng (thử)"**. AI không được tự hoàn tất đơn.

5\. Hệ thống tạo đơn thử và hiện trang đơn hàng.

**Trang**

| Trang | Các phần |
| :---- | :---- |
| Giỏ hàng /cart | Danh sách món, số lượng, giá; tổng CO₂ của giỏ; gợi ý "đổi sang món xanh hơn, tiết kiệm X kg CO₂"; nút Thanh toán |
| Thanh toán /checkout | Dải cảnh báo luôn hiện: "CHẾ ĐỘ THỬ – không trừ tiền thật"; thông tin giao hàng mẫu; chọn phương thức "Thanh toán giả lập"; tóm tắt đơn và CO₂; nút "Xác nhận đặt hàng (thử)" |
| Đơn hàng /orders/:id | Mã đơn thử, trạng thái, danh sách món; "Bạn đã chọn phương án giảm X kg CO₂ so với lựa chọn trung bình"; nút quay lại |

 

**Yêu cầu**

·       Không lưu và không nhập số thẻ, tài khoản ngân hàng hay ví thật. Không gọi cổng thanh toán thật. Nếu muốn giống thật hơn thì chỉ dùng chế độ test của cổng thanh toán (ví dụ thẻ test của Stripe).  
·       Mọi đơn đều gắn nhãn "thử" trong cơ sở dữ liệu và trên giao diện.  
·       AI chỉ được tạo giỏ hàng; bước xác nhận luôn do người dùng bấm.  
·       Ghi log toàn bộ các bước: AI đề xuất gì, người dùng xác nhận lúc nào.

## 3.5 Thứ tự làm và tiêu chí cho video demo

| Bước | Việc | Lý do |
| :---- | :---- | :---- |
| 1 | A1, A5 | Nhanh, cải thiện độ chính xác ngay, có số mới cho bản nộp |
| 2 | Trang kết quả do AI sinh, trang Phương pháp, trang So sánh | Phần chính của video demo |
| 3 | A2, A3 | Kiểm định công thức đồ gia dụng |
| 4 | Giỏ hàng, thanh toán và đơn hàng thử | Hoàn tất luồng "AI so sánh → đặt mua" |
| 5 | MCP cho ChatGPT | Phụ thuộc tài khoản và địa chỉ công khai |
| 6 | A4, A6, A7, A8 | Cải thiện thêm cho bài báo |

 

Đặc tả kỹ thuật: cải thiện công thức CO₂ và demo

*Đi kèm bản nộp "Công thức tính CO₂" (Phần 3). Dự án: CarbonSense AI, repo \`Thanhha217/Smart\_Product\`, nhánh gốc \`main\`. Cập nhật 23/11/2026.*

Ký hiệu trạng thái:

·       **\[Có\]**: đã có trong code.  
·       **\[Sửa\]**: có rồi, cần sửa.  
·       **\[Mới\]**: cần làm mới.  
·       **(đề xuất)**: tên hoặc giá trị nhóm tự chọn, có thể đổi.

# 1\. Phạm vi

| Mã | Việc | Ghi chú |
| :---- | :---- | :---- |
| A1–A8 | Cải thiện công thức CO₂ | Bắt buộc A1, A2, A3, A5 |
| B1 | Web: AI tự sinh trang kết quả, các trang So sánh, Phương pháp | Bắt buộc cho video demo |
| B2 | MCP server cho ChatGPT | Làm nếu có tài khoản và địa chỉ công khai |
| B3 | AI so sánh rồi đặt mua ở chế độ thử | Không thanh toán thật |

 

Ngoài phạm vi:

·       Thanh toán thật, ví thật, thẻ thật.  
·       Đăng nhập và tài khoản người dùng.  
·       Ứng dụng di động riêng.

# 2\. Môi trường

## 2.1 Phần cứng

| Môi trường | CPU | RAM | Ổ đĩa trống | GPU |
| :---- | :---- | :---- | :---- | :---- |
| Máy dev (chạy đủ docker-compose) | 4 nhân trở lên | 16 GB trở lên (đề xuất) | 40 GB trở lên (image torch, mô hình CLIP, Ollama, Postgres) | Không bắt buộc |
| Máy chỉ chạy test CO₂ | Bất kỳ | 4 GB | 1 GB | Không |
| Máy demo / prod | 4 nhân trở lên | 16 GB trở lên | 60 GB trở lên | Không bắt buộc |

 

## 2.2 Phần mềm

| Thành phần | Phiên bản | Ghi chú |
| :---- | :---- | :---- |
| Hệ điều hành | Windows 10/11, macOS hoặc Linux | Windows cần Docker Desktop dùng WSL2 |
| Docker / Docker Compose | 29.x / v2.40 trở lên | Lệnh docker compose (v2) |
| Git | 2.40 trở lên | Cần git merge-tree \--write-tree để thử gộp |
| Python | 3.12 | Chạy test ngoài Docker; mỗi dịch vụ có requirements.txt riêng |
| Node.js / npm | 20 trở lên | Frontend: React 19, Vite 6, Tailwind 4, react-router 7 **\[Có\]** |
| PostgreSQL | Theo image trong docker-compose.dev.yml | Truy cập qua SQLModel **\[Có\]** |
| Kafka, Redis, Airflow 3.2.1 | Theo compose | Cào dữ liệu và chuyển dữ liệu sang etl-worker **\[Có\]** |
| Mô hình so độ giống | OpenCLIP ViT-B-32, trọng số laion2b\_s34b\_b79k, open\_clip\_torch 3.3.0, FAISS | **\[Có\]** |
| Mô hình ngôn ngữ cho trang AI | Claude qua anthropic SDK | **\[Có\]** trong dịch vụ assistant; cần ANTHROPIC\_API\_KEY |
| Ollama \+ qwen3.5:0.8b | — | Không bắt buộc; chỉ dùng khi CO2E\_USE\_LLM=1 |
| pytest | 8 trở lên | Test |
| Playwright (đề xuất) | Bản ổn định mới nhất | Test giao diện đầu–cuối |
| ngrok hoặc Cloudflare Tunnel (đề xuất) | — | Địa chỉ HTTPS công khai cho MCP |

 

## 2.3 Các môi trường chạy

| Môi trường | File compose | File biến môi trường | Dữ liệu |
| :---- | :---- | :---- | :---- |
| dev | docker-compose.dev.yml | .env (chép từ .env.example) và backend/.env.dev | Dữ liệu cào thật, cơ sở dữ liệu cục bộ |
| demo (đề xuất) | docker-compose.dev.yml \+ docker-compose.demo.yml (mới) | backend/.env.demo (mới, không commit) | Bản sao cơ sở dữ liệu đã chốt cho video |
| prod | docker-compose.prod.\*.yml | backend/.env.prod (không commit) | Máy chủ thật |

 

## 2.4 Dịch vụ và cổng

| Dịch vụ | Cổng | Trạng thái | Việc |
| :---- | :---- | :---- | :---- |
| frontend | 3000 | \[Sửa\] | Thêm các trang mới |
| backend-gateway | 8000 | \[Sửa\] | Thêm đường dẫn tới các API mới |
| backend-etl-worker | — | \[Sửa\] | Tính CO₂ khi nhập sản phẩm; lưu thêm chi tiết từng giai đoạn |
| db-search | nội bộ | \[Sửa\] | API dữ liệu CO₂, sản phẩm liên quan, so sánh, thống kê loại |
| ranking-system | nội bộ | \[Có\] | Xếp hạng nhu cầu và CO₂ (rrf.py) |
| assistant | nội bộ | \[Sửa\] | Tạo bản mô tả trang kết quả |
| mcp-server | 8100 (đề xuất) | \[Mới\] | Cổng MCP cho ChatGPT |
| airflow-\* | 8080 | \[Sửa\] | Bộ cào lấy thêm thông số kWh/năm |
| kafka-ui | 8081 | \[Có\] | — |

 

## 2.5 Biến môi trường

| Biến | Dịch vụ | Mặc định | Trạng thái | Ý nghĩa |
| :---- | :---- | :---- | :---- | :---- |
| POSTGRES\_URL | etl-worker, db-search | — | \[Có\] | Chuỗi kết nối cơ sở dữ liệu |
| CO2E\_FALLBACK | etl-worker | 1 | \[Có\] | Bật các cách dự phòng |
| CO2E\_USE\_LLM | etl-worker | 0 | \[Có\] | Cho Qwen chỉnh số trung bình (chỉ để thí nghiệm) |
| CO2\_GRID\_EF | etl-worker, assistant | 0.681 | \[Có\] | Hệ số lưới điện Việt Nam |
| CO2\_VND\_PER\_USD, CO2\_CPI\_NOW | etl-worker | 25900, 336.94 | \[Có\] | Dùng cho cách tính theo giá |
| CO2E\_SIM\_THRESHOLD | etl-worker | 0.66 | \[Mới\] | Ngưỡng giống; hiện đang ghi cứng trong code, chuyển thành biến sau A1 |
| DB\_SEARCH\_URL | assistant, mcp-server | — | \[Có\] | Địa chỉ db-search |
| ANTHROPIC\_API\_KEY | assistant | — | \[Có\] | Bí mật, không commit |
| ASSISTANT\_MAX\_PRODUCTS | assistant | 6 | \[Có\] | Số ứng viên đưa vào trang |
| ASSISTANT\_TIMEOUT\_S | assistant | 20 | \[Mới\] | Thời gian tối đa tạo trang |
| ASSISTANT\_URL | mcp-server, gateway | — | \[Mới\] | Địa chỉ dịch vụ assistant |
| PUBLIC\_WEB\_URL | mcp-server, assistant | http\://localhost:3000 | \[Mới\] | Dùng để tạo link trả về cho người dùng |
| MCP\_RATE\_LIMIT\_PER\_MIN | mcp-server | 30 | \[Mới\] | Giới hạn số lần gọi mỗi phút |
| CHECKOUT\_MODE | assistant / gateway | test | \[Mới\] | Chỉ chấp nhận giá trị test; bất kỳ giá trị nào khác thì dịch vụ báo lỗi và dừng |

 

**Quy tắc bí mật:**

·       Không commit .env, backend/.env.prod, backend/.env.demo hay khóa API.  
·       Mọi biến mới phải thêm vào .env.example hoặc backend/.env.dev (với giá trị giả) và vào docs/co2-setup.md.

# 3\. Mã nguồn, nhánh và quy ước

## 3.1 Nhánh

·       Mỗi việc một nhánh tạo từ main: feature/a1-threshold, feature/b1-ai-page, feature/b2-mcp, feature/b3-test-checkout…  
·       Gộp vào main qua PR. Trước khi mở PR: chạy hết test và thử gộp bằng git merge-tree \--write-tree origin/main HEAD để chắc không có xung đột.

## 3.2 Thư mục

| Thư mục / file | Nội dung |
| :---- | :---- |
| backend/services/etl-worker/green/ | Logic tính CO₂ thuần (không gọi DB hay mạng), có test |
| backend/services/etl-worker/data/process/carbon\_estimator.py | Thứ tự các bước tính |
| backend/services/etl-worker/data/seed/ | Danh sách mẫu |
| backend/services/etl-worker/tests/ | Test phần CO₂ |
| backend/services/ranking\_system/rrf.py | Xếp hạng nhu cầu và CO₂ |
| backend/services/db-search/ | Các API dữ liệu |
| backend/services/assistant/ | Tạo trang kết quả |
| backend/services/mcp-server/ | \[Mới\] MCP server: main.py, tools.py, Dockerfile, requirements.txt, tests/ |
| frontend/src/pages/ | Các trang |
| frontend/src/pages/components/ | Thành phần giao diện dùng lại |
| frontend/src/i18n/vi.json, en.json | Chữ hiển thị (không viết chữ cứng trong code) |
| scripts/research/ | \[Mới\] Script thử nghiệm (A1, A2, A8) và dựng danh sách mẫu. Chép từ carbon footprint/mo\_rong\_seed/ vào đây |
| docs/research/ | Tài liệu phương pháp và kết quả thử nghiệm |

 

## 3.3 Quy ước code

**Python**

·       Có type hint cho mọi hàm.  
·       Logic tính toán để trong module thuần, không đọc biến môi trường hay DB bên trong hàm tính.  
·       Định dạng code bằng ruff format, kiểm lỗi bằng ruff check (đề xuất).

**React**

·       Mỗi phần của trang là một component.  
·       Dữ liệu lấy qua một file gọi API chung (frontend/src/api/ – đề xuất).  
·       Không gọi AI trực tiếp từ trình duyệt.

**Số và đơn vị**

·       Trong code: kg CO₂e, số thực.  
·       Trên giao diện: làm tròn 1 chữ số thập phân nếu ≥ 1 kg, 2 chữ số nếu \< 1 kg; định dạng kiểu Việt Nam (1.234,5).

**Commit**

·       Tiêu đề tiếng Anh, bắt đầu bằng phạm vi (CO2:, Web:, MCP:, Checkout:); thân giải thích lý do.

**PR**

·       Mô tả việc làm, cách test, ảnh chụp màn hình (nếu có giao diện), và các biến môi trường mới.

# 4\. Dữ liệu

## 4.1 Bảng product – cột mới

| Cột | Kiểu | Trạng thái | Ý nghĩa |
| :---- | :---- | :---- | :---- |
| co2e\_kg, co2e\_source, co2e\_confidence, co2e\_explanation, co2e\_explanation\_vi, co2e\_category, co2e\_references | — | \[Có\] | — |
| co2e\_breakdown | JSON (chuỗi) | \[Mới\] | {"materials\_production": kg, "transport": kg, "use": kg, "end\_of\_life": kg, "basis": "formula" hoặc "manufacturer\_share"}; để trống nếu không tách được |
| co2e\_detail | JSON (chuỗi) | \[Mới\] | Chi tiết cách tính để hiển thị công thức có thế số, ví dụ {"category\_median": 491.5, "brand": null, "inch": 27, "slope": 0.81, "ref\_inch": 23.8} |
| energy\_kwh\_year | số thực | \[Mới\] | Điện năng trên nhãn (A3) |
| rated\_power\_w | số thực | \[Mới\] | Công suất |
| capacity | chuỗi | \[Mới\] | Ví dụ "322 L", "9 kg", "1 HP" |
| energy\_stars | số nguyên | \[Mới\] | Số sao trên nhãn năng lượng |

 

**Thêm cột vào cơ sở dữ liệu đang chạy:**

·       Dùng ALTER TABLE … ADD COLUMN IF NOT EXISTS trong data/\_\_init\_\_.py, như các cột CO₂ trước.  
·       Không yêu cầu xóa volume.

## 4.2 Danh sách mẫu – trường mới

| Trường | Bắt buộc | Ý nghĩa |
| :---- | :---- | :---- |
| name, brand, category, co2e\_kg, scope, source | Có | \[Có\] |
| source\_url | Có, với mẫu mới | Link báo cáo gốc |
| stage\_share | Không | {"production": 0.78, "transport": 0.04, "use": 0.16, "end\_of\_life": 0.02}, lấy từ báo cáo của hãng (A6) |
| lifetime\_years | Không | Số năm dùng mà hãng giả định |

 

**Lưu ý:** bộ nạp hiện chỉ nạp lại khi **số dòng** thay đổi. Cần đổi sang so mã băm (hash) của file, để sửa một giá trị cũng được nạp lại **\[Sửa\]**.

## 4.3 Bảng mới

| Bảng | Cột chính | Dùng cho |
| :---- | :---- | :---- |
| assistant\_page | id (UUID), created\_at, query, lang, page\_spec (JSON), product\_ids (JSON), model, latency\_ms, number\_check\_failures | B1: lưu trang để mở lại và để đánh giá |
| test\_order | id (UUID), created\_at, status, mode (luôn test), total\_vnd, total\_co2e\_kg, saved\_co2e\_kg, created\_by (user / assistant / mcp), confirmed\_at | B3 |
| test\_order\_item | order\_id, product\_id, quantity, unit\_price\_vnd, co2e\_kg | B3 |

 

# 5\. API

Mọi API trả JSON tiếng Anh (tên trường). Lỗi trả về dạng {"error": {"code": "...", "message": "..."}} với mã HTTP phù hợp. Đi qua gateway với tiền tố /api (đề xuất).

## 5.1 POST /api/assistant \[Sửa\]

Gửi lên:

{"message": "Laptop dưới 20 triệu để học, ít phát thải", "lang": "vi", "parent\_id": null}

Trả về:

{"id": "8f1c…", "url": "/assistant/8f1c…", "page": { "…": "bản mô tả trang, xem mục 6" }}

·       parent\_id là trang trước đó, dùng khi người dùng hỏi tiếp.  
·       Hết thời gian chờ thì vẫn trả trang, nhưng chỉ có phần sản phẩm, kèm "warnings": \["explanation\_timeout"\].

## 5.2 Các API khác

| API | Trạng thái | Trả về |
| :---- | :---- | :---- |
| GET /api/assistant/{id} | \[Mới\] | Trang đã lưu |
| GET /api/products/{id}/co2 | \[Mới\] | co2e\_kg, source, confidence, explanation\_vi, detail, breakdown, references, green\_score, category |
| GET /api/products/{id}/related?limit=6 | \[Mới\] | Sản phẩm cùng loại xếp theo điểm xanh, kèm greener\_alternative (giá chênh trong khoảng ±15%) |
| GET /api/compare?ids=a,b,c | \[Mới\] | Tối đa 4 sản phẩm, đủ các dòng của trang So sánh, kèm best cho mỗi dòng |
| GET /api/categories/{cat}/stats | \[Mới\] | n, median\_kg, p25, p75, min, max |
| POST /api/cart, GET /api/cart/{id} | \[Mới\] | Giỏ hàng thử |
| POST /api/orders/test | \[Mới\] | Tạo đơn ở trạng thái awaiting\_confirmation |
| POST /api/orders/test/{id}/confirm | \[Mới\] | Chỉ giao diện web gọi được; chuyển sang confirmed\_test |
| GET /api/orders/test/{id} | \[Mới\] | Đơn thử |

 

# 6\. Bản mô tả trang (page spec) do AI tạo

AI chỉ trả về JSON theo khuôn dưới đây. Hệ thống kiểm tra JSON rồi **thay mọi chỗ cần số bằng dữ liệu thật**.

{

  "version": 1,

  "lang": "vi",

  "summary": "Gợi ý … vì …",

  "sections": \[

    {"type": "recommendations", "product\_ids": \["p1", "p2", "p3"\]},

    {"type": "formula", "product\_id": "p1"},

    {"type": "lifecycle", "product\_id": "p1"},

    {"type": "chart", "chart": "co2\_bar", "product\_ids": \["p1", "p2", "p3", "p4"\]},

    {"type": "chart", "chart": "price\_vs\_co2", "product\_ids": \["p1", "p2", "p3", "p4"\]},

    {"type": "category\_stats", "category": "laptop", "product\_id": "p1"},

    {"type": "savings", "best\_id": "p1", "baseline": "category\_median", "horizons\_months": \[6, 12\]},

    {"type": "why\_low\_co2", "bullets": \["…{{p1.co2e\_kg}} kg so với {{p2.co2e\_kg}} kg…"\]},

    {"type": "related", "product\_id": "p1"},

    {"type": "sources", "product\_ids": \["p1", "p2", "p3"\]}

  \]

}

**Quy tắc**

·       type chỉ được là một trong 10 loại trên. chart chỉ được là co2\_bar, price\_vs\_co2 hoặc lifecycle\_stack.  
·       Trong lời viết, AI **chỉ được nhắc số bằng chỗ giữ chỗ** dạng {{p1.co2e\_kg}}, {{p1.price}}, {{savings.kg\_12m}}… Hệ thống thay bằng số thật. Câu nào có số viết tay (không qua chỗ giữ chỗ) thì bị loại, và tăng bộ đếm number\_check\_failures.  
·       product\_ids phải nằm trong danh sách ứng viên đã tìm được.  
·       JSON sai khuôn thì thử lại 1 lần; vẫn sai thì dựng trang mặc định từ dữ liệu.

# 7\. Giao diện

## 7.1 Trang và component

| Trang | Component chính (đề xuất) | Ghi chú |
| :---- | :---- | :---- |
| /assistant \[Sửa\] | AskBox (chữ \+ giọng nói), SuggestedQuestions, History | Lịch sử lưu ở trình duyệt; chỉ lưu id trang |
| /assistant/:id \[Mới\] | PageRenderer đọc page spec và chọn component theo type: RecommendationCards, FormulaCard, LifecycleDiagram, Co2Chart, CategoryStats, SavingsPanel, WhyList, RelatedProducts, SourcesPanel, ActionBar, FollowUpBox | Tải dần từng phần, có khung chờ |
| /compare \[Mới\] | CompareTable, ProductPicker | Tối đa 4 sản phẩm; giữ danh sách trong đường dẫn |
| /method \[Mới\] | MethodFlow, FormulaExamples, ResultsTable | Nội dung tĩnh, song ngữ |
| /product/:id \[Sửa\] | Thêm LifecycleDiagram, GreenerAlternative, nút "Hỏi AI" | — |
| /search \[Sửa\] | Bộ lọc điểm xanh, nhãn nguồn số | — |
| /cart, /checkout, /orders/:id \[Mới\] | CartList, TestModeBanner, CheckoutSummary, ConfirmButton, OrderView | TestModeBanner luôn hiện, không tắt được |

 

## 7.2 Biểu đồ

·       Dùng Vega-Lite như trang /assistant hiện tại. Nếu chưa có trong package.json thì thêm vega, vega-lite, vega-embed.  
·       Màu điểm xanh từ 0 đến 5: thang màu từ đỏ sang xanh lá, dùng chung cho thẻ sản phẩm, biểu đồ và bảng.  
·       Mọi biểu đồ có tiêu đề, đơn vị (kg CO₂e) và chú thích nguồn.

## 7.3 Yêu cầu giao diện

·       Dùng tốt ở màn hình rộng 375 px trở lên và 1440 px.  
·       Tiếng Việt mặc định, chuyển sang tiếng Anh được (đã có).  
·       Có chữ thay thế (alt) cho ảnh; nút bấm được bằng bàn phím; độ tương phản đủ đọc.  
·       Sản phẩm chưa có số thì hiện "Chưa có số CO₂", không hiện điểm xanh.

# 8\. MCP server (B2)

| Mục | Yêu cầu |
| :---- | :---- |
| Ngôn ngữ / thư viện | Python 3.12, SDK MCP chính thức cho Python, giao thức HTTP có streaming (đề xuất) |
| Đường dẫn | https\://\<địa-chỉ-công-khai\>/mcp |
| Công cụ | search\_products, get\_product\_co2, compare\_products, explain\_co2\_method, create\_test\_order (xem bản nộp mục 3.3) |
| Đầu vào / ra | Mỗi công cụ có JSON Schema rõ ràng; kết quả gồm dữ liệu và url về trang của nhóm |
| Phân quyền | Công cụ đọc dữ liệu: công khai. create\_test\_order: chỉ tạo đơn chờ xác nhận, trả link để người dùng xác nhận trên web |
| Giới hạn | MCP\_RATE\_LIMIT\_PER\_MIN; thời gian chờ mỗi lần gọi ≤ 15 giây |
| Log | Thời gian, tên công cụ, tham số (bỏ thông tin cá nhân), thời gian chạy, lỗi |
| Test | Gọi thử từng công cụ bằng công cụ kiểm tra MCP; test tự động bằng pytest với db-search giả lập |
| Triển khai demo | docker compose up mcp-server, rồi mở đường hầm HTTPS bằng ngrok; thêm vào ChatGPT ở chế độ dành cho nhà phát triển (cần tài khoản phù hợp) |

 

# 9\. Mua hàng thử (B3)

**Trạng thái đơn**

draft → awaiting\_confirmation → confirmed\_test

                         	↘ cancelled

**Quy tắc**

·       CHECKOUT\_MODE phải là test, nếu không thì dịch vụ không khởi động.  
·       Không có trường nào nhận số thẻ hay tài khoản ngân hàng. Không gọi cổng thanh toán nào.  
·       AI (assistant hoặc MCP) chỉ tạo đơn đến bước awaiting\_confirmation. Bước xác nhận chỉ đi từ nút trên web.  
·       Đơn lưu saved\_co2e\_kg \= CO₂ của món "trung bình" trong loại trừ CO₂ của món đã chọn. Món trung bình là trung vị của loại.

# 10\. Chi tiết kỹ thuật nhóm A

| Mã | Đầu vào | Script / file | Đầu ra | Lệnh chạy (đề xuất) |
| :---- | :---- | :---- | :---- | :---- |
| A1 | test\_products.csv (28 sản phẩm, có link nguồn), danh sách 1.450 mẫu | scripts/research/threshold\_sweep.py (chạy trong container etl-worker để dùng CLIP thật) | docs/research/a1-threshold.md, file CSV kết quả theo từng ngưỡng, biểu đồ phân bố độ giống | docker compose \-f docker-compose.dev.yml exec backend-etl-worker python /app/scripts/threshold\_sweep.py |
| A2 | Báo cáo EPD/PCF của hãng | Thêm dòng vào carbon\_reference\_seed\_expanded.json | ≥ 5 mẫu mỗi loại; docs/research/a2-appliance-validation.md | pytest tests/test\_fallback.py và script so công thức với số thật |
| A3 | Trang sản phẩm Điện Máy Xanh, Thế Giới Di Động | Bộ cào trong airflow/scrapers/scrapers/sites/dienmayxanh/, tgdd/ | Cột energy\_kwh\_year, rated\_power\_w, capacity, energy\_stars | Chạy DAG cào; kiểm tra tỷ lệ có số |
| A4 | Bộ 28 sản phẩm, tên tiếng Việt | scripts/research/vi\_name\_experiment.py | Bảng so sánh 3 cách: giữ nguyên, dịch, mô hình đa ngôn ngữ | Chạy trong container |
| A5 | — | green/matching.py, tests/test\_exact\_match.py | Bỏ qua dung lượng, chặn khớp nhầm phiên bản | pytest tests/test\_exact\_match.py |
| A6 | stage\_share trong danh sách mẫu | green/vn\_use\_phase.py (mới) | Cột co2e\_breakdown; số "theo lưới điện Việt Nam" | pytest |
| A7 | Bảng IO Việt Nam, kiểm kê khí nhà kính | scripts/research/vn\_io\_factors.py | green/data/vn\_io\_factors.json | — |
| A8 | danh\_sach\_mau\_10000\_san\_pham\_CO2.xlsx | scripts/research/sample\_for\_review.py | File 200 dòng để kiểm tra tay; docs/research/a8-manual-review.md | — |

 

# 11\. Kiểm thử

| Loại | Phạm vi | Công cụ | Yêu cầu |
| :---- | :---- | :---- | :---- |
| Đơn vị | green/, rrf.py, kiểm tra page spec, thay chỗ giữ chỗ bằng số, trạng thái đơn | pytest | Mọi hàm tính mới đều có test; hiện có 47 test và phải luôn qua |
| API | db-search, assistant, mcp-server | pytest \+ httpx / TestClient của FastAPI | Mỗi API có test thành công, test lỗi 404 và test đầu vào sai |
| AI | Page spec | pytest với câu trả lời AI giả lập | AI viết số tay → câu bị loại; JSON sai → trang mặc định |
| Đầu–cuối | Hỏi AI → trang kết quả → so sánh → giỏ hàng → đơn thử | Playwright (đề xuất) | Chạy được trên bản dựng demo |
| Thủ công | Kịch bản video | Danh sách kiểm tra | Chạy trọn kịch bản 3 lần liền không lỗi |

 

**Bộ câu hỏi demo cố định (≥ 10 câu)**, ví dụ:

·       "laptop dưới 20 triệu ít CO₂"  
·       "màn hình 27 inch xanh nhất"  
·       "máy lạnh 1 HP tiết kiệm điện"  
·       "tủ lạnh 300 lít"  
·       "điện thoại pin trâu ít phát thải"

Lưu bộ câu hỏi ở scripts/research/demo\_queries.txt (đề xuất).

# 12\. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
| :---- | :---- |
| Tốc độ | Phần đầu trang kết quả ≤ 5 giây, cả trang ≤ 20 giây; API dữ liệu ≤ 1 giây; MCP mỗi lần gọi ≤ 15 giây |
| Ổn định | AI lỗi hoặc quá giờ thì vẫn hiện sản phẩm và số CO₂ |
| Đúng số | Số CO₂ giống nhau trên mọi trang, trong ChatGPT và trong cơ sở dữ liệu; number\_check\_failures của bộ câu hỏi demo bằng 0 |
| Bảo mật | Không commit bí mật; đơn hàng luôn ở chế độ thử; MCP không lộ dữ liệu nội bộ; kiểm tra mọi đầu vào |
| Riêng tư | Không lưu thông tin cá nhân; log chỉ giữ câu hỏi và số liệu kỹ thuật |
| Truy vết | Mỗi con số đều có nguồn, độ tin cậy, các mẫu đã dùng và link báo cáo |
| Dễ chạy lại | Máy mới: clone → Copy-Item .env.example .env → docker compose up là chạy được; test CO₂ chạy được không cần Docker |

 

# 13\. Định nghĩa "xong" cho mỗi việc

·       Code nằm trên nhánh riêng, đã gộp vào main qua PR, không xung đột.  
·       Có test mới, và mọi test cũ vẫn qua.  
·       Biến môi trường mới đã ghi vào .env.example / backend/.env.dev và docs/co2-setup.md.  
·       Tài liệu kết quả (với việc nhóm A) nằm ở docs/research/, có số liệu và ngày chạy.  
·       Việc có giao diện: có ảnh chụp màn hình trên PR, chạy được ở màn hình 375 px và 1440 px.  
·       Đã chạy thử trên bản clone mới.

# 14\. Rủi ro

| Rủi ro | Ảnh hưởng | Cách xử lý |
| :---- | :---- | :---- |
| Không có tài khoản ChatGPT cho phép thêm MCP | Không demo được B2 | Demo bằng ứng dụng khác hỗ trợ MCP, hoặc bỏ B2 |
| Hết lượt gọi hoặc hết tiền khóa API của AI | Trang kết quả không có lời giải thích | Có trang mặc định; lưu sẵn trang cho bộ câu hỏi demo |
| Ít báo cáo EPD cho đồ gia dụng | A2 không đủ 5 mẫu mỗi loại | Ghi rõ là giới hạn; dùng số nhãn năng lượng để kiểm tra phần điện |
| Trang bán hàng đổi giao diện | A3 cào hỏng | Test bộ cào theo trang mẫu đã lưu |
| Máy demo yếu | Trang chậm | Chạy trước, lưu sẵn trang; tắt các dịch vụ cào khi quay video |

 

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAi4AAABUCAYAAAClbLxRAAAoB0lEQVR4Xu2dd7CVxfnHk0kymeSvTHomvbfJpLdJExCkiyBSLCAiICBFAREERKQrUkSKIEGQIggiLShBiiAiovQunYAiXaTvbz7r7znZu3nPOdzLvZx78PuZOeM9533Pu7vPPvu03YMfczmmadOm7mMf+5hbs2aNf1+zZk338Y9/3PXr18+dP3/e/f73v/fXjcGDB/v3EyZMcCdPnnQ//elP3Wc/+1k3evRoN3XqVPfNb37TffGLX3Tbt2/393MvzzDC9rp16+Y+97nPuX/+85/u5ZdfdsuWLfPfo90Q2vnRj35UoJ1GjRq5o0ePuho1avj+9uzZ082ePdv95S9/8ffNmzfPfzdT/2OuueYa9/nPf96tXr3av+ce7uU7QJ95zxg2btzovvrVr/rx01bbtm3dJz7xCf8MYCyf/vSn3d/+9jc3bdo099e//tX3066HxO2AyY2xMyZkOm7cODd8+HD/9/e+9z23a9cut2XLFi/zb3zjG14udv03v/mNO3DgQNBKZhYuXOhl3KtXL3fu3Ln4cooRI0b4cVaqVMnNmDHD/e53vyswbusPcpk+fbqbM2eOa9mypWvfvn30pA/hXuYLGa1du9brAWMP70cnGBP3MkZ0gO/QBvIJ58UI552+mnx4/muvveZ2797tLl68mLrfaNy4sdd9g/tD/UU2DRo08P0J25s7d67/jDHv2LHDrVu3zlWpUsXVq1fPnTlzxt/DmH7+85/7a8wdL/rP/H/rW99yr776aurzw4cP++/Q1y984Qupdlq3bu3q16+feh/CHNg8HDx40P32t791zZs39+3zTHTG1rndb3IeNGiQ79uqVav8vfTpBz/4gXvjjTf8dXQzHC9rhLUC6MGPf/xjP9cm33379iXK9w9/+IPr2LGje/vtt/29fC+Ub5MmTVz16tXd+vXrvRwHDBjg9fLQoUO+ne9///v++du2bXM9evRIrQNswa9//esC65qxmTywKStXrvTPjEEm9hz0EHkjB8g0bmA8rVq1clu3bvWvDh06+LVuhPYEeBbPPHHihP8udgs5LFq0yI/51KlTqXtD0j0HGOcPf/hDt3z5cj++KVOmuK985St+PUE4zwZz06lTJ2+fwjbR76pVq3q7isxoI5yfv//97653796p9+Kj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>

[image2]: <data:image/png;base64,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>