import sys
import unittest
import zipfile
import json
import asyncio
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from fastapi.testclient import TestClient
from backend.app import app
from backend.services.backup_service import BackupService
from backend.scrapers.manager import ScraperManager
from backend.services.security_service import create_access_token

class TestBackupAndHealth(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.admin_token = create_access_token({"sub": "admin", "role": "admin"})
        self.auth_headers = {"Authorization": f"Bearer {self.admin_token}"}

    def test_backup_service_create_and_list(self):
        # 1. Crear backup en ZIP
        zip_bytes = BackupService.create_backup_zip()
        self.assertGreater(len(zip_bytes), 0, "El ZIP no debe estar vacío")

        # 2. Verificar contenido del ZIP
        import io
        with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
            file_list = zf.namelist()
            self.assertIn("repuestos.db", file_list)
            self.assertIn("backup_info.json", file_list)
            info = json.loads(zf.read("backup_info.json").decode("utf-8"))
            self.assertEqual(info.get("system"), "WILOTECH OS")

        # 3. Listar backups
        backups = BackupService.list_backups()
        self.assertIsInstance(backups, list)
        self.assertGreater(len(backups), 0)

    def test_backup_restore_validation(self):
        # Un ZIP falso debe ser rechazado
        with self.assertRaises(ValueError):
            BackupService.restore_from_zip(b"corrupted_non_zip_bytes")

    def test_distributor_healthcheck(self):
        # ScraperManager.check_all_health() debe retornar una lista estructurada
        health_list = asyncio.run(ScraperManager.check_all_health())
        self.assertIsInstance(health_list, list)
        for item in health_list:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("status", item)
            self.assertIn(item["status"], ["healthy", "warning", "error", "idle"])

    def test_api_distributors_health_endpoint(self):
        res = self.client.get("/api/distributors/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)

    def test_api_backup_download_security(self):
        # Sin token de admin debe rechazar con 401
        unauthorized_res = self.client.get("/api/backup/download")
        self.assertEqual(unauthorized_res.status_code, 401)

        # Con token de admin debe descargar el zip
        authorized_res = self.client.get("/api/backup/download", headers=self.auth_headers)
        self.assertEqual(authorized_res.status_code, 200)
        self.assertEqual(authorized_res.headers.get("content-type"), "application/zip")

if __name__ == "__main__":
    unittest.main()
