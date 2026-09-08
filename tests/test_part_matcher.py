import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.database.models import PartResult
from backend.services.part_matcher import PartMatcher

def test_part_matcher_relevance():
    query = "modulo iphone 12"

    good_item = PartResult(
        distributor_id="soulfix",
        distributor_name="SoulFix",
        sku="SF-001",
        description="Modulo Pantalla – iPhone 12 / 12 Pro – JK – Sin IC – Incell",
        brand="Apple",
        price=44602.0,
        currency="ARS",
        stock="En stock",
        has_stock=True,
        scraped_at="2026-09-08 20:00"
    )

    bad_lens_protector = PartResult(
        distributor_id="smartsupply",
        distributor_name="Smart Supply",
        sku="SS-002",
        description="PROTECTOR DE LENTE PARA IPHONE METALICO",
        brand="Smart Supply",
        price=846.13,
        currency="ARS",
        stock="Disponible",
        has_stock=True,
        scraped_at="2026-09-08 20:00"
    )

    bad_moto_screen = PartResult(
        distributor_id="smartsupply",
        distributor_name="Smart Supply",
        sku="SS-003",
        description="MODULO PARA MOTO SIGNATURE 5G",
        brand="Motorola",
        price=32000.0,
        currency="ARS",
        stock="Disponible",
        has_stock=True,
        scraped_at="2026-09-08 20:00"
    )

    bad_iphone13_screen = PartResult(
        distributor_id="excel_cellstore",
        distributor_name="CellStore",
        sku="EX-751231",
        description="MODULO IPHONE 13 PRO INCELL",
        brand="Apple",
        price=50000.0,
        currency="ARS",
        stock="Disponible",
        has_stock=True,
        scraped_at="2026-09-08 20:00"
    )

    zero_price_item = PartResult(
        distributor_id="smartsupply",
        distributor_name="Smart Supply",
        sku="SS-005",
        description="MODULO IPHONE 12 ORIGINAL",
        brand="Apple",
        price=0.0,
        currency="ARS",
        stock="Disponible",
        has_stock=True,
        scraped_at="2026-09-08 20:00"
    )

    # 1. Buen módulo debe ser aceptado
    valid_good, score_good = PartMatcher.evaluate_relevance(good_item, query)
    assert valid_good is True, f"Good item should be valid, got {valid_good}"
    assert score_good > 70.0, f"Score should be high, got {score_good}"
    print(f"[OK] Good iPhone 12 module accepted with score {score_good}")

    # 2. Protector de lente debe ser rechazado
    valid_lens, _ = PartMatcher.evaluate_relevance(bad_lens_protector, query)
    assert valid_lens is False, "Lens protector must be rejected when searching for 'modulo'"
    print("[OK] Lens protector successfully rejected")

    # 3. Pantalla de Motorola debe ser rechazada para búsqueda de iPhone
    valid_moto, _ = PartMatcher.evaluate_relevance(bad_moto_screen, query)
    assert valid_moto is False, "Motorola screen must be rejected when searching for 'iphone'"
    print("[OK] Motorola screen successfully rejected for iPhone query")

    # 4. Pantalla de iPhone 13 debe ser rechazada cuando se busca iPhone 12
    valid_ip13, _ = PartMatcher.evaluate_relevance(bad_iphone13_screen, query)
    assert valid_ip13 is False, "iPhone 13 screen must be rejected when searching for 'iphone 12'"
    print("[OK] iPhone 13 screen successfully rejected for iPhone 12 query")

    # 5. Precio 0 debe ser rechazado
    valid_zero, _ = PartMatcher.evaluate_relevance(zero_price_item, query)
    assert valid_zero is False, "Zero price item must be rejected"
    print("[OK] Zero price item successfully rejected")

    # 6. Probar ordenamiento y filtrado de lista completa
    all_test_items = [bad_lens_protector, bad_moto_screen, bad_iphone13_screen, zero_price_item, good_item]
    ranked = PartMatcher.filter_and_rank_results(all_test_items, query)
    assert len(ranked) == 1, f"Expected exactly 1 valid item, got {len(ranked)}"
    assert ranked[0].description == good_item.description
    print("[OK] filter_and_rank_results returned exclusively the valid module")

if __name__ == "__main__":
    print("Testing PartMatcher precision and filtering...")
    test_part_matcher_relevance()
    print("\nALL PART MATCHER TESTS PASSED SUCCESSFULLY!")
