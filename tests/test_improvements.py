import sys
from pathlib import Path
import unittest

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from backend.app import app
from backend.database.db import (
    init_db,
    upsert_repair_ticket,
    list_repair_tickets,
    get_all_system_settings,
    save_system_settings
)

from backend.services.security_service import create_access_token

class TestImprovements(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)
        token = create_access_token({"sub": "admin", "role": "admin"})
        self.auth_headers = {"Authorization": f"Bearer {token}"}

    def test_settings_api(self):
        # Test settings get and update
        settings = get_all_system_settings()
        self.assertIn("business_name", settings)
        self.assertIn("dolar_rate", settings)

        new_settings = {
            "business_name": "WILOTECH LAB",
            "business_subtitle": "Microelectrónica Avanzada",
            "business_phone": "+54 223 555-1234",
            "business_address": "Colón 1475 Local 3",
            "business_terms": "Garantía de 30 días.",
            "dolar_rate": "1420"
        }
        res = self.client.post("/api/settings", json=new_settings, headers=self.auth_headers)
        self.assertEqual(res.status_code, 200)

        get_res = self.client.get("/api/settings")
        self.assertEqual(get_res.status_code, 200)
        data = get_res.json()
        self.assertEqual(data["business_name"], "WILOTECH LAB")
        self.assertEqual(float(data["dolar_rate"]), 1420.0)

    def test_ticket_new_fields_persistence(self):
        ticket_data = {
            "id": "WT-TEST-9999",
            "clientName": "Test Customer",
            "clientPhone": "2234567890",
            "clientDni": "38123456",
            "deviceModel": "iPhone 13 Pro",
            "serialOrImei": "353456789012345",
            "issueDescription": "No enciende / Corto en VDD_MAIN",
            "finalCost": 150.0,
            "depositAmount": 50.0,
            "paymentMethod": "Efectivo",
            "balancePending": 100.0,
            "currency": "USD",
            "currencyRate": 1400.0,
            "clientSignature": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "isRma": False,
            "originalTicketId": "",
            "rmaReason": ""
        }

        upsert_repair_ticket(ticket_data)

        # Retrieve and verify
        tickets = list_repair_tickets()
        saved = next((t for t in tickets if t["id"] == "WT-TEST-9999"), None)
        self.assertIsNotNone(saved)
        self.assertEqual(saved["depositAmount"], 50.0)
        self.assertEqual(saved["paymentMethod"], "Efectivo")
        self.assertEqual(saved["balancePending"], 100.0)
        self.assertEqual(saved["currencyRate"], 1400.0)
        self.assertTrue(saved["clientSignature"].startswith("data:image/png"))
        self.assertEqual(saved["isRma"], False)

    def test_rma_ticket_persistence(self):
        rma_data = {
            "id": "WT-RMA-8888",
            "clientName": "Test Customer",
            "clientPhone": "2234567890",
            "deviceModel": "iPhone 13 Pro",
            "issueDescription": "[GARANTÍA RMA s/ #WT-TEST-9999] Vuelve a apagarse",
            "finalCost": 0.0,
            "depositAmount": 0.0,
            "paymentMethod": "Garantía RMA ($0)",
            "balancePending": 0.0,
            "currency": "USD",
            "currencyRate": 1400.0,
            "isRma": True,
            "originalTicketId": "WT-TEST-9999",
            "rmaReason": "Vuelve a apagarse"
        }

        upsert_repair_ticket(rma_data)

        tickets = list_repair_tickets()
        saved = next((t for t in tickets if t["id"] == "WT-RMA-8888"), None)
        self.assertIsNotNone(saved)
        self.assertEqual(saved["isRma"], True)
        self.assertEqual(saved["originalTicketId"], "WT-TEST-9999")
        self.assertEqual(saved["rmaReason"], "Vuelve a apagarse")
        self.assertEqual(saved["finalCost"], 0.0)

    def test_comparador_page_and_search(self):
        # 1. Verificar carga de comparador.html con cabeceras anti-caché
        res = self.client.get("/comparador.html")
        self.assertEqual(res.status_code, 200)
        self.assertIn("Cache-Control", res.headers)
        self.assertIn("no-store", res.headers["Cache-Control"])
        self.assertIn("Comparador de Repuestos", res.text)
        self.assertIn("search-form", res.text)

        # 2. Verificar API de búsqueda
        search_res = self.client.get("/api/search?q=pantalla")
        self.assertEqual(search_res.status_code, 200)
        data = search_res.json()
        self.assertIn("query", data)
        self.assertIn("results", data)
        self.assertEqual(data["query"], "pantalla")
        self.assertIsInstance(data["results"], list)

if __name__ == "__main__":
    unittest.main()
