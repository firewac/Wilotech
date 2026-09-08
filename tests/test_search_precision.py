import unittest
from backend.database.models import PartResult
from backend.services.search_filter import (
    parse_query_intent,
    evaluate_part_relevance,
    filter_and_rank_parts
)

class TestSearchPrecision(unittest.TestCase):
    def test_query_intent_parsing(self):
        intent = parse_query_intent("modulo iphone 14")
        self.assertEqual(intent.category, "modulo")
        self.assertEqual(intent.brand, "apple")
        self.assertEqual(intent.model_number, "14")
        self.assertEqual(intent.variants, [])

        intent_pro = parse_query_intent("modulo iphone 14 pro max")
        self.assertEqual(intent_pro.category, "modulo")
        self.assertEqual(intent_pro.brand, "apple")
        self.assertTrue("pro" in intent_pro.variants)
        self.assertTrue("pro max" in intent_pro.variants)

        intent_bat = parse_query_intent("bateria iphone 11")
        self.assertEqual(intent_bat.category, "bateria")
        self.assertEqual(intent_bat.brand, "apple")
        self.assertEqual(intent_bat.model_number, "11")

        intent_pin = parse_query_intent("pin de carga moto g22")
        self.assertEqual(intent_pin.category, "pin_carga")
        self.assertEqual(intent_pin.brand, "motorola")
        self.assertEqual(intent_pin.model_number, "g22")

    def test_filter_modulo_iphone_14(self):
        # Muestra con productos ruidosos reales devueltos por el scraper viejo
        raw_items = [
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-01", description="PROTECTOR DE LENTE PARA IPHONE METALICO",
                brand="iPhone", price=846.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-02", description="TAPA PARA SAMSUNG A25",
                brand="Samsung", price=5500.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-03", description="MODULO PARA TCL PRONXT 70 PRO 5G",
                brand="TCL", price=32000.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-04", description="MODULO PARA IPHONE 14 HARD IC REMOVIBLE",
                brand="iPhone", price=114893.13, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-05", description="MODULO PARA IPHONE 14 PRO PROGRAMADO MS INCELL FHD",
                brand="iPhone", price=91884.50, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-06", description="MODULO PARA IPHONE 11 INCELL",
                brand="iPhone", price=35000.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ga", distributor_name="Grupo Armar",
                sku="GA-01", description="MODULO IPHONE 14 AMM IC REMOVIBLE MECANICO",
                brand="iPhone", price=110000.0, scraped_at="2026-09-08"
            )
        ]

        filtered, discarded = filter_and_rank_parts("modulo iphone 14", raw_items, strict=True)
        
        # Deben haber sido descartados:
        # - Protector de lente ($846)
        # - Tapa Samsung A25 ($5500)
        # - Módulo TCL ($32000)
        # - Módulo iPhone 11 ($35000)
        self.assertEqual(discarded, 4)
        self.assertEqual(len(filtered), 3)

        # Los 3 restantes deben ser módulos de iPhone 14
        descriptions = [p.description for p in filtered]
        self.assertIn("MODULO PARA IPHONE 14 HARD IC REMOVIBLE", descriptions)
        self.assertIn("MODULO IPHONE 14 AMM IC REMOVIBLE MECANICO", descriptions)
        self.assertIn("MODULO PARA IPHONE 14 PRO PROGRAMADO MS INCELL FHD", descriptions)

        # El primero debe ser un modelo base exacto de iPhone 14
        self.assertEqual(filtered[0].match_tier, "exact")
        self.assertEqual(filtered[0].description, "MODULO IPHONE 14 AMM IC REMOVIBLE MECANICO") # menor precio entre los base

    def test_filter_bateria_iphone_11(self):
        raw_items = [
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-10", description="BATERIA PARA IPHONE 11 BASICA ZANI",
                brand="iPhone", price=18000.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-11", description="MODULO PARA IPHONE 11 OLED",
                brand="iPhone", price=45000.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-12", description="TAG ON BATERIA JC PARA IPHONE 11",
                brand="iPhone", price=4000.0, scraped_at="2026-09-08"
            ),
            PartResult(
                distributor_id="ss", distributor_name="Smart Supply",
                sku="SS-13", description="BATERIA PARA SAMSUNG A52",
                brand="Samsung", price=16000.0, scraped_at="2026-09-08"
            )
        ]

        filtered, discarded = filter_and_rank_parts("bateria iphone 11", raw_items, strict=True)
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].description, "BATERIA PARA IPHONE 11 BASICA ZANI")

if __name__ == "__main__":
    unittest.main()
