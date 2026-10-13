import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Añadir directorio raíz al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.app import app
from backend.services.security_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    RateLimiter,
    PasswordRecoveryStore
)
from backend.database.db import get_system_setting, reset_admin_password_by_email
from backend.services.ticket_store import TicketStore

class TestSecurityHardening(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_bcrypt_hashing_and_verification(self):
        pwd = "SecretPassword123!"
        hashed = hash_password(pwd)
        self.assertTrue(hashed.startswith("$2b$"), "Debe ser un hash Bcrypt válido")
        self.assertTrue(verify_password(pwd, hashed), "Debe verificar contraseña correcta")
        self.assertFalse(verify_password("WrongPass", hashed), "Debe rechazar contraseña incorrecta")

    def test_jwt_token_lifecycle(self):
        token = create_access_token({"sub": "admin", "role": "admin"})
        decoded = decode_access_token(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded.get("sub"), "admin")
        self.assertEqual(decoded.get("role"), "admin")

        # Token adulterado
        tampered = token[:-4] + "fake"
        self.assertIsNone(decode_access_token(tampered), "Debe rechazar tokens con firma alterada")

    def test_rate_limiter(self):
        ip = "192.168.1.99"
        action = "test_action"
        for _ in range(5):
            allowed, _ = RateLimiter.check(ip, action, max_attempts=5, window_seconds=60)
            self.assertTrue(allowed)
        
        # El 6to intento debe ser bloqueado
        blocked, wait_sec = RateLimiter.check(ip, action, max_attempts=5, window_seconds=60)
        self.assertFalse(blocked)
        self.assertGreater(wait_sec, 0)

    def test_admin_login_and_token_generation(self):
        # 1. Login fallido
        res = self.client.post("/api/admin/login", json={"username": "admin", "password": "wrongpassword"})
        self.assertEqual(res.status_code, 401)

        # 2. Reset a contraseña conocida para el test
        admin_email = get_system_setting("admin_email", "wil_18_22@hotmail.com")
        reset_admin_password_by_email(admin_email, "wilotech2026")

        # 3. Login exitoso retorna JWT válido
        res = self.client.post("/api/admin/login", json={"username": "admin", "password": "wilotech2026"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("token", data)
        
        token = data["token"]
        payload = decode_access_token(token)
        self.assertEqual(payload.get("role"), "admin")

    def test_password_recovery_strict_flow(self):
        # 1. Email no autorizado rechazado
        res = self.client.post("/api/admin/recover-verify", json={"email": "attacker@evil.com"})
        self.assertEqual(res.status_code, 404)

        # 2. Email autorizado genera token temporal de recuperación
        admin_email = get_system_setting("admin_email", "wil_18_22@hotmail.com")
        res = self.client.post("/api/admin/recover-verify", json={"email": admin_email})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("authorized"))
        self.assertIn("recovery_token", data)
        rec_token = data["recovery_token"]

        # 3. Intentar reset con token falso debe fallar (403 Forbidden)
        res = self.client.post("/api/admin/reset-password", json={
            "email": admin_email,
            "new_password": "newSecurePassword123",
            "recovery_token": "fake_token_123"
        })
        self.assertEqual(res.status_code, 403)

        # 4. Intentar reset con contraseña corta (<6 chars) debe fallar (400 Bad Request)
        res = self.client.post("/api/admin/reset-password", json={
            "email": admin_email,
            "new_password": "123",
            "recovery_token": rec_token
        })
        self.assertEqual(res.status_code, 400)

        # 5. Reset exitoso con token válido
        res = self.client.post("/api/admin/reset-password", json={
            "email": admin_email,
            "new_password": "wilotech2026",
            "recovery_token": rec_token
        })
        self.assertEqual(res.status_code, 200)

        # 6. Reutilizar el mismo token ya consumido debe fallar (403 Forbidden)
        RateLimiter.reset()
        res = self.client.post("/api/admin/reset-password", json={
            "email": admin_email,
            "new_password": "wilotech2026",
            "recovery_token": rec_token
        })
        self.assertEqual(res.status_code, 403)

    def test_ticket_endpoint_protection(self):
        # 1. Acceso anónimo a /api/tickets sin query rechaza con 401 (evita volcado masivo)
        res = self.client.get("/api/tickets")
        self.assertEqual(res.status_code, 401)

        # 2. Acceso anónimo a /api/tickets con query corta (<3 chars) rechaza con 401
        res = self.client.get("/api/tickets?q=ab")
        self.assertEqual(res.status_code, 401)

        # 3. Búsqueda específica con q >= 3 permitida para clientes (tracker)
        res = self.client.get("/api/tickets?q=iPhone")
        self.assertEqual(res.status_code, 200)

        # 4. Acceso con token de administrador permite listar todo
        admin_token = create_access_token({"sub": "admin", "role": "admin"})
        res = self.client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.json(), list)

        # 5. Creación anónima de ticket nuevo rechazada
        res = self.client.post("/api/tickets", json={"id": "MALICIOUS-999", "clientName": "Hacker"})
        self.assertEqual(res.status_code, 401)

        # 6. Creación con token de administrador permitida
        res = self.client.post("/api/tickets", json={
            "id": "SEC-TEST-001",
            "clientName": "Cliente Seguro",
            "deviceModel": "iPhone 13",
            "status": "pending"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res.status_code, 200)

        # 7. Cliente anónimo aprobando presupuesto existente permitido (presupuesto.html)
        res = self.client.post("/api/tickets", json={
            "id": "SEC-TEST-001",
            "status": "approved",
            "statusStep": 4
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["ticket"]["status"], "approved")

        # 8. Eliminación anónima rechazada
        res = self.client.delete("/api/tickets/SEC-TEST-001")
        self.assertEqual(res.status_code, 401)

        # 9. Eliminación con token de administrador permitida
        res = self.client.delete("/api/tickets/SEC-TEST-001", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res.status_code, 200)

    def test_distributors_endpoint_protection(self):
        # 1. Crear distribuidora anónimamente rechazado
        res = self.client.post("/api/distributors", json={"id": "test_dist", "name": "Test"})
        self.assertEqual(res.status_code, 401)

        # 2. Con token admin permitido
        admin_token = create_access_token({"sub": "admin", "role": "admin"})
        res = self.client.post("/api/distributors", json={
            "id": "test_sec_dist",
            "name": "Test Sec Dist",
            "base_url": "https://example.com",
            "scraper_type": "html"
        }, headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res.status_code, 200)

        # 3. Eliminar distribuidora anónimamente rechazado
        res = self.client.delete("/api/distributors/test_sec_dist")
        self.assertEqual(res.status_code, 401)

        # 4. Eliminar con token admin permitido
        res = self.client.delete("/api/distributors/test_sec_dist", headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(res.status_code, 200)

    def test_catalog_upload_security(self):
        admin_token = create_access_token({"sub": "admin", "role": "admin"})

        # 1. Subida sin autenticación rechazada
        res = self.client.post("/api/catalogs/excel/upload", files={"file": ("test.exe", b"malicious", "application/octet-stream")})
        self.assertEqual(res.status_code, 401)

        # 2. Extensión no permitida (.exe) rechazada aún con admin
        res = self.client.post(
            "/api/catalogs/excel/upload",
            data={"name": "Test List", "currency": "ARS"},
            files={"file": ("malware.exe", b"fake binary content", "application/octet-stream")},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Formato de archivo no soportado", res.json().get("detail", ""))

if __name__ == "__main__":
    unittest.main()
