"""End-to-end smoke test of the running stack (docker compose up), standard library only.

    python scripts/demo/smoke_e2e.py [--gateway http://localhost:8000] [--mcp http://localhost:8100/mcp]

Checks, in order: search (/query) -> CO2 of a product (formula + lifecycle) -> related / category stats
-> compare -> AI page (create + reopen, number check) -> test order (create, confirm refused without the
web header, confirm with it) -> MCP tools/list + search_products + create_test_order (never confirmed).
Prints one line per check and exits 1 if any check fails.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

FAILS: list[str] = []


def call(method: str, url: str, body=None, headers=None, timeout=300):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw), dict(r.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw), dict(e.headers)
        except ValueError:
            return e.code, raw, dict(e.headers)


def check(name: str, ok: bool, detail: str = "") -> bool:
    print(f"[{'OK' if ok else 'FAIL'}] {name}{' — ' + detail if detail else ''}", flush=True)
    if not ok:
        FAILS.append(name)
    return ok


def mcp_rpc(url: str, method: str, params: dict, rid: int):
    status, body, _ = call("POST", url, {"jsonrpc": "2.0", "id": rid, "method": method, "params": params},
                           headers={"Accept": "application/json, text/event-stream"}, timeout=60)
    if isinstance(body, str) and "data:" in body:  # SSE framing
        body = json.loads([line[5:] for line in body.splitlines() if line.startswith("data:")][-1])
    return status, body


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gateway", default="http://localhost:8000")
    ap.add_argument("--mcp", default="http://localhost:8100/mcp")
    ap.add_argument("--query", default="laptop dưới 20 triệu ít CO2")
    a = ap.parse_args()
    g = a.gateway.rstrip("/")

    status, body, _ = call("POST", f"{g}/query?q={urllib.parse.quote('laptop dell')}&limit=20", {})
    items = (body.get("products") or {}) if isinstance(body, dict) else {}
    items = items.get("products", items) if isinstance(items, dict) else items
    check("search /query", status == 200 and len(items) > 0, f"{len(items)} results")
    with_co2 = [i for i in items if i["product"].get("co2e_kg") is not None]
    check("search results carry CO2", len(with_co2) > 0, f"{len(with_co2)}/{len(items)} with co2e_kg")
    if not with_co2:
        sys.exit(1)
    pid = str(with_co2[0]["product"]["id"])

    status, co2, _ = call("GET", f"{g}/api/products/{pid}/co2")
    check("product CO2 + formula", status == 200 and co2.get("formula", {}).get("method") not in (None, "none"),
          f"{co2.get('product', {}).get('co2e_kg')} kg via {co2.get('formula', {}).get('method')}, "
          f"{len(co2.get('formula', {}).get('steps', []))} steps")
    stages = co2.get("lifecycle", {}).get("stages", [])
    total = sum(s["kg"] for s in stages)
    check("lifecycle sums to stored total", bool(stages) and abs(total - co2["product"]["co2e_kg"]) < 0.5,
          f"{co2.get('lifecycle', {}).get('basis')} {round(total, 1)} kg")

    status, rel, _ = call("GET", f"{g}/api/products/{pid}/related?limit=4")
    check("related products", status == 200 and isinstance(rel.get("items"), list), f"{len(rel.get('items', []))} items")
    cat = co2["product"].get("category")
    status, st, _ = call("GET", f"{g}/api/categories/{cat}/stats?product_id={pid}")
    check("category stats", status == 200 and (st.get("n") or 0) > 0,
          f"{cat}: n={st.get('n')} median={st.get('median_kg')} greener_than={st.get('greener_than_pct')}%")

    ids = ",".join(str(i["product"]["id"]) for i in with_co2[:3])
    status, cmp_, _ = call("GET", f"{g}/api/compare?ids={ids}")
    check("compare", status == 200 and len(cmp_.get("products", [])) >= 2, cmp_.get("conclusion", "")[:90])

    t0 = time.monotonic()
    status, page, _ = call("POST", f"{g}/api/assistant", {"message": a.query, "lang": "vi"})
    p = page.get("page", {}) if isinstance(page, dict) else {}
    check("AI page created", status == 200 and bool(p.get("sections")),
          f"{len(p.get('sections', []))} sections, model={p.get('meta', {}).get('model')}, "
          f"{int((time.monotonic() - t0) * 1000)} ms, warnings={p.get('warnings')}")
    check("AI page number check", p.get("meta", {}).get("number_check_failures", 1) == 0,
          f"failures={p.get('meta', {}).get('number_check_failures')}")
    if p.get("id"):
        status, again, _ = call("GET", f"{g}/api/assistant/{p['id']}")
        check("AI page reopens", status == 200 and again["page"]["summary"] == p["summary"], p.get("summary", "")[:100])
        rec = next((s for s in p["sections"] if s["type"] == "recommendations"), {})
        same = all(p["products"][i]["co2e_kg"] == call("GET", f"{g}/api/products/{i}/co2")[1]["product"]["co2e_kg"]
                   for i in rec.get("product_ids", [])[:2])
        check("same CO2 on page and product API (YC-5)", same)

    status, order, _ = call("POST", f"{g}/api/orders/test", {"items": [{"product_id": pid, "quantity": 1}], "created_by": "assistant"})
    check("test order created", status == 200 and order.get("status") == "awaiting_confirmation",
          f"saved {order.get('saved_co2e_kg')} kg vs category median")
    oid = order.get("id")
    status, _, _ = call("POST", f"{g}/api/orders/test/{oid}/confirm")
    check("confirm refused without web header", status == 403)
    status, conf, _ = call("POST", f"{g}/api/orders/test/{oid}/confirm", headers={"X-Confirm-Source": "web-ui"})
    check("confirm from web", status == 200 and conf.get("status") == "confirmed_test")

    try:
        status, init = mcp_rpc(a.mcp, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                                     "clientInfo": {"name": "smoke", "version": "1"}}, 1)
        check("MCP initialize", status == 200 and "result" in init, init.get("result", {}).get("serverInfo", {}).get("name", ""))
        status, tl = mcp_rpc(a.mcp, "tools/list", {}, 2)
        names = [t["name"] for t in tl.get("result", {}).get("tools", [])]
        check("MCP tools/list", {"search_products", "get_product_co2", "compare_products", "explain_co2_method",
                                  "create_test_order"} <= set(names), ", ".join(names))
        status, res = mcp_rpc(a.mcp, "tools/call", {"name": "search_products", "arguments": {"query": "laptop", "limit": 3}}, 3)
        text = " ".join(c.get("text", "") for c in res.get("result", {}).get("content", []))
        check("MCP search_products", status == 200 and not res.get("result", {}).get("isError"), text[:120])
        status, res = mcp_rpc(a.mcp, "tools/call", {"name": "create_test_order", "arguments": {"product_id": pid}}, 4)
        sc = res.get("result", {}).get("structuredContent", {})
        order_status = (sc.get("order") or sc).get("status")
        check("MCP create_test_order stays unconfirmed", order_status == "awaiting_confirmation", str(sc.get("confirm_url", ""))[:80])
    except (urllib.error.URLError, OSError, ValueError, KeyError) as error:
        check("MCP reachable", False, repr(error))

    print(f"\n{'ALL OK' if not FAILS else 'FAILED: ' + ', '.join(FAILS)}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
