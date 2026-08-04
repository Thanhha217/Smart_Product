"""Tests for the standard taxonomy and the category matcher.

Two tiers, mirroring the matcher's two layers:

* Everything except TestEmbeddingMatching runs with only pytest installed. That
  includes the full spider-value table -- every label the spiders emit is an
  exact taxonomy alias, so layer 1 resolves it with no model involved.
* TestEmbeddingMatching exercises layer 2 (the optional embedding fallback) and
  skips automatically when sentence-transformers is not installed.

    pytest tests/                        # everything available
    pytest tests/ -m "not model"         # fast tier only
"""

from __future__ import annotations

import pytest

from taxonomy.categories import (
    BY_SLUG,
    FUTURE,
    LIVE,
    PARTIAL,
    STANDARD_CATEGORIES,
    UNCATEGORIZED,
)
from taxonomy.matcher import (
    ALIAS_INDEX,
    CategoryMatcher,
    MatchResult,
    MissingEmbeddingBackend,
    clean,
    match_category,
)

# Raw category values the spiders actually emit today, mapped to the slug each
# one has to resolve to. Sourced from the spiders themselves -- if a spider
# starts emitting a new label, add it here first and watch this test fail.
SPIDER_CATEGORY_EXPECTATIONS = [
    # dienmayxanh/listing.py + tgdd/listing.py -- Vietnamese display names
    ("Điện thoại", "smartphones"),
    ("Laptop", "laptops"),
    ("Tai nghe", "headphones"),
    ("Màn hình máy tính", "monitors"),
    ("Máy tính bảng", "tablets"),
    ("Đồng hồ thông minh", "smartwatches"),
    ("Loa", "speakers"),
    ("Tivi", "televisions"),
    ("Máy lạnh", "air_conditioners"),
    ("Tủ lạnh", "refrigerators"),
    ("Máy giặt", "washing_machines"),
    ("Nồi cơm điện", "rice_cookers"),
    ("Quạt", "electric_fans"),
    ("Máy lọc không khí", "air_purifiers"),
    ("Robot hút bụi", "vacuum_cleaners"),
    ("Chuột", "computer_peripherals"),
    ("Bàn phím", "computer_peripherals"),
    ("Máy tính để bàn", "desktops"),
    ("Sạc dự phòng", "phone_accessories"),
    ("USB", "pc_components"),
    # cellphoneS/spider.py + phongvu/spider.py -- English slugs
    ("smartphone", "smartphones"),
    ("laptop", "laptops"),
    ("earphone", "headphones"),
    ("computer_monitor", "monitors"),
    ("tablet", "tablets"),
    ("smartwatch", "smartwatches"),
    ("speaker", "speakers"),
    ("mouse", "computer_peripherals"),
    ("power_bank", "phone_accessories"),
    ("keyboard", "computer_peripherals"),
    ("desktop", "desktops"),
    # fpt_shop/spider.py -- hyphenated slugs
    ("dien-thoai", "smartphones"),
    ("may-tinh-xach-tay", "laptops"),
    ("may-tinh-bang", "tablets"),
    ("man-hinh", "monitors"),
    ("may-tinh-de-ban", "desktops"),
    ("may-in", "computer_peripherals"),
]

# Real labels that are NOT aliases, so they can only resolve through the
# embedding layer. Keep these free of any exact surface form -- if one becomes
# an alias, TestEmbeddingMatching stops testing what it claims to.
UNSEEN_EXPECTATIONS = [
    ("Card màn hình RTX 4070", "pc_components"),
    ("nồi chiên không dầu Philips", "rice_cookers"),
    ("tai nghe chụp tai", "headphones"),
    ("máy giặt cửa trước", "washing_machines"),
]

# Strings that must NOT be forced onto a category.
JUNK_VALUES = ["asdfghjkl", "qqqq", "12345", "...", "zzzzzzz"]


