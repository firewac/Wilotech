import sys
import os
from pathlib import Path

# Añadir directorio raíz al PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.database.db import get_connection
from backend.database.supabase_db import get_supabase_client, is_supabase_enabled

def sync_local_to_supabase():
    """Migra de forma transparente todos los clientes, listas de precios y órdenes desde SQLite local a Supabase."""
    print("=" * 70)
    print("[SUPABASE] MIGRACION Y SINCRO DE BASE DE DATOS WILOTECH A SUPABASE")
    print("=" * 70)

    client = get_supabase_client()
    if not client:
        print("[ERROR] No se pudieron inicializar las credenciales de Supabase en .env (SUPABASE_URL y SUPABASE_KEY).")
        print("[INFO] Revisa que el archivo .env tenga SUPABASE_URL y SUPABASE_KEY configurados.")
        return False

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Migrar Clientes / Usuarios Gremios
    cursor.execute("SELECT * FROM gremio_users")
    users = [dict(row) for row in cursor.fetchall()]
    print(f"[1/3] Sincronizando {len(users)} clientes / usuarios de gremios a Supabase...")
    for user in users:
        try:
            client.table("gremio_users").upsert({
                "name": user.get("name"),
                "email": user.get("email"),
                "phone": user.get("phone", ""),
                "password_hash": user.get("password_hash"),
                "status": user.get("status", "active")
            }, on_conflict="email").execute()
        except Exception as e:
            print(f"[WARN] Error en usuario {user.get('email')}: {e}")

    # 2. Migrar Lista de Precios Gremios / Tarifario
    cursor.execute("SELECT * FROM gremio_price_list")
    prices = [dict(row) for row in cursor.fetchall()]
    print(f"[2/3] Sincronizando {len(prices)} items del tarifario y lista de precios...")
    for item in prices:
        try:
            payload = {
                "code": item.get("code", ""),
                "title": item.get("title"),
                "category": item.get("category", "General"),
                "brand": item.get("brand", ""),
                "price_gremio": item.get("price_gremio", 0.0),
                "price_retail": item.get("price_retail", 0.0),
                "price_gremio_usd": item.get("price_gremio_usd", 0.0),
                "price_retail_usd": item.get("price_retail_usd", 0.0),
                "price_type": item.get("price_type", "usd_to_ars"),
                "stock": item.get("stock", "Disponible")
            }
            if item.get("id"):
                payload["id"] = item.get("id")
            client.table("gremio_price_list").upsert(payload).execute()
        except Exception as e:
            print(f"[WARN] Error en precio {item.get('title')}: {e}")

    # 3. Migrar Órdenes de Reparación / Tickets
    cursor.execute("SELECT * FROM repair_tickets")
    tickets = [dict(row) for row in cursor.fetchall()]
    print(f"[3/3] Sincronizando {len(tickets)} ordenes de reparacion de clientes...")
    for t in tickets:
        try:
            t_copy = dict(t)
            t_copy.pop("parts_used_json", None)
            client.table("repair_tickets").upsert(t_copy).execute()
        except Exception as e:
            print(f"[WARN] Error en orden {t.get('id')}: {e}")

    print("\n[OK] Sincronizacion con Supabase completada exitosamente!")
    print("=" * 70)
    return True

if __name__ == "__main__":
    sync_local_to_supabase()
