import os
from pathlib import Path
from cryptography.fernet import Fernet

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

SESSIONS_DIR = DATA_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "repuestos.db"
SECRET_KEY_PATH = DATA_DIR / "secret.key"

def get_or_create_cipher() -> Fernet:
    """Obtiene o genera una clave simétrica única para cifrar credenciales en disco."""
    if not SECRET_KEY_PATH.exists():
        key = Fernet.generate_key()
        SECRET_KEY_PATH.write_bytes(key)
    else:
        key = SECRET_KEY_PATH.read_bytes()
    return Fernet(key)

cipher = get_or_create_cipher()

def encrypt_password(plain_text: str) -> str:
    if not plain_text:
        return ""
    return cipher.encrypt(plain_text.encode()).decode()

def decrypt_password(cipher_text: str) -> str:
    if not cipher_text:
        return ""
    try:
        return cipher.decrypt(cipher_text.encode()).decode()
    except Exception:
        return ""