# --------------------------------------------------------------------------- #
# Taxonomy integrity -- no model needed
# --------------------------------------------------------------------------- #

class TestTaxonomy:

    def test_slugs_are_unique(self):
        slugs = [c.slug for c in STANDARD_CATEGORIES]
        duplicates = {s for s in slugs if slugs.count(s) > 1}
        assert not duplicates, f"duplicate slugs: {duplicates}"

    def test_every_category_is_populated(self):
        for category in STANDARD_CATEGORIES:
            assert category.slug, "slug must not be empty"
            assert category.name_en, f"{category.slug}: name_en must not be empty"
            assert category.name_vi, f"{category.slug}: name_vi must not be empty"
            assert category.department, f"{category.slug}: department must not be empty"

    def test_status_values_are_valid(self):
        for category in STANDARD_CATEGORIES:
            assert category.status in (LIVE, PARTIAL, FUTURE), (
                f"{category.slug} has unknown status {category.status!r}"
            )

    def test_slugs_are_db_safe(self):
        # Slugs are stored and deduped on, so keep them boring.
        for category in STANDARD_CATEGORIES:
            assert category.slug.islower(), f"{category.slug} must be lowercase"
            assert " " not in category.slug, f"{category.slug} must not contain spaces"
            assert category.slug.replace("_", "").isalnum(), (
                f"{category.slug} must be alphanumeric plus underscores"
            )

    def test_no_alias_is_claimed_by_two_categories(self):
        # An alias owned by two categories makes the winner arbitrary, since
        # both get an identical vector.
        owners: dict[str, set[str]] = {}
        for category in STANDARD_CATEGORIES:
            for form in category.surface_forms:
                owners.setdefault(clean(form).casefold(), set()).add(category.slug)

        conflicts = {f: sorted(s) for f, s in owners.items() if len(s) > 1}
        assert not conflicts, f"aliases claimed by multiple categories: {conflicts}"

    def test_no_category_repeats_a_surface_form(self):
        # Harmless at runtime -- warm() dedupes -- but a repeat is always a
        # copy/paste slip, and one of them is usually meant to be something else.
        for category in STANDARD_CATEGORIES:
            forms = [clean(f).casefold() for f in category.surface_forms]
            repeats = {f for f in forms if forms.count(f) > 1}
            assert not repeats, f"{category.slug} repeats {repeats}"

    def test_uncategorized_is_not_a_real_category(self):
        # It must be reachable by slug but never a match candidate.
        assert UNCATEGORIZED not in STANDARD_CATEGORIES
        assert BY_SLUG["uncategorized"] is UNCATEGORIZED

    def test_every_expected_slug_exists(self):
        # Guards the expectation table below against typos.
        for raw, slug in SPIDER_CATEGORY_EXPECTATIONS:
            assert slug in BY_SLUG, f"{raw!r} expects unknown slug {slug!r}"


# --------------------------------------------------------------------------- #
# String cleaning -- no model needed
# --------------------------------------------------------------------------- #

class TestClean:

    @pytest.mark.parametrize("raw,expected", [
        ("computer_monitor", "computer monitor"),
        ("may-tinh-xach-tay", "may tinh xach tay"),
        ("Điện thoại > Samsung", "Điện thoại Samsung"),
        ("Laptop/Gaming", "Laptop Gaming"),
        ("  Tai   nghe  ", "Tai nghe"),
        ("Tivi", "Tivi"),
    ])
    def test_separators_and_whitespace(self, raw, expected):
        assert clean(raw) == expected

    def test_diacritics_are_preserved(self):
        # The model reads Vietnamese; stripping accents would lose signal.
        assert clean("Điện thoại") == "Điện thoại"
        assert "ệ" in clean("Điện thoại")

    @pytest.mark.parametrize("raw", ["", "   ", None, "---", ">>>"])
    def test_empty_inputs_collapse_to_empty(self, raw):
        assert clean(raw) == ""


# --------------------------------------------------------------------------- #
# Failure handling -- no model needed
# --------------------------------------------------------------------------- #

