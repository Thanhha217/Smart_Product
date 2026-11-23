import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def test_accessory_titles(monkeypatch):
    import types
    # search_api imports sqlmodel; stub it so the pure helper can be tested without the DB driver
    sys.modules.setdefault("sqlmodel", types.SimpleNamespace(Session=None, text=None))
    sys.modules.setdefault("green_score", types.SimpleNamespace(green_score=None, parse_references=None))
    import search_api
    assert search_api.is_accessory("Dán màn hình Laptop 13 inch Zeelot")
    assert search_api.is_accessory("Balo laptop Dell 15.6")
    assert search_api.is_accessory("Chuột không dây Logitech M240")
    assert search_api.is_accessory("RAM Laptop Lexar 8GB 3200MHZ DDR4")
    assert search_api.is_accessory("Ổ cứng SSD Samsung 990 Pro 1TB")
    assert not search_api.is_accessory("Laptop Dell Inspiron 15 3530")
    assert not search_api.is_accessory("Điện thoại Samsung Galaxy A17 sạc nhanh 25W")
