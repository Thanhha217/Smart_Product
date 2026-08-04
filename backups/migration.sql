-- Category taxonomy migration.
-- Adds taxonomy columns, backfills raw_category from the old category name,
-- collapses duplicate categories onto their slug, and adds the columns the
-- current models expect. Idempotent: safe to re-run.
BEGIN;

-- 1. New columns (IF NOT EXISTS keeps this re-runnable).
ALTER TABLE category ADD COLUMN IF NOT EXISTS slug varchar;
ALTER TABLE category ADD COLUMN IF NOT EXISTS name_vi varchar NOT NULL DEFAULT '';
ALTER TABLE category ADD COLUMN IF NOT EXISTS department varchar NOT NULL DEFAULT '';
ALTER TABLE product  ADD COLUMN IF NOT EXISTS raw_category varchar NOT NULL DEFAULT '';

-- Carbon columns the Product model already declares but the DB never got.
ALTER TABLE product ADD COLUMN IF NOT EXISTS co2e_kg double precision;
ALTER TABLE product ADD COLUMN IF NOT EXISTS co2e_source varchar;
ALTER TABLE product ADD COLUMN IF NOT EXISTS co2e_confidence double precision;
ALTER TABLE product ADD COLUMN IF NOT EXISTS co2e_explanation varchar;

-- 2. Preserve the original label before the category rows are collapsed.
UPDATE product p SET raw_category = c.name
  FROM category c WHERE p.category_id = c.id AND p.raw_category = '';

-- 3. Stamp the taxonomy onto each existing row.
UPDATE category SET slug='smartphones', name='Smartphones', name_vi='Điện thoại di động', department='Electronics & Tech' WHERE id=1;
UPDATE category SET slug='smartphones', name='Smartphones', name_vi='Điện thoại di động', department='Electronics & Tech' WHERE id=2;
UPDATE category SET slug='laptops', name='Laptops', name_vi='Laptop', department='Electronics & Tech' WHERE id=3;
UPDATE category SET slug='headphones', name='Headphones & Earbuds', name_vi='Tai nghe', department='Electronics & Tech' WHERE id=4;
UPDATE category SET slug='monitors', name='Monitors', name_vi='Màn hình máy tính', department='Electronics & Tech' WHERE id=5;
UPDATE category SET slug='uncategorized', name='Uncategorized', name_vi='Chưa phân loại', department='Uncategorized' WHERE id=6;
UPDATE category SET slug='laptops', name='Laptops', name_vi='Laptop', department='Electronics & Tech' WHERE id=7;
UPDATE category SET slug='headphones', name='Headphones & Earbuds', name_vi='Tai nghe', department='Electronics & Tech' WHERE id=8;
UPDATE category SET slug='monitors', name='Monitors', name_vi='Màn hình máy tính', department='Electronics & Tech' WHERE id=9;
UPDATE category SET slug='tablets', name='Tablets', name_vi='Máy tính bảng', department='Electronics & Tech' WHERE id=10;
UPDATE category SET slug='smartwatches', name='Smartwatches', name_vi='Đồng hồ thông minh', department='Electronics & Tech' WHERE id=11;
UPDATE category SET slug='smartwatches', name='Smartwatches', name_vi='Đồng hồ thông minh', department='Electronics & Tech' WHERE id=12;
UPDATE category SET slug='tablets', name='Tablets', name_vi='Máy tính bảng', department='Electronics & Tech' WHERE id=13;

-- 4. Collapse duplicates onto the surviving row, then delete the extras.
-- headphones: keep id=4, merge 8
UPDATE product SET category_id=4 WHERE category_id IN (8);
DELETE FROM category WHERE id IN (8);
-- laptops: keep id=3, merge 7
UPDATE product SET category_id=3 WHERE category_id IN (7);
DELETE FROM category WHERE id IN (7);
-- monitors: keep id=5, merge 9
UPDATE product SET category_id=5 WHERE category_id IN (9);
DELETE FROM category WHERE id IN (9);
-- smartphones: keep id=1, merge 2
UPDATE product SET category_id=1 WHERE category_id IN (2);
DELETE FROM category WHERE id IN (2);
-- smartwatches: keep id=11, merge 12
UPDATE product SET category_id=11 WHERE category_id IN (12);
DELETE FROM category WHERE id IN (12);
-- tablets: keep id=10, merge 13
UPDATE product SET category_id=10 WHERE category_id IN (13);
DELETE FROM category WHERE id IN (13);

-- 5. Enforce one row per slug from here on.
ALTER TABLE category ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_category_slug ON category (slug);

COMMIT;
