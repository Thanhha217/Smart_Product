"""Offline audit of a pg_dump custom-format backup (advisor requirement #1).

Reads the dump file directly -- no Postgres server, no container -- and reports
row counts, duplicates, missing prices / descriptions, the category and
platform mix, and how many products carry a "green" signal.

    python scripts/research/audit_db_dump.py backups/pre_category_migration.dump
    python scripts/research/audit_db_dump.py <dump> --json out.json

Only works for dumps made with the default zlib compression.  Column order is
taken from the COPY statement stored in the dump's table of contents.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import zlib
from pathlib import Path

GREEN_PATTERN = re.compile(
    r"inverter|tiết kiệm (?:điện|năng lượng)|nhãn năng lượng|energy star|epeat|tco certified|"
    r"tái chế|recycl|nhãn xanh",
    re.IGNORECASE,
)
USED_PATTERN = re.compile(r"\b(cũ|like new|đã qua sử dụng|refurbished)\b", re.IGNORECASE)


def _read_int(buf: bytes, pos: int) -> tuple[int, int]:
    # pg_dump int: 1 sign byte + 4 little-endian bytes.
    value = int.from_bytes(buf[pos + 1:pos + 5], "little")
    return (-value if buf[pos] else value), pos + 5


def _data_blocks(buf: bytes) -> list[bytes]:
    """Every zlib-compressed data block, re-assembled from its length-prefixed chunks."""
    blocks, pos = [], 0
    while pos < len(buf) - 8:
        if buf[pos] == 0 and buf[pos + 5] == 0x78 and buf[pos + 6] in (0x01, 0x5E, 0x9C, 0xDA):
            decomp, out, cur = zlib.decompressobj(), bytearray(), pos
            try:
                while True:
                    length, start = _read_int(buf, cur)
                    if buf[cur] != 0 or length <= 0 or length > 50_000_000:
                        break
                    out += decomp.decompress(buf[start:start + length])
                    cur = start + length
                    if decomp.eof:
                        break
                if out:
                    blocks.append(bytes(out))
                    pos = cur
                    continue
            except zlib.error:
                pass
        pos += 1
    return blocks


def _copy_columns(buf: bytes) -> dict[str, list[str]]:
    cols = {}
    for m in re.finditer(rb"COPY public\.(\w+) \(([^)]*)\)", buf):
        cols[m.group(1).decode()] = [c.strip() for c in m.group(2).decode().split(",")]
    return cols


def _rows(block: bytes) -> list[list[str]]:
    lines = block.decode("utf-8", "ignore").split("\n")
    return [line.split("\t") for line in lines if line and line != "\\."]


def audit(path: Path) -> dict:
    buf = path.read_bytes()
    columns = _copy_columns(buf)
    blocks = _data_blocks(buf)

    # Match each block to a table by its column count (first row).
    tables: dict[str, list[list[str]]] = {}
    for block in blocks:
        rows = _rows(block)
        if not rows:
            continue
        for name, cols in columns.items():
            if name not in tables and all(len(r) == len(cols) for r in rows[:50]):
                tables[name] = rows
                break

    product_cols = columns["product"]
    col = {c: i for i, c in enumerate(product_cols)}
    products = tables.get("product", [])
    categories = {r[1]: r[0] for r in tables.get("category", [])}   # id -> name
    platforms = {r[1]: r[0] for r in tables.get("platform", [])}

    def text(r):
        return f"{r[col['name']]} {r[col['description']]}"

    unique_urls = {r[col["product_url"]] for r in products}
    report = {
        "rows": len(products),
        "unique_product_urls": len(unique_urls),
        "duplicate_ratio": round(1 - len(unique_urls) / max(1, len(products)), 3),
        "final_price_zero": sum(1 for r in products if float(r[col["final_price"]] or 0) == 0),
        "empty_description": sum(1 for r in products if len(r[col["description"]].strip()) < 5),
        "used_or_refurbished": sum(1 for r in products if USED_PATTERN.search(r[col["name"]])),
        "green_keyword": sum(1 for r in products if GREEN_PATTERN.search(text(r))),
        "by_category": collections.Counter(categories.get(r[col["category_id"]], r[col["category_id"]]) for r in products),
        "by_platform": collections.Counter(platforms.get(r[col["platform_id"]], r[col["platform_id"]]) for r in products),
        "tables": {name: len(rows) for name, rows in tables.items()},
    }
    report["by_category"] = dict(report["by_category"].most_common())
    report["by_platform"] = dict(report["by_platform"].most_common())
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("dump", type=Path)
    parser.add_argument("--json", type=Path, help="write the report to this file")
    args = parser.parse_args()

    report = audit(args.dump)
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.json:
        args.json.write_text(text, encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
