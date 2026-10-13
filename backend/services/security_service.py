import time
import secrets
import bcrypt
import jwt
from typing import Optional, Dict, Any, Tuple
from pathlib import Path
from backend.config import DATA_DIR, SECRET_KEY_PATH

# Clave secreta para firmar tokens JWT
JWT_KEY_FILE = DATA_DIR / "jwt_secret.key"

def get_jwt_secret() -> str:
    if not JWT_KEY_FILE.exists():
        secret = secrets.token_hex(32)
        JWT_KEY_FILE.write_text(secret, encoding="utf-8")
        return secret
    return JWT_KEY_FILE.read_text(encoding="utf-8").strip()

JWT_SECRET = get_jwt_secret()
JWT_ALGORITHM = "HS256"

# -------------------------------------------------------------
# 1. HASHEO SEGURO DE CONTRASEÑAS (BCRYPT)
# -------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """Genera un hash bcrypt con salt aleatorio seguro."""
    if not plain_password:
        return ""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, stored_hash: str) -> bool:
    """
    Verifica una contraseña contra su hash bcrypt.
    Soporta compatibilidad regresiva con hashes antiguos o texto plano durante migración.
    """
    if not plain_password or not stored_hash:
        return False

    # 1. Comprobar formato bcrypt estándar ($2a$, $2b$, $2y$)
    if stored_hash.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(plain_password.encode("utf-8"), stored_hash.encode("utf-8"))
        except Exception:
            return False

    # 2. Compatibilidad con hash legacy SHA-256 de gremios
    import hashlib
    legacy_salt = f"wilotech_gremio_salt_2026_{plain_password}"
    legacy_hash = hashlib.sha256(legacy_salt.encode()).hexdigest()
    if legacy_hash == stored_hash:
        return True

    # 3. Comparación constante de tiempo para migración de contraseñas viejas
    return secrets.compare_digest(plain_password, stored_hash)

# -------------------------------------------------------------
# 2. TOKENS JWT DE ACCESO SEGURO
# -------------------------------------------------------------

def create_access_token(data: Dict[str, Any], expires_hours: int = 12) -> str:
    """Crea un token JWT firmado con expiración."""
    to_encode = data.copy()
    expire_ts = time.time() + (expires_hours * 3600)
    to_encode.update({"exp": expire_ts, "iat": time.time()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodifica y valida la firma y vigencia de un token JWT."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

# -------------------------------------------------------------
# 3. RATE LIMITING ANTI FUERZA BRUTA & DOS
# -------------------------------------------------------------

class RateLimiter:
    """Limitador de tasa de peticiones en memoria por dirección IP."""
    _requests: Dict[str, list] = {}

    @classmethod
    def check(cls, client_ip: str, action: str, max_attempts: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Retorna (permitido, segundos_restantes_si_bloqueado).
        """
        key = f"{client_ip}:{action}"
        now = time.time()
        history = cls._requests.get(key, [])

        # Filtrar solo intentos dentro de la ventana de tiempo
        history = [ts for ts in history if (now - ts) < window_seconds]
        cls._requests[key] = history

        if len(history) >= max_attempts:
            oldest = history[0]
            remaining = int(window_seconds - (now - oldest))
            return False, max(remaining, 1)

        history.append(now)
        cls._requests[key] = history
        return True, 0

    @classmethod
    def reset(cls):
        cls._requests.clear()

# -------------------------------------------------------------
# 4. TOKENS DE RECUPERACIÓN DE CONTRASEÑA DE UN SOLO USO (OTP)
# -------------------------------------------------------------

class PasswordRecoveryStore:
    """Almacén de tokens de recuperación temporales de un solo uso."""
    _tokens: Dict[str, Dict[str, Any]] = {}
    TOKEN_TTL = 900  # 15 minutos

    @classmethod
    def create_token(cls, email: str) -> str:
        token = secrets.token_urlsafe(32)
        cls._tokens[token] = {
            "email": email.strip().lower(),
            "expires_at": time.time() + cls.TOKEN_TTL
        }
        return token

    @classmethod
    def verify_and_consume(cls, token: str, email: str) -> bool:
        entry = cls._tokens.get(token)
        if not entry:
            return False

        if time.time() > entry["expires_at"]:
            del cls._tokens[token]
            return False

        if entry["email"] != email.strip().lower():
            return False

        # Consumir token para que no pueda reutilizarse
        del cls._tokens[token]
        return True
