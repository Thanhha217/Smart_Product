# Danh sách 10.000 sản phẩm có CO₂

`danh_sach_10000_san_pham_co2.csv` là bản xuất CSV (UTF-8) của bảng tính chung của nhóm
("Danh sách 10000 sản phẩm", Google Sheets, xuất ngày 23/11/2026). Sửa dữ liệu ở bảng tính gốc rồi xuất lại vào đây.

| Nguồn dữ liệu | Số dòng | Dùng làm mẫu (`carbonreference`)? |
|---|---|---|
| Boavizta (PCF của hãng) | 1.053 | Có |
| EcoAmazon (EPD của hãng) | 172 | Có |
| File mẫu 121 | 121 | Có |
| Báo cáo hãng (tìm 07/11/2026) | 104 | Có |
| EcoAmazon (tiêu đề Amazon) + mô hình CO₂ của hệ thống | 8.550 | **Không** — số do chính mô hình tính, dùng làm mẫu sẽ thành ước tính từ ước tính |

- 7.406/10.000 dòng có số CO₂ (74 %), 2.594 dòng để trống.
- 1.450 dòng số của hãng = đúng 1.450 dòng trong `backend/services/etl-worker/data/seed/carbon_reference_seed_expanded.json`.
- `scripts/research/enrich_seed_from_dataset.py` chép cột **Link** (báo cáo gốc) và **Đã kiểm tra chưa** vào seed
  (`source_url`, `verification`): 1.450/1.450 dòng khớp, 1.449 có link. Nhờ vậy mỗi số trên web dẫn được tới báo cáo của hãng.
