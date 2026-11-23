"""One structured-output call, whichever LLM the deployment has a key for.

LLM_PROVIDER = openai | anthropic | auto (default): auto takes OpenAI when OPENAI_API_KEY
is set, else Anthropic when ANTHROPIC_API_KEY is set, else raises LLMUnavailable so the
caller falls back to rule-based text. The model only ever returns JSON matching a schema;
numbers are checked by the caller.
"""
from __future__ import annotations

import json
import os

OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.4-mini")
ANTHROPIC_MODEL = os.environ.get("ASSISTANT_MODEL", "claude-opus-5-5")
TIMEOUT_S = float(os.environ.get("ASSISTANT_TIMEOUT_S", "20"))

_openai_client = None
_anthropic_client = None


class LLMUnavailable(RuntimeError):
    """No provider configured (or the configured one has no key)."""


def provider() -> str | None:
    choice = os.environ.get("LLM_PROVIDER", "auto").strip().lower()
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    if choice == "openai":
        return "openai" if has_openai else None
    if choice == "anthropic":
        return "anthropic" if has_anthropic else None
    if has_openai:
        return "openai"
    if has_anthropic:
        return "anthropic"
    return None


def model_label() -> str:
    p = provider()
    return f"openai:{OPENAI_MODEL}" if p == "openai" else f"anthropic:{ANTHROPIC_MODEL}" if p == "anthropic" else "rule-based"


def _openai(system: str, user: str, schema: dict, name: str, max_tokens: int) -> dict:
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(timeout=TIMEOUT_S, max_retries=1)
    response = _openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_schema", "json_schema": {"name": name, "schema": schema, "strict": True}},
        max_completion_tokens=max_tokens,
    )
    choice = response.choices[0]
    if getattr(choice.message, "refusal", None):
        raise RuntimeError("The model declined this request.")
    if choice.finish_reason == "length":
        raise RuntimeError("The model response was truncated.")
    return json.loads(choice.message.content)


def _anthropic(system: str, user: str, schema: dict, effort: str) -> dict:
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic
        _anthropic_client = anthropic.Anthropic(timeout=TIMEOUT_S, max_retries=1)
    response = _anthropic_client.beta.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=16000,
        system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("The model declined this request.")
    if response.stop_reason == "max_tokens":
        raise RuntimeError("The model response was truncated.")
    return json.loads(next(b.text for b in response.content if b.type == "text"))


def structured_call(system: str, user: str, schema: dict, name: str = "answer",
                    effort: str = "low", max_tokens: int = 4000) -> dict:
    p = provider()
    if p == "openai":
        return _openai(system, user, schema, name, max_tokens)
    if p == "anthropic":
        return _anthropic(system, user, schema, effort)
    raise LLMUnavailable("No LLM key configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)")
