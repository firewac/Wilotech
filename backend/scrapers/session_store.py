import json
import time
from pathlib import Path
from typing import Optional, Dict, Any
from backend.config import SESSIONS_DIR

class SessionStore:
    def __init__(self, distributor_id: str):
        self.distributor_id = distributor_id
        self.file_path = SESSIONS_DIR / f"{distributor_id}_session.json"

    def save_session(self, cookies: Dict[str, str], extra_data: Optional[Dict[str, Any]] = None):
        """Guarda cookies y metadatos de sesión en disco."""
        data = {
            "distributor_id": self.distributor_id,
            "saved_at": time.time(),
            "cookies": cookies,
            "extra_data": extra_data or {}
        }
        self.file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def load_session(self, max_age_hours: int = 24) -> Optional[Dict[str, Any]]:
        """Recupera la sesión si no ha expirado."""
        if not self.file_path.exists():
            return None
        try:
            data = json.loads(self.file_path.read_text(encoding="utf-8"))
            age_hours = (time.time() - data.get("saved_at", 0)) / 3600.0
            if age_hours > max_age_hours:
                return None
            return data
        except Exception:
            return None

    def clear_session(self):
        """Elimina la sesión guardada."""
        if self.file_path.exists():
            try:
                self.file_path.unlink()
            except Exception:
                pass
