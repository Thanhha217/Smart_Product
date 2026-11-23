import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from product_specs import brand_of, condition_of, specs_of  # noqa: E402


def keys(specs):
    return {s["key"]: s["value"] for s in specs}


def test_laptop_specs():
    s = keys(specs_of("Laptop Dell Inspiron 15 3530 i5 1334U 16GB/512GB 15.6 inch", "laptops"))
    assert s["ram"] == "16 GB" and s["storage"] == "512 GB" and s["screen"] == '15.6"' and s["cpu"].startswith("I5")


def test_monitor_specs():
    s = keys(specs_of("Màn hình Gaming MSI PRO MP275Q-E14 (27 inch, WQHD, IPS, 144Hz, 4ms)", "monitors"))
    assert s == {"screen": '27"', "resolution": "WQHD", "refresh": "144 Hz", "panel": "IPS"}


def test_phone_and_headphone_and_watch():
    assert keys(specs_of("Điện thoại Samsung Galaxy A17 8GB/128GB", "smartphones")) == {"ram": "8 GB", "storage": "128 GB"}
    assert keys(specs_of("Tai nghe Bluetooth True Wireless Xiaomi Buds 5", "headphones"))["connectivity"] == "wireless"
    assert keys(specs_of("Apple Watch Series 11 GPS + Cellular 42mm", "smartwatches")) == {"size": "42 mm", "connectivity": "cellular"}


def test_nothing_invented():
    assert specs_of("Laptop Acer", "laptops") == []
    assert specs_of(None, None) == []


def test_brand_and_condition():
    assert brand_of("Laptop HP Gaming OMEN 16") == "HP"
    assert brand_of("Máy tính bảng không tên") is None
    assert condition_of("Laptop Dell 16 DC16250 - Đã Kích Hoạt") == "used"
    assert condition_of("Laptop Dell Inspiron mới 100%") is None


def test_brand_aliases_and_ram_without_slash():
    assert brand_of("Điện thoại iPhone 15 128GB") == "Apple"
    assert brand_of("Galaxy Tab S9") == "Samsung"
    assert keys(specs_of("Samsung Galaxy A17 8GB 128GB", "smartphones")) == {"ram": "8 GB", "storage": "128 GB"}
