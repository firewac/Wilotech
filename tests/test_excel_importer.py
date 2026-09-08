import io
import sys
from pathlib import Path
import asyncio
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.parsers.excel_parser import parse_price_list_file, parse_price
from backend.database.db import (
    init_db,
    create_or_update_excel_catalog,
    list_excel_catalogs,
    search_excel_catalog_items,
    delete_excel_catalog,
    get_distributor_raw
)
from backend.scrapers.manager import ScraperManager

def test_price_parsing():
    assert parse_price("$ 15.200,50") == 15200.50
    assert parse_price("15,200.50") == 15200.50
    assert parse_price("15200") == 15200.0
    assert parse_price("$2500") == 2500.0
    assert parse_price("  $ 1.250.000,00  ") == 1250000.00

def test_excel_file_parsing():
    # Crear un DataFrame con columnas comunes en distribuidoras de celulares
    data = {
        "Codigo": ["MOD-14P", "BAT-11", "PIN-G8", "MOD-A14"],
        "Descripcion del Repuesto": [
            "Modulo Pantalla OLED iPhone 14 Pro",
            "Bateria Original iPhone 11 3110mAh",
            "Pin de Carga y Microfono Moto G8 Power",
            "Modulo Display LCD Samsung A14 4G"
        ],
        "Marca": ["Apple", "Apple", "Motorola", "Samsung"],
        "Precio Gremio": ["$ 115.000,00", "24500", "4.800,50", "$ 32.000"],
        "Stock": ["Disponible", "En stock", "Si", "Sin stock"]
    }
    df = pd.DataFrame(data)
    
    excel_buffer = io.BytesIO()
    df.to_excel(excel_buffer, index=False)
    file_bytes = excel_buffer.getvalue()

    items, meta = parse_price_list_file(file_bytes, "lista_mayorista_test.xlsx", default_currency="ARS")
    
    assert len(items) == 4
    assert meta["total_imported"] == 4
    
    # Validar primer ítem
    item1 = items[0]
    assert item1["sku"] == "MOD-14P"
    assert "iPhone 14 Pro" in item1["description"]
    assert item1["price"] == 115000.00
    assert item1["has_stock"] is True

    # Validar ítem sin stock
    item4 = items[3]
    assert item4["price"] == 32000.00
    assert item4["has_stock"] is False
    assert item4["stock"] == "Sin stock"

async def test_excel_catalog_database_and_search():
    init_db()
    
    # Crear catálogo de prueba
    test_items = [
        {
            "sku": "EX-IPH14P",
            "description": "Modulo OLED Premium iPhone 14 Pro Max",
            "brand": "Apple",
            "price": 128000.0,
            "currency": "ARS",
            "stock": "Disponible",
            "has_stock": True,
            "raw_row": 2
        },
        {
            "sku": "EX-MOTO-G8",
            "description": "Pin de carga completo Moto G8 Play",
            "brand": "Motorola",
            "price": 3500.0,
            "currency": "ARS",
            "stock": "Disponible",
            "has_stock": True,
            "raw_row": 3
        }
    ]

    cat_id = "excel_test_mayorista"
    result = create_or_update_excel_catalog(
        catalog_id=cat_id,
        name="Mayorista Test Cell",
        filename="catalogo_test.xlsx",
        currency="ARS",
        items=test_items
    )
    assert result["total_items"] == 2

    # Verificar registro como distribuidor
    dist = get_distributor_raw(cat_id)
    assert dist is not None
    assert dist["scraper_type"] == "excel_catalog"
    assert dist["is_active"] == 1

    # Búsqueda directa en catálogo
    found = search_excel_catalog_items(cat_id, "modulo iphone 14")
    assert len(found) == 1
    assert found[0]["sku"] == "EX-IPH14P"

    # Búsqueda integrada a través de ScraperManager
    search_resp = await ScraperManager.search_all("modulo iphone 14", target_distributors=[cat_id])
    assert search_resp.total_results >= 1
    assert any(p.distributor_id == cat_id for p in search_resp.results)
    assert search_resp.best_option is not None

    # Limpiar catálogo de prueba
    deleted = delete_excel_catalog(cat_id)
    assert deleted is True
    assert get_distributor_raw(cat_id) is None
    print("[OK] Excel catalog database and search test passed.")

if __name__ == "__main__":
    print("Testing Excel parser and importer...")
    test_price_parsing()
    print("[OK] Price parsing passed.")
    test_excel_file_parsing()
    print("[OK] Excel file parsing passed.")
    asyncio.run(test_excel_catalog_database_and_search())
    print("\nALL EXCEL IMPORTER TESTS PASSED SUCCESSFULLY!")