class TestFailureHandling:

    @pytest.fixture(autouse=True)
    def _clear_cache(self):
        match_category.cache_clear()
        yield
        match_category.cache_clear()

    def test_matching_never_raises(self, monkeypatch):
        # A raising matcher must not kill the consumer thread for a whole shop.
        def boom():
            raise RuntimeError("model gone")

        monkeypatch.setattr("taxonomy.matcher.get_matcher", boom)

        result = match_category("Điện thoại")
        assert result.slug == "uncategorized"
        assert not result.is_confident

    def test_unresolved_result_is_falsy(self):
        result = MatchResult(raw="x", category=UNCATEGORIZED, score=0.1)
        assert not result
        assert not result.is_confident
        assert result.slug == "uncategorized"

    def test_confident_result_is_truthy(self):
        result = MatchResult(raw="Laptop", category=BY_SLUG["laptops"], score=0.99)
        assert result
        assert result.is_confident
        assert result.name_en == "Laptops"
        assert result.department == "Electronics & Tech"

    def test_embeddings_are_not_ready_before_warm(self):
        assert CategoryMatcher().embeddings_ready is False

    def test_off_mode_never_touches_the_backend(self):
        # warm() must be a cheap no-op so alias-only deployments pay nothing.
        matcher = CategoryMatcher(mode="off")
        matcher.warm()
        assert matcher.embeddings_ready is False
        assert matcher.match("Laptop").slug == "laptops"

    def test_on_mode_fails_loudly_when_backend_is_missing(self, monkeypatch):
        # A deployment that explicitly requires embeddings must not silently
        # degrade to alias-only.
        import builtins

        real_import = builtins.__import__

        def no_sentence_transformers(name, *args, **kwargs):
            if name.startswith("sentence_transformers"):
                raise ImportError("not installed")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", no_sentence_transformers)

        with pytest.raises(MissingEmbeddingBackend):
            CategoryMatcher(mode="on").warm()


# --------------------------------------------------------------------------- #
# Layer 1: exact alias matching -- no model needed
# --------------------------------------------------------------------------- #

class TestAliasMatching:
    """Every value the spiders emit must resolve without the embedding model.

    This is the contract that lets the worker ship without torch. If a spider
    introduces a label that is not an alias, these fail and the fix is to add
    the alias -- not to rely on the optional embedding fallback.
    """

    @staticmethod
    @pytest.fixture(scope="class")
    def matcher():
        return CategoryMatcher(mode="off")

    @pytest.mark.parametrize("raw,expected_slug", SPIDER_CATEGORY_EXPECTATIONS)
    def test_spider_values_resolve_via_alias(self, matcher, raw, expected_slug):
        result = matcher.match(raw)
        assert result.slug == expected_slug, (
            f"{raw!r} -> {result.slug!r}, expected {expected_slug!r}"
        )
        assert result.method == "alias", (
            f"{raw!r} needed the embedding fallback; add it as an alias"
        )
        assert result.score == 1.0

    def test_the_same_product_type_unifies_across_sources(self, matcher):
        # The entire point: TGDD, CellphoneS and FPT must agree on one row.
        slugs = {matcher.match(r).slug for r in ("Điện thoại", "smartphone", "dien-thoai")}
        assert slugs == {"smartphones"}

    def test_matching_is_case_and_separator_insensitive(self, matcher):
        for raw in ("LAPTOP", "laptop", "Laptop", "  laptop  "):
            assert matcher.match(raw).slug == "laptops"

    @pytest.mark.parametrize("raw", JUNK_VALUES)
    def test_junk_is_uncategorized_without_the_model(self, matcher, raw):
        result = matcher.match(raw)
        assert not result.is_confident
        assert result.method == "none"

    def test_unknown_labels_degrade_rather_than_guess(self, matcher):
        # Alias-only cannot resolve this; it must not invent an answer.
        result = matcher.match("Card màn hình RTX 4070")
        assert result.slug == "uncategorized"
        assert result.method == "none"

    def test_empty_input_resolves_to_uncategorized(self, matcher):
        assert matcher.match("").slug == "uncategorized"
        assert matcher.match("   ").slug == "uncategorized"

    def test_alias_index_covers_every_category(self):
        assert {c.slug for c in ALIAS_INDEX.values()} == {
            c.slug for c in STANDARD_CATEGORIES
        }

    @pytest.mark.parametrize("raw,_slug", UNSEEN_EXPECTATIONS)
    def test_unseen_fixtures_really_are_unseen(self, raw, _slug):
        # Guards the embedding tier: if one of its fixtures ever becomes an
        # exact alias it would silently stop testing the model at all.
        assert clean(raw).casefold() not in ALIAS_INDEX, (
            f"{raw!r} is now an alias -- pick a different embedding fixture"
        )

    def test_batch_matches_single(self, matcher):
        raws = [raw for raw, _ in SPIDER_CATEGORY_EXPECTATIONS]
        assert [r.slug for r in matcher.match_many(raws)] == [
            matcher.match(raw).slug for raw in raws
        ]


