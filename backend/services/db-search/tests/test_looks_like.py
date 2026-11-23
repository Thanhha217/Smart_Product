import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from co2_queries import looks_like  # noqa: E402  (pure function; importing needs no database)


def test_accessories_and_wrong_category_are_rejected():
    assert not looks_like("Giá treo màn hình HyperWork T9", "computer_monitor")
    assert not looks_like("Máy tính bảng Lenovo Idea Tab", "smartphone")
    assert looks_like("Màn hình Aoc 27B36XE/71 27 inch", "computer_monitor")
    assert looks_like("Điện thoại Samsung Galaxy A18", "smartphone")
    assert looks_like("Tai nghe Logitech G325", "headphone")
    assert looks_like("Something", "networking")  # categories without a word list are not filtered
