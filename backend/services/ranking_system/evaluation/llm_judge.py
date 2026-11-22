"""Paid-LLM relevance judge (advisor requirement #3).

Replaces the free Gemini few-shot labelling with Claude (Anthropic API) used as
a graded relevance judge.  Every (query, product) pair gets a label 0..3 plus
a short rationale.  Judgements are cached in a JSONL file keyed by
(query, product_id, prompt version) so a re-run never pays twice.

Requires ANTHROPIC_API_KEY (or an `ant auth login` profile).  Model defaults to
claude-opus-5-5; override with JUDGE_MODEL.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import anthropic
from pydantic import BaseModel, Field

JUDGE_MODEL = os.environ.get("JUDGE_MODEL", "claude-opus-5-5")
JUDGE_EFFORT = os.environ.get("JUDGE_EFFORT", "medium")
PROMPT_VERSION = "v1"

SYSTEM_PROMPT = """You are an expert relevance assessor for a Vietnamese e-commerce product search engine.
Given a user query (usually Vietnamese) and ONE candidate product, grade how well the product satisfies the query.

Scale:
3 = perfect: the product is exactly what the user asked for (right type, and brand/model/price/feature constraints satisfied)
2 = relevant: right product type, but misses a secondary constraint (e.g. brand, budget, size, feature)
1 = marginal: related product (accessory, different but adjacent type) that a user would rarely want
0 = irrelevant: wrong product type or unusable listing (price 0, broken/used when user asked new...)

Judge only from the information given. Do not reward the product for being cheap or eco-friendly unless the query asks for it.
Answer in JSON with fields: label (0-3 integer) and rationale (one short sentence in English)."""


class Judgement(BaseModel):
    label: int = Field(ge=0, le=3)
    rationale: str


_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "integer", "enum": [0, 1, 2, 3]},
        "rationale": {"type": "string"},
    },
    "required": ["label", "rationale"],
    "additionalProperties": False,
}


def _product_text(product: dict) -> str:
    fields = [
        ("Name", product.get("name")),
        ("Category", product.get("category")),
        ("Platform", product.get("platform")),
        ("Price (VND)", product.get("final_price")),
        ("Rating (0-1)", product.get("product_rating")),
        ("Reviews", product.get("review_count")),
        ("Description", (product.get("description") or "")[:600]),
    ]
    return "\n".join(f"{k}: {v}" for k, v in fields if v not in (None, ""))


def _cache_key(query: str, product: dict) -> str:
    raw = f"{PROMPT_VERSION}|{JUDGE_MODEL}|{query}|{product.get('product_id')}|{product.get('name')}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class LLMJudge:
    def __init__(self, cache_path: Path, client: anthropic.Anthropic | None = None):
        self.client = client or anthropic.Anthropic()
        self.cache_path = cache_path
        self.cache: dict[str, dict] = {}
        if cache_path.exists():
            for line in cache_path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    row = json.loads(line)
                    self.cache[row["key"]] = row

    def judge(self, query: str, product: dict) -> Judgement:
        key = _cache_key(query, product)
        if key in self.cache:
            return Judgement(label=self.cache[key]["label"], rationale=self.cache[key]["rationale"])

        response = self.client.beta.messages.create(
            model=JUDGE_MODEL,
            max_tokens=2048,
            # Stable system prompt first so it is cached across thousands of calls.
            system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{
                "role": "user",
                "content": f"Query: {query}\n\nCandidate product:\n{_product_text(product)}",
            }],
            output_config={"effort": JUDGE_EFFORT, "format": {"type": "json_schema", "schema": _SCHEMA}},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            raise RuntimeError(f"Judge refused for query {query!r} / product {product.get('product_id')}")
        text = next(b.text for b in response.content if b.type == "text")
        judgement = Judgement.model_validate_json(text)

        row = {"key": key, "query": query, "product_id": product.get("product_id"),
               "label": judgement.label, "rationale": judgement.rationale, "model": response.model}
        self.cache[key] = row
        with self.cache_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
        return judgement
