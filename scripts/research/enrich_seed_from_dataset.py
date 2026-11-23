"""Copy the report link and check status of the 1,450 manufacturer figures from the
team dataset (data/co2-catalogue/danh_sach_10000_san_pham_co2.csv, exported from the
shared Google Sheet) into the reference seed, so every CO2 number on the web can link
to the manufacturer's report.

Only rows whose source is a manufacturer figure are used. The 8,550 Amazon rows hold
numbers computed BY this system's model: they are never added as references
(that would estimate from estimates).

    python scripts/research/enrich_seed_from_dataset.py            # writes the seed in place
    python scripts/research/enrich_seed_from_dataset.py --check    # only report the matching
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATASET = ROOT / "data" / "co2-catalogue" / "danh_sach_10000_san_pham_co2.csv"
SEED = ROOT / "backend" / "services" / "etl-worker" / "data" / "seed" / "carbon_reference_seed_expanded.json"
MODEL_SOURCE = "EcoAmazon (tiêu đề Amazon)"  # rows computed by our own model


def key(name: str, kg) -> tuple[str, float]:
    return " ".join((name or "").lower().split()), round(float(kg), 3)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    sys.stdout.reconfigure(encoding="utf-8")

    with open(DATASET, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    manufacturer = [r for r in rows if not r["Nguồn dữ liệu"].startswith(MODEL_SOURCE) and r["CO₂ (kg)"]]
    by_key = {}
    for r in manufacturer:
        by_key.setdefault(key(r["Tên sản phẩm"], r["CO₂ (kg)"]), r)

    seed = json.loads(SEED.read_text(encoding="utf-8"))
    matched = 0
    for ref in seed:
        r = by_key.get(key(ref["name"], ref["co2e_kg"]))
        if r is None:
            continue
        matched += 1
        link = (r["Link"] or "").strip()
        if link.startswith("http"):
            ref["source_url"] = link
        ref["verification"] = (r["Đã kiểm tra chưa"] or "").strip() or None

    with_url = sum(1 for ref in seed if ref.get("source_url"))
    print(f"dataset rows: {len(rows)}; manufacturer rows: {len(manufacturer)}; "
          f"seed rows: {len(seed)}; matched: {matched}; with report link: {with_url}")
    if not args.check:
        SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"updated {SEED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
