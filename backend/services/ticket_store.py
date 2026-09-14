import os
import json
import urllib.request
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.config import BASE_DIR, DATA_DIR
from backend.database.db import upsert_repair_ticket, list_repair_tickets, get_repair_ticket_by_id, delete_repair_ticket_by_id

TICKETS_JSON_PATH = DATA_DIR / "tickets.json"
RAW_GITHUB_TICKETS_URL = "https://raw.githubusercontent.com/firewac/Wilotech/main/data/tickets.json"

# Cache global en memoria para persistencia ultra-rápida entre invocaciones serverless
GLOBAL_TICKETS_CACHE: Dict[str, Dict[str, Any]] = {}

class TicketStore:
    @classmethod
    def initialize(cls):
        """Inicializa la caché global desde SQLite, JSON local o GitHub raw."""
        global GLOBAL_TICKETS_CACHE
        # 1. Cargar desde SQLite
        try:
            db_tickets = list_repair_tickets()
            for t in db_tickets:
                if t and t.get("id"):
                    GLOBAL_TICKETS_CACHE[t["id"]] = t
        except Exception as e:
            print(f"[TicketStore] Error al cargar desde SQLite: {e}")

        # 2. Cargar desde tickets.json local si existe
        if TICKETS_JSON_PATH.exists():
            try:
                with open(TICKETS_JSON_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        for t in data:
                            if t and t.get("id"):
                                GLOBAL_TICKETS_CACHE[t["id"]] = t
                    elif isinstance(data, dict):
                        GLOBAL_TICKETS_CACHE.update(data)
            except Exception as e:
                print(f"[TicketStore] Error al cargar tickets.json local: {e}")

        # 3. Fallback a GitHub Raw si la caché aún está vacía (entorno Vercel nuevo)
        if not GLOBAL_TICKETS_CACHE:
            try:
                req = urllib.request.Request(RAW_GITHUB_TICKETS_URL, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        remote_data = json.loads(response.read().decode("utf-8"))
                        if isinstance(remote_data, list):
                            for t in remote_data:
                                if t and t.get("id"):
                                    GLOBAL_TICKETS_CACHE[t["id"]] = t
                        elif isinstance(remote_data, dict):
                            GLOBAL_TICKETS_CACHE.update(remote_data)
            except Exception as e:
                print(f"[TicketStore] Error al cargar fallback de GitHub: {e}")

    @classmethod
    def save_cache_to_json(cls):
        """Persiste la caché actual a data/tickets.json."""
        try:
            tickets_list = list(GLOBAL_TICKETS_CACHE.values())
            # Guardar en DATA_DIR
            with open(TICKETS_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(tickets_list, f, ensure_ascii=False, indent=2)

            # Si BASE_DIR/data existe, guardar copia para Git
            git_data_dir = BASE_DIR / "data"
            git_data_dir.mkdir(parents=True, exist_ok=True)
            git_tickets_file = git_data_dir / "tickets.json"
            with open(git_tickets_file, "w", encoding="utf-8") as f:
                json.dump(tickets_list, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[TicketStore] Error al guardar json: {e}")

    @classmethod
    def get_all(cls, query: Optional[str] = None) -> List[Dict[str, Any]]:
        if not GLOBAL_TICKETS_CACHE:
            cls.initialize()

        tickets_list = list(GLOBAL_TICKETS_CACHE.values())
        if not query or not query.strip():
            return sorted(tickets_list, key=lambda x: x.get("dateReceived", ""), reverse=True)

        q_clean = query.strip().lower().replace("-", "")
        results = []
        for t in tickets_list:
            match_id = t.get("id", "").lower().replace("-", "")
            match_phone = "".join(filter(str.isdigit, t.get("clientPhone", "")))
            match_dni = "".join(filter(str.isdigit, t.get("clientDni", "")))
            match_imei = t.get("serialOrImei", "").lower().replace("-", "")
            match_name = t.get("clientName", "").lower()
            match_model = t.get("deviceModel", "").lower()

            if (q_clean in match_id or 
                (match_phone and q_clean in match_phone) or 
                (match_dni and q_clean in match_dni) or 
                (match_imei and q_clean in match_imei) or 
                q_clean in match_name or 
                q_clean in match_model):
                results.append(t)

        return sorted(results, key=lambda x: x.get("dateReceived", ""), reverse=True)

    @classmethod
    def get_by_id(cls, ticket_id: str) -> Optional[Dict[str, Any]]:
        if not GLOBAL_TICKETS_CACHE:
            cls.initialize()
        return GLOBAL_TICKETS_CACHE.get(ticket_id) or get_repair_ticket_by_id(ticket_id)

    @classmethod
    def save_ticket(cls, ticket: Dict[str, Any]) -> bool:
        if not ticket or not ticket.get("id"):
            return False

        t_id = ticket["id"]
        GLOBAL_TICKETS_CACHE[t_id] = ticket

        # Persistir en SQLite
        try:
            upsert_repair_ticket(ticket)
        except Exception as e:
            print(f"[TicketStore] Error SQLite: {e}")

        # Persistir a JSON
        cls.save_cache_to_json()
        return True

    @classmethod
    def save_bulk(cls, tickets: List[Dict[str, Any]]) -> int:
        count = 0
        for t in tickets:
            if t and t.get("id"):
                GLOBAL_TICKETS_CACHE[t["id"]] = t
                try:
                    upsert_repair_ticket(t)
                except Exception:
                    pass
                count += 1
        cls.save_cache_to_json()
        return count

    @classmethod
    def delete_ticket(cls, ticket_id: str) -> bool:
        if ticket_id in GLOBAL_TICKETS_CACHE:
            del GLOBAL_TICKETS_CACHE[ticket_id]

        try:
            delete_repair_ticket_by_id(ticket_id)
        except Exception:
            pass

        cls.save_cache_to_json()
        return True

# Inicialización al importar el módulo
TicketStore.initialize()
