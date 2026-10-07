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
    print("🚀 MIGRACIÓN Y SINCRO DE BASE DE DATOS WILOTECH A SUPABASE")
    print("=" * 70)

    client = get_supabase_client()
    if not client:
        print("❌ ERROR: No se detectaron las credenciales de Supabase en .env (SUPABASE_URL y SUPABASE_KEY).")
        print("💡 Edita el archivo .env e ingresa las llaves de tu proyecto de https://supabase.com/")
        return False

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Migrar Clientes / Usuarios Gremios
    cursor.execute("SELECT * FROM gremio_users")
    users = [dict(row) for row in cursor.fetchall()]
    print(f"📦 Sincronizando {len(users)} clientes / usuarios de gremios a Supabase...")
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
            print(f"⚠️ Warning en usuario {user.get('email')}: {e}")

    # 2. Migrar Lista de Precios Gremios / Tarifario
    cursor.execute("SELECT * FROM gremio_price_list")
    prices = [dict(row) for row in cursor.fetchall()]
    print(f"🏷️ Sincronizando {len(prices)} ítems del tarifario y lista de precios...")
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
            print(f"⚠️ Warning en precio {item.get('title')}: {e}")

    # 3. Migrar Órdenes de Reparación / Tickets
    cursor.execute("SELECT * FROM repair_tickets")
    tickets = [dict(row) for row in cursor.fetchall()]
    print(f"📋 Sincronizando {len(tickets)} órdenes de reparación de clientes...")
    for t in tickets:
        try:
            client.table("repair_tickets").upsert(t).execute()
        except Exception as e:
            print(f"⚠️ Warning en orden {t.get('id')}: {e}")

    print("\n✅ ¡Sincronización con Supabase completada exitosamente!")
    print("=" * 70)
    return True

if __name__ == "__main__":
    sync_local_to_supabase()