# --------------------------------------------------------------------------- #
# Pipeline integration -- no model needed, matcher is stubbed
# --------------------------------------------------------------------------- #

class TestParserIntegration:

    # parse_product_data drops anything with no price at all, so every payload
    # here has to carry one or it never reaches the category code.
    PRICED = {"original_price": 100.0, "final_price": 90.0}

    def _stub(self, monkeypatch, result_for):
        from data.process import data_parser

        # data_parser binds match_category at import, so patch it there.
        monkeypatch.setattr(data_parser, "match_category", result_for)
        return data_parser

    def test_parsed_category_uses_taxonomy_fields(self, monkeypatch):
        data_parser = self._stub(
            monkeypatch,
            lambda raw: MatchResult(raw, BY_SLUG["smartphones"], 0.98, "Điện thoại"),
        )

        parsed = data_parser.parse_product_data({
            **self.PRICED,
            "category": "Điện thoại",
            "name": "iPhone 15",
            "url": "https://example.com/p/1",
        })

        category = parsed["category"]
        assert category.slug == "smartphones"
        assert category.name == "Smartphones"
        assert category.name_vi == "Điện thoại di động"
        assert category.department == "Electronics & Tech"

    def test_raw_category_is_kept_on_the_product(self, monkeypatch):
        # Without this the original label is unrecoverable and a bad mapping
        # can only be audited by replaying Kafka.
        data_parser = self._stub(
            monkeypatch,
            lambda raw: MatchResult(raw, BY_SLUG["monitors"], 0.91, "man hinh"),
        )

        parsed = data_parser.parse_product_data({**self.PRICED, "category": "man-hinh"})
        assert parsed["product"].raw_category == "man-hinh"

    def test_missing_category_is_handled(self, monkeypatch):
        data_parser = self._stub(
            monkeypatch, lambda raw: MatchResult(raw, UNCATEGORIZED, 0.0)
        )

        parsed = data_parser.parse_product_data({**self.PRICED, "name": "mystery item"})
        assert parsed["category"].slug == "uncategorized"
        assert parsed["product"].raw_category == ""

    def test_priceless_products_never_reach_the_matcher(self, monkeypatch):
        # The price guard runs first, so dropped messages cost no embedding
        # work. If that ordering is ever reversed this catches it.
        calls = []

        def spy(raw):
            calls.append(raw)
            return MatchResult(raw, UNCATEGORIZED, 0.0)

        data_parser = self._stub(monkeypatch, spy)

        assert data_parser.parse_product_data({"category": "Laptop"}) is None
        assert calls == []


# --------------------------------------------------------------------------- #
# The real thing -- loads the model
# --------------------------------------------------------------------------- #

