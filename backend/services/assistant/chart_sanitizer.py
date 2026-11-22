"""Make LLM-written Vega-Lite code safe to render.

The model writes the chart *code*; we never let it choose the data source.
Anything that could load remote content or open links is removed, every
nested data block is dropped, and the real rows are injected at the top.
"""

from __future__ import annotations

import json

_FORBIDDEN_KEYS = {"url", "href", "usermeta", "datasets", "data", "loader", "config"}
_MAX_SPEC_CHARS = 20_000


def _strip(node):
    if isinstance(node, dict):
        return {k: _strip(v) for k, v in node.items() if k not in _FORBIDDEN_KEYS}
    if isinstance(node, list):
        return [_strip(v) for v in node]
    if isinstance(node, str) and node.lower().startswith(("http:", "https:", "javascript:", "data:")):
        return ""
    return node


def _fields(node, out: set[str], derived: set[str]) -> set[str]:
    """Collect referenced field names; names created by transforms ("as") go to ``derived``."""
    if isinstance(node, dict):
        if isinstance(node.get("field"), str):
            out.add(node["field"])
        alias = node.get("as")
        if isinstance(alias, str):
            derived.add(alias)
        elif isinstance(alias, list):
            derived.update(a for a in alias if isinstance(a, str))
        for v in node.values():
            _fields(v, out, derived)
    elif isinstance(node, list):
        for v in node:
            _fields(v, out, derived)
    return out


def sanitize_spec(raw: str, rows: list[dict]) -> dict | None:
    """Return a safe Vega-Lite spec with ``rows`` inlined, or None if unusable."""
    if not raw or len(raw) > _MAX_SPEC_CHARS:
        return None
    try:
        spec = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(spec, dict):
        return None

    spec = _strip(spec)
    derived: set[str] = set()
    used = _fields(spec, set(), derived)
    known = (set(rows[0]) if rows else set()) | derived
    if not used <= known:
        return None     # the model referenced a column we did not compute
    spec["$schema"] = "https://vega.github.io/schema/vega-lite/v5.json"
    spec["data"] = {"values": rows}
    spec.setdefault("width", "container")
    return spec
