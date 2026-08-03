"""Resolve raw scraped category strings onto the standard taxonomy.

Each source labels categories in its own way -- Vietnamese display names from
TGDD/DienmayXanh, English slugs from CellphoneS/PhongVu, breadcrumb text from
FPT. This module maps all of them onto one vocabulary.

Two layers, in order:

1. **Exact alias lookup.** Every surface form in the taxonomy (Vietnamese name,
   English name, each alias) is indexed at import. This is pure Python, costs
   nothing, and resolves every value the spiders currently emit -- all of them
   are literal surface forms.
2. **Embedding nearest-neighbour.** Only for strings the alias index misses.
   Uses a multilingual model so Vietnamese and English share a vector space,
   which is what lets a novel label like "Card màn hình RTX 4070" find
   PC Components without anyone adding an alias for it first.

Layer 2 is optional. When sentence-transformers is not installed the matcher
still runs on layer 1 alone and unmatched strings become Uncategorized -- their
original text is kept in product.raw_category, so a SQL query over that column
tells you exactly which aliases are worth adding. Set CATEGORY_EMBEDDINGS=on to
make the model mandatory (startup fails if it is missing) or =off to disable it
outright; the default, auto, uses it when available.

Thread safety: the ETL worker runs one consumer thread per shop, all calling
match_category concurrently. Layer 1 is read-only after import. Model loading is
guarded by a lock and should be done up front via warm_matcher().
"""

from __future__ import annotations

import logging
import os
import re
import threading
import unicodedata
from dataclasses import dataclass
from functools import lru_cache

from taxonomy.categories import STANDARD_CATEGORIES, UNCATEGORIZED, StandardCategory

logger = logging.getLogger(__name__)