@pytest.mark.model
class TestEmbeddingMatching:
    """Layer 2 only -- the cases the alias index cannot handle.

    Anything already covered by TestAliasMatching is deliberately not repeated
    here: those strings never reach the model.
    """

    @staticmethod
    @pytest.fixture(scope="class")
    def matcher():
        pytest.importorskip(
            "sentence_transformers",
            reason="uncomment sentence-transformers in requirements.txt to run these",
        )
        m = CategoryMatcher(mode="on")
        m.warm()
        return m

    @pytest.mark.parametrize("raw,expected_slug", UNSEEN_EXPECTATIONS)
    def test_correct_category_is_among_the_suggestions(self, matcher, raw, expected_slug):
        # top_k is the supported interface: ranked candidates for a human to
        # review into aliases. The top hit is not always right (see
        # test_auto_apply_is_unsafe), but the right answer should be in reach.
        suggestions = [c.slug for c, _, _ in matcher.top_k(raw, k=3)]
        assert expected_slug in suggestions, (
            f"{raw!r} suggested {suggestions}, expected {expected_slug!r} among them"
        )

    def test_aliases_still_win_without_touching_the_model(self, matcher):
        # Layer 1 must take precedence even when layer 2 is available, so the
        # common path stays free.
        result = matcher.match("Điện thoại")
        assert result.method == "alias"
        assert result.score == 1.0

    def test_auto_apply_is_unsafe(self, matcher):
        """Characterisation test: junk outscores genuine labels.

        This is the measured reason CATEGORY_EMBEDDINGS defaults to off. With
        paraphrase-multilingual-MiniLM-L12-v2, '!!!!' scores ~0.82 against
        "tui xach" while a real label like 'nồi chiên không dầu Philips' scores
        ~0.74 -- so no threshold separates them and auto-assignment would
        confidently mislabel products.

        If a future model or alias cleanup fixes this, THIS TEST FAILS. That is
        the signal to revisit enabling auto-apply -- do not just delete it.
        """
        worst_real = min(matcher.match(raw).score for raw, _ in UNSEEN_EXPECTATIONS)
        best_junk = max(matcher.match(raw).score for raw in JUNK_VALUES)

        assert best_junk >= worst_real, (
            f"junk now scores {best_junk:.3f} vs weakest real {worst_real:.3f} -- "
            f"the model finally separates them; reconsider CATEGORY_EMBEDDINGS=auto "
            f"with a threshold in ({best_junk:.3f}, {worst_real:.3f}]"
        )

    def test_short_aliases_are_the_attractors(self, matcher):
        # Documents the mechanism: degenerate input latches onto very short
        # aliases. Worth knowing before adding more of them. Uses top_k because
        # match() reports no winner once a score falls below the threshold.
        winners = [matcher.top_k(raw, k=1)[0][2] for raw in JUNK_VALUES]
        assert any(0 < len(w) <= 5 for w in winners), (
            f"expected short aliases to attract junk, got {winners}"
        )

    def test_batch_matches_single(self, matcher):
        # Mixed alias hits and embedding misses must batch correctly.
        raws = [raw for raw, _ in SPIDER_CATEGORY_EXPECTATIONS[:6]]
        raws += [raw for raw, _ in UNSEEN_EXPECTATIONS]
        assert [r.slug for r in matcher.match_many(raws)] == [
            matcher.match(raw).slug for raw in raws
        ]

    def test_top_k_is_ranked_and_deduplicated(self, matcher):
        ranked = matcher.top_k("Điện thoại", k=5)
        assert len(ranked) == 5
        assert ranked[0][0].slug == "smartphones"

        scores = [score for _, score, _ in ranked]
        assert scores == sorted(scores, reverse=True)

        slugs = [c.slug for c, _, _ in ranked]
        assert len(slugs) == len(set(slugs)), "top_k returned a category twice"

    def test_top_k_is_empty_without_embeddings(self):
        assert CategoryMatcher(mode="off").top_k("Điện thoại") == []
