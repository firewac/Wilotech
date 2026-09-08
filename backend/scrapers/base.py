from abc import ABC, abstractmethod
from typing import List, Tuple, Dict, Any, Optional
from backend.database.models import PartResult
from backend.scrapers.session_store import SessionStore

class BaseDistributorScraper(ABC):
    def __init__(self, dist_config: Dict[str, Any]):
        self.config = dist_config
        self.distributor_id = dist_config["id"]
        self.name = dist_config["name"]
        self.base_url = dist_config.get("base_url", "")
        self.login_url = dist_config.get("login_url", "")
        self.username = dist_config.get("username", "")
        self.password = dist_config.get("password", "")
        self.custom_config = dist_config.get("custom_config", {})
        self.session_store = SessionStore(self.distributor_id)

    @abstractmethod
    async def test_login(self) -> Tuple[bool, str]:
        """Verifica si las credenciales son válidas intentando iniciar sesión o cargando la sesión previa."""
        pass

    @abstractmethod
    async def search(self, query: str) -> List[PartResult]:
        """Realiza la búsqueda de repuestos y devuelve una lista unificada de PartResult."""
        pass

    async def close(self):
        """Libera recursos del cliente HTTP o navegador si corresponde."""
        pass
