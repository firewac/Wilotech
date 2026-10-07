import os
import json
import logging
from typing import List, Dict, Any, Optional
from backend.config import SUPABASE_URL, SUPABASE_KEY, DATABASE_URL

logger = logging.getLogger("wilotech.supabase")

_supabase_client = None

def get_supabase_client():
    """Obtiene o inicializa el cliente oficial de Supabase Python."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
        
    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception as err:
        logger.error(f"Error al inicializar cliente de Supabase: {err}")
        return None

def is_supabase_enabled() -> bool:
    """Verifica si Supabase está configurado con credenciales válidas."""
    return bool(SUPABASE_URL and SUPABASE_KEY) or bool(DATABASE_URL)

# ====================================================================
# SERVICIOS DE MANEJO DE TABLAS EN SUPABASE
# ====================================================================

def fetch_gremio_users_supabase() -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return []
    try:
        res = client.table("gremio_users").select("*").execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Supabase fetch gremio_users error: {e}")
        return []

def save_gremio_user_supabase(user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("gremio_users").insert(user_data).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Supabase save gremio_user error: {e}")
        return None

def fetch_gremio_prices_supabase() -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return []
    try:
        res = client.table("gremio_price_list").select("*").order("id", desc=False).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Supabase fetch gremio_price_list error: {e}")
        return []

def upsert_gremio_price_supabase(price_item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("gremio_price_list").upsert(price_item).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Supabase upsert gremio_price_list error: {e}")
        return None

def fetch_tickets_supabase() -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return []
    try:
        res = client.table("repair_tickets").select("*").order("date_received", desc=True).execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Supabase fetch repair_tickets error: {e}")
        return []

def save_ticket_supabase(ticket_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None
    try:
        res = client.table("repair_tickets").upsert(ticket_data).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Supabase save repair_ticket error: {e}")
        return None
