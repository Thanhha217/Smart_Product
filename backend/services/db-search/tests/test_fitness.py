"""A greener alternative must still do the job the shopper came for."""
from fitness import fits_instead_of, is_entry_level, is_gaming, ram_gb, screen_inch

GAMING = "Laptop Gaming MSI Katana 15 B13VFK RTX 4060 16GB/512GB 15.6 inch"
OFFICE = "Laptop HP 240 G9 i5 1235U 16GB/512GB 14 inch"
CELERON = "Laptop Masstel E140 Celeron N4020 4GB/128GB 14 inch"


def test_reads_what_the_name_says():
    assert is_gaming(GAMING) and not is_gaming(OFFICE)
    assert is_entry_level(CELERON) and not is_entry_level(OFFICE)
    assert ram_gb(GAMING) == 16 and ram_gb(CELERON) == 4
    assert screen_inch(GAMING) == 15.6 and screen_inch(OFFICE) == 14.0
    assert ram_gb("Tai nghe Logitech H111") is None
    assert screen_inch("Chuột không dây") is None


def test_an_office_laptop_does_not_replace_a_gaming_one():
    assert not fits_instead_of(OFFICE, GAMING)
    assert fits_instead_of("Laptop Gaming Acer Nitro V 16GB/512GB 15.6 inch", GAMING)


def test_an_entry_chip_does_not_replace_a_working_machine():
    assert not fits_instead_of(CELERON, OFFICE)
    assert fits_instead_of(CELERON, "Laptop Celeron N4000 4GB/128GB 14 inch")


def test_less_memory_or_a_much_smaller_screen_is_a_downgrade():
    assert not fits_instead_of("Laptop HP 240 G9 8GB/256GB 14 inch", OFFICE)
    assert not fits_instead_of("Laptop Dell 16GB/512GB 11 inch", OFFICE)
    assert fits_instead_of("Laptop Dell 16GB/512GB 13.3 inch", OFFICE)


def test_missing_signals_keep_the_candidate():
    assert fits_instead_of("Tai nghe Sony WH-1000XM5", "Tai nghe Bose QC45")
    assert fits_instead_of(None, OFFICE)
