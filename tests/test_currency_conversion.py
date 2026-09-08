import sys
from pathlib import Path
import asyncio

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.services.currency_service import CurrencyService
from backend.database.models import PartResult
from backend.database.db import (
    init_db,
    create_or_update_excel_catalog,
    delete_excel_catalog
)
from backend.scrapers.manager import ScraperManager

async def test_currency_service():
    info = await CurrencyService.get_dolar_blue_info()
    rate = await CurrencyService.get_rate()
    assert rate > 500, f"Expected reasonable dollar rate, got {rate}"
    assert "venta" in info
    assert "compra" in info
    print(f"  Live Dolar Blue rate: Venta ${info['venta']} / Compra ${info['compra']} ({info['fuente']})")

    # Probar cotización personalizada
    CurrencyService.set_custom_rate(1650.0)
    assert await CurrencyService.get_rate() == 1650.0
    
    # Restablecer automática
    CurrencyService.set_custom_rate(None)
    assert await CurrencyService.get_rate() == rate
    print("  Custom rate override OK!")

async def test_search_conversion_with_usd_catalog():
    init_db()
    cat_id = "excel_test_usd_supplier"
    
    # Catálogo cotizado en dólares
    usd_items = [
        {
            "sku": "USD-MOD-IPH13",
            "description": "Modulo Pantalla OLED iPhone 13 Original en Dolares",
            "brand": "Apple",
            "price": 50.0,  # 50 USD
            "currency": "USD",
            "stock": "Disponible",
            "has_stock": True,
            "raw_row": 2
        }
    ]

    create_or_update_excel_catalog(
        catalog_id=cat_id,
        name="Importador Miami Directo",
        filename="lista_usd.xlsx",
        currency="USD",
        items=usd_items
    )

    # Fijar cotización conocida para probar el cálculo exacto
    test_blue = 1500.0
    CurrencyService.set_custom_rate(test_blue)

    try:
        resp = await ScraperManager.search_all("modulo iphone 13", target_distributors=[cat_id])
        assert resp.total_results >= 1
        item = resp.results[0]
        
        # Verificar que el precio ahora esté convertido a ARS: 50 * 1500 = 75000 ARS
        assert item.price == 75000.0, f"Expected 75000.0, got {item.price}"
        assert item.currency == "ARS"
        assert item.original_price == 50.0
        assert item.original_currency == "USD"
        assert item.exchange_rate_used == 1500.0
        assert resp.dolar_blue_rate == 1500.0
        print(f"  USD conversion test passed: U$D {item.original_price} -> ${item.price} ARS (@ {item.exchange_rate_used})")

    finally:
        CurrencyService.set_custom_rate(None)
        delete_excel_catalog(cat_id)

if __name__ == "__main__":
    print("[1/2] Testing CurrencyService live API...")
    asyncio.run(test_currency_service())
    print("[2/2] Testing USD to ARS conversion in search...")
    asyncio.run(test_search_conversion_with_usd_catalog())
    print("ALL CURRENCY CONVERSION TESTS PASSED SUCCESSFULLY!")
