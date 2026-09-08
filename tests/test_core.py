import asyncio
import os
import sys
from pathlib import Path

# Agregar raíz al path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.config import encrypt_password, decrypt_password
from backend.database.db import (
    init_db,
    list_distributors,
    upsert_distributor,
    get_distributor_raw,
    delete_distributor
)
from backend.database.models import DistributorConfig
from backend.scrapers.manager import ScraperManager
from backend.exporters.excel_exporter import export_results_to_excel, export_results_to_csv

def test_encryption():
    plain = "MiClaveSuperSegura123!"
    enc = encrypt_password(plain)
    assert enc != plain, "La contraseña debe estar cifrada"
    dec = decrypt_password(enc)
    assert dec == plain, "El descifrado debe recuperar el texto original"
    print("[OK] Prueba de cifrado Fernet superada.")

def test_database():
    init_db()
    dists = list_distributors()
    assert len(dists) >= 3, "Debe haber al menos 3 distribuidores iniciales"
    
    # Probar inserción
    test_id = "dist_test_temporal"
    test_dist = DistributorConfig(
        id=test_id,
        name="Distribuidora de Prueba Unitaria",
        base_url="https://test.com",
        login_url="https://test.com/login",
        username="test_user",
        password="test_secret_password",
        is_active=True,
        scraper_type="mock"
    )
    upsert_distributor(test_dist)
    
    # Comprobar que en raw se descifra correctamente y no se guarda en plano en DB
    raw = get_distributor_raw(test_id)
    assert raw is not None
    assert raw["password_encrypted"] != "test_secret_password"
    assert raw["password"] == "test_secret_password"
    
    # Eliminar
    deleted = delete_distributor(test_id)
    assert deleted is True
    print("[OK] Prueba de base de datos SQLite y cifrado local superada.")

async def test_scrapers_and_search():
    # 1. Probar login (en SmartSupply o distribuidor configurado)
    login_res = await ScraperManager.test_login("smartsupply")
    assert "smartsupply" in login_res.get("distributor_id", ""), f"Falla en login: {login_res}"
    print(f"[OK] Prueba de distribuidor ejecutada: {login_res['message']}")
    
    # 2. Probar búsqueda de celular
    query = "modulo iphone 12"
    search_res = await ScraperManager.search_all(query)
    assert search_res.total_results > 0, "Debe encontrar resultados para modulo iphone 12"
    assert search_res.best_option is not None, "Debe determinar la mejor opción"
    assert search_res.best_option.is_best_price is True
    assert search_res.best_option.price > 0
    assert search_res.min_price <= search_res.max_price
    print(f"[OK] Búsqueda de '{query}' exitosa: {search_res.total_results} resultados. Mejor precio: {search_res.best_option.price} en {search_res.best_option.distributor_name}")
    
    # 3. Probar exportación
    excel_buf = export_results_to_excel(search_res.results, query)
    assert excel_buf.getvalue(), "El archivo Excel no debe estar vacío"
    
    csv_buf = export_results_to_csv(search_res.results)
    assert len(csv_buf.getvalue()) > 0, "El archivo CSV no debe estar vacío"
    print("[OK] Prueba de exportación a Excel y CSV superada.")

if __name__ == "__main__":
    print("Iniciando pruebas del sistema comparador de repuestos...")
    test_encryption()
    test_database()
    asyncio.run(test_scrapers_and_search())
    print("\n[SUCCESS] TODAS LAS PRUEBAS COMPLETADAS CON EXITO.")
