# Chạy toàn bộ hệ thống trên máy (đã chạy thử 23/11/2026, Windows 11 + Docker Desktop, 8 nhân, 10 GB RAM cho Docker)

## 1. Khởi động
```bash
cp .env.example .env                       # PowerShell: Copy-Item .env.example .env
# (tuỳ chọn) đặt ANTHROPIC_API_KEY trong .env để AI viết lời giải thích; không có thì trang dùng câu mẫu
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d smart-product-finder-database
```

## 2. Nạp dữ liệu có sẵn (thay vì cào lại từ đầu)
```bash
docker cp data/backups/pre_category_migration.dump smart-product-finder-database:/tmp/dump
docker cp data/backups/migration.sql smart-product-finder-database:/tmp/migration.sql
docker exec smart-product-finder-database pg_restore -U postgres -d smart_product_finder --no-owner /tmp/dump
docker exec smart-product-finder-database psql -U postgres -d smart_product_finder -f /tmp/migration.sql
# bỏ bản ghi trùng URL (dump có 55.409 dòng cho 14.130 URL), giữ bản mới nhất có giá
docker exec smart-product-finder-database psql -U postgres -d smart_product_finder -c "
BEGIN;
CREATE TEMP TABLE keep AS SELECT DISTINCT ON (product_url) id FROM product
  ORDER BY product_url, (final_price>0) DESC, scraped_at DESC NULLS LAST, id DESC;
DELETE FROM image WHERE product_id NOT IN (SELECT id FROM keep);
DELETE FROM product WHERE id NOT IN (SELECT id FROM keep);
COMMIT;"
```

## 3. Bật các dịch vụ và dựng chỉ mục + tính CO₂
```bash
docker compose -f docker-compose.dev.yml up -d kafka kafka-ui ollama ollama-model-puller backend-clip-provider \
  backend-etl-worker ranking-system db-search assistant backend-gateway mcp-server frontend
docker exec smartproductfinder-backend-etl-worker python -m tools.backfill --reset-co2   # ~10 phút cho 7.389 sản phẩm
docker restart smartproductfinder-backend-etl-worker   # nạp lại chỉ mục mới trước khi nhận sản phẩm cào mới
```
Kết quả lần chạy 23/11/2026: 7.389/7.389 sản phẩm có số CO₂ (trung bình mẫu giống 4.396, mức giữa của loại 2.806, số của hãng 187).

## 4. Cào dữ liệu thật (Airflow → Kafka → etl-worker)
```bash
docker compose -f docker-compose.dev.yml up -d airflow-init && docker compose -f docker-compose.dev.yml up -d \
  airflow-apiserver airflow-scheduler airflow-dag-processor airflow-worker airflow-triggerer
docker exec airflow-scheduler airflow dags unpause dienmayxanh_scraper_dag
docker exec airflow-scheduler airflow dags trigger dienmayxanh_scraper_dag
```
Airflow UI: http://localhost:8080 · Kafka UI: http://localhost:8081. Sản phẩm mới được tính CO₂ ngay khi vào etl-worker
(log: `docker logs -f smartproductfinder-backend-etl-worker`).

## 5. Kiểm tra end-to-end
```bash
python scripts/demo/smoke_e2e.py     # tìm kiếm → CO₂ → so sánh → trang AI → đơn thử → MCP
```
Web: http://localhost:5173 · API: http://localhost:8000/api · MCP: http://localhost:8100/mcp

## Lưu ý đã gặp
- CLIP từng chạy ở chế độ training, 8 luồng mỗi request: 6–12 s/câu. Đã sửa (eval + inference_mode + `TORCH_NUM_THREADS=4`): ~0,15 s/câu.
- SQLAlchemy 2.1 mặc định dùng driver psycopg 3: assistant ghim SQLAlchemy 2.0 và ép `postgresql+psycopg2`.
- Trước đây etl-worker khởi động lại là ghi đè FAISS index bằng index rỗng ở lần nạp đầu tiên. Đã sửa: index được đọc lại từ đĩa.
