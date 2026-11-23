"""Leave-one-family-out evaluation of the CO2 fallback methods on the reference catalogue.

Usage (from the repo root, no Docker, no database):
    python scripts/research/eval_co2_methods.py            # prints tables (Markdown)
    python scripts/research/eval_co2_methods.py --json out.json

Data: backend/services/etl-worker/data/seed/carbon_reference_seed_expanded.json
(1,450 products with a manufacturer-published cradle-to-grave figure).

Protocol (as docs/research/co2-fallback.md §3.1): every product is predicted from the
other products, after removing its whole *family* (brand + first word of the model name
after the brand, e.g. every Dell "Latitude"), so a sibling model cannot leak the answer.

Methods compared
  (a) category median          median kg of the category (remaining rows)
  (b) brand median             median of the brand in the category if it has >= 3 rows, else (a)
  (c) category model           green.fallback.category_model_estimate (brand level + screen size)
  ablation                     (c) with screen-size exponent 0 / fitted / 1.0 for monitors and laptops
Metrics: n, MdAPE, MAPE, share off by more than 2x, Spearman rho, pairwise ranking accuracy
(fraction of same-category pairs put in the right order; ranking only uses the order).
Also: exact-match sanity check (green.matching) and a lifecycle-formula table with grid
factor sensitivity (0.681 for 2024 vs 0.6592 for 2023).

Stdlib + the pure `green` package only.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ETL = ROOT / "backend" / "services" / "etl-worker"
sys.path.insert(0, str(ETL))

import green.fallback as fb  # noqa: E402
from green.co2_formula import estimate_co2  # noqa: E402
from green.matching import find_exact_reference, tokens  # noqa: E402
from green.spec_parser import parse_specs  # noqa: E402

SEED = ETL / "data" / "seed" / "carbon_reference_seed_expanded.json"
MIN_BRAND = fb.MIN_BRAND_REFS


# ------------------------------------------------------------------ helpers

def family(ref: dict) -> tuple[str, str]:
    brand = tokens(ref.get("brand"))
    name = tokens(ref.get("name"))
    if brand and name.startswith(brand + " "):
        name = name[len(brand) + 1:]
    first = name.split(" ")[0] if name else ""
    return brand, first


def _ranks(values: list[float]) -> list[float]:
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def spearman(x: list[float], y: list[float]) -> float | None:
    if len(x) < 3:
        return None
    rx, ry = _ranks(x), _ranks(y)
    mx, my = statistics.fmean(rx), statistics.fmean(ry)
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    return num / den if den else None


def pairwise_accuracy(true: list[float], pred: list[float]) -> float | None:
    good = total = 0.0
    n = len(true)
    for i in range(n):
        for j in range(i + 1, n):
            dt = true[i] - true[j]
            if dt == 0:
                continue
            total += 1
            dp = pred[i] - pred[j]
            if dp == 0:
                good += 0.5
            elif (dp > 0) == (dt > 0):
                good += 1
    return good / total if total else None


def metrics(rows: list[tuple[str, float, float]]) -> dict:
    """rows: (category, true, pred)."""
    if not rows:
        return {"n": 0}
    ape = [abs(p - t) / t for _, t, p in rows]
    off2 = [max(p / t, t / p) > 2 for _, t, p in rows]
    by_cat: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for c, t, p in rows:
        by_cat[c].append((t, p))
    # pairwise accuracy pooled over within-category pairs
    good = total = 0.0
    for pairs in by_cat.values():
        t = [a for a, _ in pairs]
        p = [b for _, b in pairs]
        acc = pairwise_accuracy(t, p)
        if acc is not None:
            k = sum(1 for i in range(len(t)) for j in range(i + 1, len(t)) if t[i] != t[j])
            good += acc * k
            total += k
    return {
        "n": len(rows),
        "mdape": statistics.median(ape) * 100,
        "mape": statistics.fmean(ape) * 100,
        "off2x": sum(off2) / len(off2) * 100,
        "spearman": spearman([t for _, t, _ in rows], [p for _, _, p in rows]),
        "pairwise": (good / total * 100) if total else None,
    }


# ------------------------------------------------------------------ methods

def predict_medians(train: list[dict], ref: dict) -> tuple[float | None, float | None]:
    cat = fb.canonical_category(ref["category"])
    vals = [r["co2e_kg"] for r in train if fb.canonical_category(r["category"]) == cat]
    if len(vals) < fb.MIN_REFS:
        return None, None
    cat_med = statistics.median(vals)
    brand = (ref.get("brand") or "").lower()
    bvals = [r["co2e_kg"] for r in train
             if fb.canonical_category(r["category"]) == cat and (r.get("brand") or "").lower() == brand]
    brand_med = statistics.median(bvals) if len(bvals) >= MIN_BRAND else cat_med
    return cat_med, brand_med


_INCH = re.compile(r"(\d+(?:\.\d+)?)\s*-\s*inch", re.I)


def shop_style_inch(name: str) -> str:
    """'Monitor 27-inch' -> 'Monitor 27 inch' (how Vietnamese shops write it; spec_parser misses the hyphen)."""
    return _INCH.sub(lambda m: f"{m.group(1)} inch", name)


def run_lofo(refs: list[dict], slopes: dict[str, float] | None = None) -> dict[str, list]:
    """Return per-method rows (category, true, pred)."""
    original = dict(fb.SIZE_MODEL)
    if slopes:
        for cat, slope in slopes.items():
            _, ref_size, rng = original[cat]
            fb.SIZE_MODEL[cat] = (slope, ref_size, rng)
    out: dict[str, list] = {"category_median": [], "brand_median": [], "category_model": [], "category_model_inch": []}
    try:
        fam_of = [family(r) for r in refs]
        groups: dict[tuple, list[int]] = defaultdict(list)
        for i, f in enumerate(fam_of):
            groups[f].append(i)
        for fam, idxs in groups.items():
            held = set(idxs)
            train = [r for i, r in enumerate(refs) if i not in held]
            stats = fb.CategoryStats.from_references(train)
            for i in idxs:
                ref = refs[i]
                true = float(ref["co2e_kg"])
                cat = fb.canonical_category(ref["category"])
                cm, bm = predict_medians(train, ref)
                if cm is None:
                    continue
                out["category_median"].append((cat, true, cm))
                out["brand_median"].append((cat, true, bm))
                est = fb.category_model_estimate(stats, cat, ref["name"])
                if est is not None:
                    out["category_model"].append((cat, true, est.co2e_kg))
                est = fb.category_model_estimate(stats, cat, shop_style_inch(ref["name"]))
                if est is not None:
                    out["category_model_inch"].append((cat, true, est.co2e_kg))
    finally:
        fb.SIZE_MODEL.clear()
        fb.SIZE_MODEL.update(original)
    return out


def exact_match_check(refs: list[dict]) -> dict:
    hit_self = hit_any = wrong = 0
    shop_hit = 0
    for ref in refs:
        found = find_exact_reference(ref["name"], refs)
        if found is not None:
            hit_any += 1
            if found["name"] == ref["name"]:
                hit_self += 1
            elif abs(float(found["co2e_kg"]) - float(ref["co2e_kg"])) > 1e-9:
                wrong += 1
        # shop-style name: drop the brand, add a Vietnamese product-type prefix
        brand = tokens(ref.get("brand"))
        name = tokens(ref["name"])
        if brand and name.startswith(brand + " "):
            name = name[len(brand) + 1:]
        if find_exact_reference(f"Sản phẩm {name} chính hãng", refs) is not None:
            shop_hit += 1
    n = len(refs)
    eligible = sum(1 for r in refs if len(tokens(r["name"]).split()) >= 3)
    return {"n": n, "eligible_3_words": eligible, "hit_any": hit_any, "hit_self": hit_self,
            "hit_other_different_kg": wrong, "shop_style_hit": shop_hit}


APPLIANCES = [
    ("air_conditioner", "Máy lạnh Daikin Inverter 1.5 HP FTKB35", "Tiêu thụ điện 820 kWh/năm"),
    ("refrigerator", "Tủ lạnh Panasonic Inverter 322 lít", "Nhãn năng lượng 5 sao"),
    ("television", 'Smart Tivi Samsung 4K 75 inch', ""),
    ("washing_machine", "Máy giặt LG Inverter 9 kg", ""),
    ("electric_fan", "Quạt đứng Toshiba 55W", "Công suất 55W"),
]


def formula_table() -> list[dict]:
    rows = []
    for cat, name, desc in APPLIANCES:
        key = fb.FORMULA_CATEGORY[cat]
        specs = parse_specs(name, desc)
        r681 = estimate_co2(key, specs, ef_grid=0.681)
        r659 = estimate_co2(key, specs, ef_grid=0.6592)
        use = r681.lifecycle_kg - r681.embodied_kg - r681.eol_kg
        rows.append({"name": name, "category": key, "kwh_year": r681.annual_kwh, "kwh_source": r681.kwh_source,
                     "lifetime": r681.lifetime_years, "embodied": r681.embodied_kg, "use": round(use, 1),
                     "eol": r681.eol_kg, "total_681": r681.lifecycle_kg, "total_6592": r659.lifecycle_kg,
                     "low": r681.lifecycle_low_kg, "high": r681.lifecycle_high_kg,
                     "use_share": round(use / r681.lifecycle_kg * 100, 1)})
    return rows


# ------------------------------------------------------------------ report

def _fmt(v, d=1):
    if v is None:
        return "–"
    if isinstance(v, float):
        return f"{v:.{d}f}"
    return str(v)


def table(results: dict[str, list], methods: list[str]) -> str:
    cats = sorted({c for m in methods for c, _, _ in results[m]},
                  key=lambda c: -len([1 for x in results[methods[0]] if x[0] == c]))
    lines = ["| Loại | Cách | n | MdAPE % | MAPE % | Lệch >2× % | Spearman | Đúng thứ tự cặp % |",
             "|---|---|---|---|---|---|---|---|"]
    for scope in ["ALL"] + cats:
        for m in methods:
            rows = results[m] if scope == "ALL" else [r for r in results[m] if r[0] == scope]
            if not rows:
                continue
            s = metrics(rows)
            lines.append(f"| {scope} | {m} | {s['n']} | {_fmt(s['mdape'])} | {_fmt(s['mape'])} | {_fmt(s['off2x'])} | "
                         f"{_fmt(s['spearman'], 3)} | {_fmt(s['pairwise'])} |")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", help="write raw metrics to this file")
    args = ap.parse_args()

    refs = [r for r in json.loads(SEED.read_text(encoding="utf-8")) if float(r.get("co2e_kg") or 0) > 0]
    families = len({family(r) for r in refs})
    print(f"# CO2 method evaluation — {len(refs)} reference products, {families} families\n")

    main_res = run_lofo(refs)
    methods = ["category_median", "brand_median", "category_model", "category_model_inch"]
    for c in fb.SIZE_MODEL:
        names = [r["name"] for r in refs if fb.canonical_category(r["category"]) == c]
        raw = sum(1 for n in names if fb._screen_inch(n, None))
        norm = sum(1 for n in names if fb._screen_inch(shop_style_inch(n), None))
        print(f"- {c}: {len(names)} names, screen size parsed as-is {raw}, after '27-inch'->'27 inch' {norm}")
    print()
    print("## Leave-one-family-out\n")
    print(table(main_res, methods))

    print("\n## Ablation: screen-size exponent (category model, names written '27 inch')\n")
    fitted = {c: fb.SIZE_MODEL[c][0] for c in fb.SIZE_MODEL}
    abl = {}
    for label, slopes in [("b=0", {c: 0.0 for c in fitted}), ("b=fitted", None), ("b=1.0", {c: 1.0 for c in fitted})]:
        res = run_lofo(refs, slopes)
        abl[label] = {c: metrics([r for r in res["category_model_inch"] if r[0] == c]) for c in fitted}
    lines = ["| Loại | Số mũ b | n | MdAPE % | MAPE % | Spearman | Đúng thứ tự cặp % |", "|---|---|---|---|---|---|---|"]
    for c in fitted:
        for label in abl:
            s = abl[label][c]
            b = fitted[c] if label == "b=fitted" else label[2:]
            lines.append(f"| {c} | {b} | {s['n']} | {_fmt(s['mdape'])} | {_fmt(s['mape'])} | {_fmt(s['spearman'], 3)} | {_fmt(s['pairwise'])} |")
    print("\n".join(lines))

    print("\n## Exact match sanity check\n")
    em = exact_match_check(refs)
    print(json.dumps(em, ensure_ascii=False))

    print("\n## Lifecycle formula (appliances), grid 0.681 vs 0.6592\n")
    ft = formula_table()
    print("| Sản phẩm | kWh/năm (nguồn) | Năm | Sản xuất | Dùng điện | Thải bỏ | Tổng @0,681 | Tổng @0,6592 | Khoảng | % dùng điện |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for r in ft:
        print(f"| {r['name']} | {r['kwh_year']} ({r['kwh_source']}) | {r['lifetime']:g} | {r['embodied']} | {r['use']} | {r['eol']} | "
              f"{r['total_681']} | {r['total_6592']} | {r['low']}–{r['high']} | {r['use_share']} |")

    if args.json:
        raw = {m: {"ALL": metrics(main_res[m]),
                   **{c: metrics([r for r in main_res[m] if r[0] == c]) for c in {x[0] for x in main_res[m]}}}
               for m in methods}
        Path(args.json).write_text(json.dumps({"lofo": raw, "ablation": abl, "exact_match": em, "formula": ft},
                                              ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