# Multilingual model -- this is the whole reason cross-language matching works.
# Swapping to a monolingual model will silently break Vietnamese resolution.
DEFAULT_MODEL = os.environ.get(
    "CATEGORY_EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)

# off: alias-only (default) | auto: use embeddings when installed | on: require
#
# Auto-apply is OFF by default because it is measurably unsafe with the current
# model: junk strings outscore genuine labels, so no threshold separates them.
# Measured on paraphrase-multilingual-MiniLM-L12-v2 --
#     '!!!!'                        -> Bags              0.822
#     '...'                         -> Air Conditioners  0.809
#     'nồi chiên không dầu Philips' -> Rice Cookers      0.744  (correct)
# Very short aliases ("vở", "den", "quat", "bỉm") act as attractors for
# degenerate input. Use top_k() to get ranked *suggestions* for a human to
# review into new aliases; see test_category_matcher.py for the guard test.
EMBEDDINGS_MODE = os.environ.get("CATEGORY_EMBEDDINGS", "off").strip().lower()

# Cosine similarity below this resolves to Uncategorized rather than being
# forced onto the nearest category. Only applies to layer 2, and only when that
# layer is enabled -- see the note above before trusting it.
DEFAULT_THRESHOLD = float(os.environ.get("CATEGORY_MATCH_THRESHOLD", "0.55"))

ALIAS_SCORE = 1.0   # an exact surface-form hit is by definition a perfect match

_SEPARATORS = re.compile(r"[_\-/|>\\]+")
_WHITESPACE = re.compile(r"\s+")


def clean(raw: str) -> str:
    """Normalise a raw label into a comparable form.

    Slugs and breadcrumbs get their separators opened up, so "computer_monitor"
    becomes "computer monitor" and "Điện thoại > Samsung" becomes
    "Điện thoại Samsung". Diacritics are deliberately preserved -- the model
    understands Vietnamese, and stripping them throws away signal.
    """
    text = unicodedata.normalize("NFC", raw or "")
    text = _SEPARATORS.sub(" ", text)
    return _WHITESPACE.sub(" ", text).strip()


def _build_alias_index() -> dict[str, StandardCategory]:
    index: dict[str, StandardCategory] = {}
    for category in STANDARD_CATEGORIES:
        for form in category.surface_forms:
            key = clean(form).casefold()
            if key:
                index.setdefault(key, category)
    return index


# Built once at import: pure data, no third-party imports, safe to share.
ALIAS_INDEX: dict[str, StandardCategory] = _build_alias_index()


@dataclass(frozen=True)
class MatchResult:
    """Outcome of resolving one raw string.

    `category` is UNCATEGORIZED when nothing resolved; check `is_confident` (or
    truthiness) rather than comparing the slug by hand.
    """

    raw: str
    category: StandardCategory
    score: float
    matched_on: str = ""            # which surface form won -- for debugging
    method: str = "none"            # alias | embedding | none

    @property
    def slug(self) -> str:
        return self.category.slug

    @property
    def name_en(self) -> str:
        return self.category.name_en

    @property
    def name_vi(self) -> str:
        return self.category.name_vi

    @property
    def department(self) -> str:
        return self.category.department

    @property
    def is_confident(self) -> bool:
        return self.category is not UNCATEGORIZED

    def __bool__(self) -> bool:
        return self.is_confident


def _unresolved(raw: str, score: float = 0.0) -> MatchResult:
    return MatchResult(raw=raw, category=UNCATEGORIZED, score=score)


class MissingEmbeddingBackend(RuntimeError):
    """CATEGORY_EMBEDDINGS=on but sentence-transformers is not installed."""


class CategoryMatcher:
    """Alias-first category resolver, with optional embedding fallback."""

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        threshold: float = DEFAULT_THRESHOLD,
        categories: tuple[StandardCategory, ...] = STANDARD_CATEGORIES,
        mode: str = EMBEDDINGS_MODE,
    ) -> None:
        self.model_name = model_name
        self.threshold = threshold
        self.categories = categories
        self.mode = mode
        self.alias_index = (
            ALIAS_INDEX if categories is STANDARD_CATEGORIES else _build_alias_index()
        )
        self._model = None
        self._forms: list[str] = []
        self._owner: list[int] = []   # form index -> index into self.categories
        self._matrix = None           # (n_forms, dim), L2-normalised
        self._embeddings_ready = False
        self._embeddings_attempted = False
        self._lock = threading.Lock()

    # -- setup ------------------------------------------------------------- #

    def warm(self) -> None:
        """Prepare the embedding layer, if it is wanted and available.

        Safe to call repeatedly and from multiple threads; only the first call
        does work. Never raises for a missing backend unless the mode is "on",
        because layer 1 alone is a perfectly serviceable matcher.
        """
        if self._embeddings_attempted or self.mode == "off":
            return

        with self._lock:
            if self._embeddings_attempted:
                return
            self._embeddings_attempted = True

            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                if self.mode == "on":
                    raise MissingEmbeddingBackend(
                        "CATEGORY_EMBEDDINGS=on but sentence-transformers is not "
                        "installed; install it or set CATEGORY_EMBEDDINGS=auto"
                    ) from exc
                logger.warning(
                    "sentence-transformers not installed -- category matching is "
                    "alias-only. Unknown labels become Uncategorized; query "
                    "product.raw_category to find aliases worth adding."
                )
                return

            logger.info("Loading category embedding model %s", self.model_name)
            model = SentenceTransformer(self.model_name)

            forms: list[str] = []
            owner: list[int] = []
            for idx, category in enumerate(self.categories):
                seen: set[str] = set()
                for form in category.surface_forms:
                    text = clean(form)
                    key = text.casefold()
                    if not key or key in seen:
                        continue
                    seen.add(key)
                    forms.append(text)
                    owner.append(idx)

            self._matrix = model.encode(
                forms, normalize_embeddings=True, show_progress_bar=False
            )
            self._model = model
            self._forms = forms
            self._owner = owner
            self._embeddings_ready = True
            logger.info(
                "Embedding layer ready: %d categories, %d surface forms",
                len(self.categories), len(forms),
            )

    @property
    def embeddings_ready(self) -> bool:
        return self._embeddings_ready

    # -- matching ---------------------------------------------------------- #

    def match(self, raw: str) -> MatchResult:
        """Resolve one raw category string."""
        return self.match_many([raw])[0]

    def match_many(self, raws: list[str]) -> list[MatchResult]:
        """Batch version -- alias hits are free, misses share one encode call."""
        results: list[MatchResult | None] = [None] * len(raws)
        misses: list[int] = []

        # Layer 1: exact alias lookup.
        for i, raw in enumerate(raws):
            text = clean(raw)
            if not text:
                results[i] = _unresolved(raw)
                continue
            category = self.alias_index.get(text.casefold())
            if category is not None:
                results[i] = MatchResult(
                    raw=raw, category=category, score=ALIAS_SCORE,
                    matched_on=text, method="alias",
                )
            else:
                misses.append(i)

        if not misses:
            return results  # type: ignore[return-value]

        # Layer 2: embeddings, if we have them.
        self.warm()
        if not self._embeddings_ready:
            for i in misses:
                results[i] = _unresolved(raws[i])
            return results  # type: ignore[return-value]

        vectors = self._model.encode(
            [clean(raws[i]) for i in misses],
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        # Both sides are L2-normalised, so the dot product *is* cosine.
        sims = vectors @ self._matrix.T

        for row, i in enumerate(misses):
            best = int(sims[row].argmax())
            score = float(sims[row][best])
            if score >= self.threshold:
                results[i] = MatchResult(
                    raw=raws[i],
                    category=self.categories[self._owner[best]],
                    score=score,
                    matched_on=self._forms[best],
                    method="embedding",
                )
            else:
                results[i] = _unresolved(raws[i], score)

        return results  # type: ignore[return-value]

    def top_k(self, raw: str, k: int = 5) -> list[tuple[StandardCategory, float, str]]:
        """The k closest categories -- for inspecting near misses and tuning.

        Embedding-only; returns [] when the embedding layer is unavailable.
        """
        self.warm()
        text = clean(raw)
        if not text or not self._embeddings_ready:
            return []

        vector = self._model.encode([text], normalize_embeddings=True)[0]
        sims = vector @ self._matrix.T

        best: dict[int, tuple[float, str]] = {}
        for form_idx, score in enumerate(sims):
            idx = self._owner[form_idx]
            if float(score) > best.get(idx, (-1.0, ""))[0]:
                best[idx] = (float(score), self._forms[form_idx])

        ranked = sorted(best.items(), key=lambda kv: kv[1][0], reverse=True)
        return [(self.categories[i], s, f) for i, (s, f) in ranked[:k]]


# --------------------------------------------------------------------------- #
# Process-wide singleton
# --------------------------------------------------------------------------- #

_matcher: CategoryMatcher | None = None
_matcher_lock = threading.Lock()


def get_matcher() -> CategoryMatcher:
    """The shared matcher -- alias index and model load once per process."""
    global _matcher
    if _matcher is None:
        with _matcher_lock:
            if _matcher is None:
                _matcher = CategoryMatcher()
    return _matcher


def warm_matcher() -> None:
    """Prepare the matcher before consumer threads start.

    A no-op when embeddings are unavailable or disabled -- layer 1 needs no
    warming. Raises only when CATEGORY_EMBEDDINGS=on and the backend is absent,
    so a deployment that explicitly requires the model fails loudly at boot.
    """
    get_matcher().warm()


@lru_cache(maxsize=4096)
def match_category(raw: str) -> MatchResult:
    """Resolve a raw category string to a standard category.

    Cached: across millions of products there are only a few hundred distinct
    raw category values, so this is a near-100% hit rate in steady state.

    Never raises. A failure here would kill the consumer thread for an entire
    shop, so problems degrade to Uncategorized -- the raw string is kept on the
    product, and Kafka can be replayed once the cause is fixed.
    """
    try:
        return get_matcher().match(raw)
    except Exception:
        logger.exception("Category matching failed for %r", raw)
        return _unresolved(raw)
