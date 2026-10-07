import os
from pathlib import Path
from cryptography.fernet import Fernet

BASE_DIR = Path(__file__).resolve().parent.parent

# En entornos serverless como Vercel o AWS Lambda, el filesystem del código es de solo lectura.
# En esos casos usamos /tmp para que SQLite y las sesiones puedan escribirse sin error.
IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

if IS_SERVERLESS:
    DATA_DIR = Path("/tmp/data")
else:
    DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(parents=True, exist_ok=True)

SESSIONS_DIR = DATA_DIR / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "repuestos.db"
SECRET_KEY_PATH = DATA_DIR / "secret.key"

# Carga automática del archivo .env local si existe
ENV_FILE = BASE_DIR / ".env"
if not ENV_FILE.exists():
    ENV_FILE = BASE_DIR.parent / ".env"

if ENV_FILE.exists():
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
    except Exception:
        pass

# Configuración de Conexión a Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "") or os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY) or bool(DATABASE_URL)

def get_or_create_cipher() -> Fernet:
    """Obtiene o genera una clave simétrica única para cifrar credenciales."""
    env_key = os.environ.get("FERNET_SECRET_KEY")
    if env_key:
        return Fernet(env_key.encode() if isinstance(env_key, str) else env_key)

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
