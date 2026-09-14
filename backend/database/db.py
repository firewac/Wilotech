import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from backend.config import DB_PATH, encrypt_password, decrypt_password
from backend.database.models import DistributorConfig, DistributorResponse

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=20.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Tabla de distribuidores
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS distributors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        login_url TEXT,
        username TEXT,
        password_encrypted TEXT,
        is_active INTEGER DEFAULT 1,
        scraper_type TEXT DEFAULT 'mock',
        last_login_status TEXT DEFAULT 'UNTESTED',
        last_login_msg TEXT DEFAULT '',
        custom_config TEXT DEFAULT '{}',
        updated_at TEXT
    )
    """)
    
    # Tabla de historial de búsquedas
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        total_results INTEGER,
        min_price REAL,
        max_price REAL,
        created_at TEXT
    )
    """)

    # Tabla de caché de repuestos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cached_parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distributor_id TEXT,
        sku TEXT,
        description TEXT,
        brand TEXT,
        price REAL,
        currency TEXT,
        stock TEXT,
        has_stock INTEGER,
        delivery_time TEXT,
        product_url TEXT,
        scraped_at TEXT,
        FOREIGN KEY(distributor_id) REFERENCES distributors(id)
    )
    """)

    # Tabla de catálogos importados por Excel / CSV
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS excel_catalogs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        total_items INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'ARS',
        uploaded_at TEXT
    )
    """)

    # Tabla de repuestos de catálogos Excel / CSV
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS excel_catalog_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        catalog_id TEXT NOT NULL,
        sku TEXT,
        description TEXT NOT NULL,
        brand TEXT,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'ARS',
        stock TEXT DEFAULT 'Disponible',
        has_stock INTEGER DEFAULT 1,
        raw_row INTEGER,
        FOREIGN KEY(catalog_id) REFERENCES excel_catalogs(id) ON DELETE CASCADE
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_excel_items_desc ON excel_catalog_items(description)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_excel_items_cat ON excel_catalog_items(catalog_id)")

    # Tabla de Órdenes de Servicio / Equipos de Taller
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS repair_tickets (
        id TEXT PRIMARY KEY,
        client_name TEXT,
        client_type TEXT,
        client_dni TEXT,
        client_phone TEXT,
        client_address TEXT,
        device_type TEXT,
        device_brand TEXT,
        device_model TEXT,
        device_color TEXT,
        device_storage TEXT,
        serial_or_imei TEXT,
        device_lock_type TEXT,
        device_lock_code TEXT,
        device_checklist TEXT,
        device_condition_notes TEXT,
        issue_description TEXT,
        status TEXT,
        status_step INTEGER,
        date_received TEXT,
        technician TEXT,
        technician_notes TEXT,
        parts_used TEXT,
        final_cost REAL,
        warranty TEXT,
        updated_at TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_phone ON repair_tickets(client_phone)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_dni ON repair_tickets(client_dni)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_imei ON repair_tickets(serial_or_imei)")
    
    # Limpiar cualquier distribuidora antigua automotriz de prueba
    cursor.execute("DELETE FROM distributors WHERE id IN ('dist_norte', 'repuestos_express', 'mayorista_autopartes')")

    # Asegurar que Smart Supply siempre esté registrado
    cursor.execute("SELECT COUNT(*) FROM distributors WHERE id = 'smartsupply'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO distributors (
            id, name, base_url, login_url, username, password_encrypted,
            is_active, scraper_type, last_login_status, last_login_msg, custom_config, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "smartsupply",
            "Smart Supply (Repuestos de Celulares)",
            "https://smartsupply.com.ar",
            "https://smartsupply.com.ar/login",
            "",
            "",
            1,
            "smartsupply",
            "UNTESTED",
            "Portal oficial conectado. Ingresa tu usuario y contraseña para consultar lista de precios mayorista.",
            json.dumps({}),
            datetime.now().isoformat()
        ))

    # Asegurar que SoulFix siempre esté registrado
    cursor.execute("SELECT COUNT(*) FROM distributors WHERE id = 'soulfix'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO distributors (
            id, name, base_url, login_url, username, password_encrypted,
            is_active, scraper_type, last_login_status, last_login_msg, custom_config, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "soulfix",
            "SoulFix (IC Microsoldadura y Repuestos)",
            "https://soulfix.com.ar",
            "https://soulfix.com.ar/mi-cuenta/",
            "",
            "",
            1,
            "soulfix",
            "UNTESTED",
            "Portal oficial conectado (WooCommerce). Ingresa tu usuario y contraseña para acceder a precios de gremio.",
            json.dumps({}),
            datetime.now().isoformat()
        ))

    # Asegurar que Grupo Armar siempre esté registrado
    cursor.execute("SELECT COUNT(*) FROM distributors WHERE id = 'grupoarmar'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO distributors (
            id, name, base_url, login_url, username, password_encrypted,
            is_active, scraper_type, last_login_status, last_login_msg, custom_config, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "grupoarmar",
            "Grupo Armar (Mayorista de Repuestos y Accesorios)",
            "https://grupoarmar.com.ar",
            "https://grupoarmar.com.ar/ingresar",
            "",
            "",
            1,
            "grupoarmar",
            "UNTESTED",
            "Portal oficial conectado. Ingresa tu email y contraseña para consultar lista de precios mayorista.",
            json.dumps({}),
            datetime.now().isoformat()
        ))

    # Asegurar que Tecnoprices siempre esté registrado
    cursor.execute("SELECT COUNT(*) FROM distributors WHERE id = 'tecnoprices'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO distributors (
            id, name, base_url, login_url, username, password_encrypted,
            is_active, scraper_type, last_login_status, last_login_msg, custom_config, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "tecnoprices",
            "Tecnoprices",
            "https://www.tecnoprices.com",
            "https://www.tecnoprices.com/ingresar",
            "",
            "",
            1,
            "tecnoprices",
            "UNTESTED",
            "Portal oficial conectado. Ingresa tu usuario y contraseña para acceder a la lista de precios mayorista.",
            json.dumps({}),
            datetime.now().isoformat()
        ))
    else:
        cursor.execute("UPDATE distributors SET scraper_type = 'tecnoprices' WHERE id = 'tecnoprices'")

    conn.commit()
    conn.close()

def list_distributors(only_active: bool = False) -> List[DistributorResponse]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, name, base_url, login_url, username, is_active, scraper_type, last_login_status, last_login_msg, updated_at FROM distributors"
    if only_active:
        query += " WHERE is_active = 1"
    query += " ORDER BY name ASC"
    
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    
    return [
        DistributorResponse(
            id=r["id"],
            name=r["name"],
            base_url=r["base_url"],
            login_url=r["login_url"] or "",
            username=r["username"] or "",
            is_active=bool(r["is_active"]),
            scraper_type=r["scraper_type"],
            last_login_status=r["last_login_status"],
            last_login_msg=r["last_login_msg"] or "",
            updated_at=r["updated_at"] or ""
        )
        for r in rows
    ]

def get_distributor_raw(dist_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM distributors WHERE id = ?", (dist_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
        
    data = dict(row)
    data["password"] = decrypt_password(data.get("password_encrypted", ""))
    if data.get("custom_config"):
        try:
            data["custom_config"] = json.loads(data["custom_config"])
        except Exception:
            data["custom_config"] = {}
    return data

def upsert_distributor(dist: DistributorConfig) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute("SELECT password_encrypted FROM distributors WHERE id = ?", (dist.id,))
    existing = cursor.fetchone()
    
    if dist.password:
        pw_enc = encrypt_password(dist.password)
    elif existing:
        pw_enc = existing["password_encrypted"]
    else:
        pw_enc = ""
        
    config_json = json.dumps(dist.custom_config or {})
    
    cursor.execute("""
    INSERT INTO distributors (
        id, name, base_url, login_url, username, password_encrypted,
        is_active, scraper_type, last_login_status, last_login_msg, custom_config, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_url = excluded.base_url,
        login_url = excluded.login_url,
        username = excluded.username,
        password_encrypted = excluded.password_encrypted,
        is_active = excluded.is_active,
        scraper_type = excluded.scraper_type,
        last_login_status = CASE WHEN excluded.password_encrypted != distributors.password_encrypted THEN 'UNTESTED' ELSE distributors.last_login_status END,
        custom_config = excluded.custom_config,
        updated_at = excluded.updated_at
    """, (
        dist.id,
        dist.name,
        dist.base_url,
        dist.login_url or "",
        dist.username or "",
        pw_enc,
        1 if dist.is_active else 0,
        dist.scraper_type,
        dist.last_login_status or "UNTESTED",
        dist.last_login_msg or "",
        config_json,
        now
    ))
    
    conn.commit()
    conn.close()
    return True

def delete_distributor(dist_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM distributors WHERE id = ?", (dist_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def update_login_status(dist_id: str, status: str, message: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE distributors 
    SET last_login_status = ?, last_login_msg = ?, updated_at = ?
    WHERE id = ?
    """, (status, message, datetime.now().isoformat(), dist_id))
    conn.commit()
    conn.close()

def save_search_history(query: str, total: int, min_p: Optional[float], max_p: Optional[float]):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO search_history (query, total_results, min_price, max_price, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (query, total, min_p, max_p, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def get_recent_history(limit: int = 10) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT query, total_results, min_price, max_price, created_at
    FROM search_history
    ORDER BY id DESC
    LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ==========================================
# Funciones para Catálogos Excel / CSV
# ==========================================

def create_or_update_excel_catalog(
    catalog_id: str,
    name: str,
    filename: str,
    currency: str,
    items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Guarda o actualiza un catálogo de Excel y todos sus productos."""
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()

    # 1. Registrar / Actualizar en excel_catalogs
    cursor.execute("""
    INSERT INTO excel_catalogs (id, name, filename, total_items, currency, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        filename = excluded.filename,
        total_items = excluded.total_items,
        currency = excluded.currency,
        uploaded_at = excluded.uploaded_at
    """, (catalog_id, name, filename, len(items), currency.upper(), now_str))

    # 2. Borrar ítems previos si ya existía el catálogo
    cursor.execute("DELETE FROM excel_catalog_items WHERE catalog_id = ?", (catalog_id,))

    # 3. Insertar los nuevos ítems por lotes
    items_to_insert = [
        (
            catalog_id,
            it.get("sku", ""),
            it.get("description", ""),
            it.get("brand", "Genérico"),
            float(it.get("price", 0.0)),
            currency.upper(),
            it.get("stock", "Disponible"),
            1 if it.get("has_stock", True) else 0,
            it.get("raw_row", 0)
        )
        for it in items
    ]
    cursor.executemany("""
    INSERT INTO excel_catalog_items (
        catalog_id, sku, description, brand, price, currency, stock, has_stock, raw_row
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, items_to_insert)

    # 4. Registrar automáticamente como distribuidor activo en la tabla distributors
    display_name = f"📊 {name} (Excel)"
    cursor.execute("""
    INSERT INTO distributors (
        id, name, base_url, login_url, username, password_encrypted,
        is_active, scraper_type, last_login_status, last_login_msg, custom_config, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        base_url = excluded.base_url,
        is_active = 1,
        scraper_type = 'excel_catalog',
        last_login_status = 'OK',
        last_login_msg = excluded.last_login_msg,
        updated_at = excluded.updated_at
    """, (
        catalog_id,
        display_name,
        f"excel://{catalog_id}",
        "",
        "",
        "",
        1,
        "excel_catalog",
        "OK",
        f"Catálogo Excel '{filename}' con {len(items)} repuestos importados.",
        json.dumps({"filename": filename, "total_items": len(items), "currency": currency.upper()}),
        now_str
    ))

    conn.commit()
    conn.close()

    return {
        "catalog_id": catalog_id,
        "name": name,
        "filename": filename,
        "total_items": len(items),
        "currency": currency.upper(),
        "uploaded_at": now_str
    }

def list_excel_catalogs() -> List[Dict[str, Any]]:
    """Lista todos los catálogos Excel cargados."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, name, filename, total_items, currency, uploaded_at
    FROM excel_catalogs
    ORDER BY uploaded_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_excel_catalog(catalog_id: str) -> bool:
    """Elimina un catálogo Excel, sus productos y su entrada como distribuidor."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM excel_catalog_items WHERE catalog_id = ?", (catalog_id,))
    cursor.execute("DELETE FROM excel_catalogs WHERE id = ?", (catalog_id,))
    cursor.execute("DELETE FROM distributors WHERE id = ?", (catalog_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def search_excel_catalog_items(catalog_id: str, query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Busca repuestos en un catálogo Excel permitiendo coincidencia precisa de palabras clave."""
    tokens = [t.strip().lower() for t in query.split() if len(t.strip()) > 1]
    if not tokens:
        return []

    conn = get_connection()
    cursor = conn.cursor()

    # Construir cláusula WHERE con cada token en LIKE
    where_clauses = ["catalog_id = ?", "price > 0"]
    params: List[Any] = [catalog_id]

    for t in tokens:
        # Si el token es puramente numérico (ej: "12"), no buscar dentro de SKUs autogenerados 'EX-%'
        if t.isdigit():
            where_clauses.append("(LOWER(description) LIKE ? OR (sku NOT LIKE 'EX-%' AND LOWER(sku) LIKE ?) OR LOWER(brand) LIKE ?)")
        else:
            where_clauses.append("(LOWER(description) LIKE ? OR (sku NOT LIKE 'EX-%' AND LOWER(sku) LIKE ?) OR LOWER(brand) LIKE ?)")
        wildcard = f"%{t}%"
        params.extend([wildcard, wildcard, wildcard])

    sql = f"""
    SELECT id, catalog_id, sku, description, brand, price, currency, stock, has_stock, raw_row
    FROM excel_catalog_items
    WHERE {" AND ".join(where_clauses)}
    ORDER BY has_stock DESC, price ASC
    LIMIT ?
    """
    params.append(limit)

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ==================== GESTIÓN DE ÓRDENES Y EQUIPOS DE TALLER ====================

def ticket_row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    if not row:
        return None
    d = dict(row)
    checklist = {}
    if d.get("device_checklist"):
        try:
            checklist = json.loads(d["device_checklist"])
        except Exception:
            checklist = {}
    parts = []
    if d.get("parts_used"):
        try:
            parts = json.loads(d["parts_used"])
        except Exception:
            parts = [d["parts_used"]] if d.get("parts_used") else []

    return {
        "id": d.get("id"),
        "clientName": d.get("client_name") or "Cliente Mostrador",
        "clientType": d.get("client_type") or "Público",
        "clientDni": d.get("client_dni") or "",
        "clientPhone": d.get("client_phone") or "",
        "clientAddress": d.get("client_address") or "",
        "deviceType": d.get("device_type") or "Celular",
        "deviceBrand": d.get("device_brand") or "",
        "deviceModel": d.get("device_model") or "",
        "deviceColor": d.get("device_color") or "",
        "deviceStorage": d.get("device_storage") or "",
        "serialOrImei": d.get("serial_or_imei") or "",
        "deviceLockType": d.get("device_lock_type") or "Sin Bloqueo",
        "deviceLockCode": d.get("device_lock_code") or "",
        "deviceChecklist": checklist,
        "deviceConditionNotes": d.get("device_condition_notes") or "",
        "issueDescription": d.get("issue_description") or "",
        "status": d.get("status") or "received",
        "statusStep": d.get("status_step") or 1,
        "dateReceived": d.get("date_received") or "",
        "technician": d.get("technician") or "Laboratorio WILOTECH",
        "technicianNotes": d.get("technician_notes") or "",
        "partsUsed": parts,
        "finalCost": d.get("final_cost") or 0.0,
        "warranty": d.get("warranty") or "90 días de garantía por escrito"
    }

def upsert_repair_ticket(t: Dict[str, Any]) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        checklist_str = json.dumps(t.get("deviceChecklist") or {})
        parts_str = json.dumps(t.get("partsUsed") or [])
        now_str = datetime.now().isoformat()

        cursor.execute("""
        INSERT INTO repair_tickets (
            id, client_name, client_type, client_dni, client_phone, client_address,
            device_type, device_brand, device_model, device_color, device_storage,
            serial_or_imei, device_lock_type, device_lock_code, device_checklist,
            device_condition_notes, issue_description, status, status_step,
            date_received, technician, technician_notes, parts_used, final_cost,
            warranty, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            client_name=excluded.client_name,
            client_type=excluded.client_type,
            client_dni=excluded.client_dni,
            client_phone=excluded.client_phone,
            client_address=excluded.client_address,
            device_type=excluded.device_type,
            device_brand=excluded.device_brand,
            device_model=excluded.device_model,
            device_color=excluded.device_color,
            device_storage=excluded.device_storage,
            serial_or_imei=excluded.serial_or_imei,
            device_lock_type=excluded.device_lock_type,
            device_lock_code=excluded.device_lock_code,
            device_checklist=excluded.device_checklist,
            device_condition_notes=excluded.device_condition_notes,
            issue_description=excluded.issue_description,
            status=excluded.status,
            status_step=excluded.status_step,
            date_received=excluded.date_received,
            technician=excluded.technician,
            technician_notes=excluded.technician_notes,
            parts_used=excluded.parts_used,
            final_cost=excluded.final_cost,
            warranty=excluded.warranty,
            updated_at=excluded.updated_at
        """, (
            t.get("id"),
            t.get("clientName"),
            t.get("clientType"),
            t.get("clientDni"),
            t.get("clientPhone"),
            t.get("clientAddress"),
            t.get("deviceType"),
            t.get("deviceBrand"),
            t.get("deviceModel"),
            t.get("deviceColor"),
            t.get("deviceStorage"),
            t.get("serialOrImei"),
            t.get("deviceLockType"),
            t.get("deviceLockCode"),
            checklist_str,
            t.get("deviceConditionNotes"),
            t.get("issueDescription"),
            t.get("status"),
            t.get("statusStep") or 1,
            t.get("dateReceived"),
            t.get("technician"),
            t.get("technicianNotes"),
            parts_str,
            float(t.get("finalCost") or 0.0),
            t.get("warranty"),
            now_str
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"[db.py] Error upserting ticket: {e}")
        return False
    finally:
        conn.close()

def list_repair_tickets(query: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if query and query.strip():
            q_clean = f"%{query.strip().lower()}%"
            cursor.execute("""
            SELECT * FROM repair_tickets
            WHERE LOWER(id) LIKE ?
               OR LOWER(client_name) LIKE ?
               OR LOWER(client_phone) LIKE ?
               OR LOWER(client_dni) LIKE ?
               OR LOWER(serial_or_imei) LIKE ?
               OR LOWER(device_model) LIKE ?
            ORDER BY updated_at DESC, date_received DESC
            """, (q_clean, q_clean, q_clean, q_clean, q_clean, q_clean))
        else:
            cursor.execute("SELECT * FROM repair_tickets ORDER BY updated_at DESC, date_received DESC")
        rows = cursor.fetchall()
        return [ticket_row_to_dict(r) for r in rows]
    finally:
        conn.close()

def get_repair_ticket_by_id(ticket_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM repair_tickets WHERE id = ?", (ticket_id,))
        row = cursor.fetchone()
        return ticket_row_to_dict(row) if row else None
    finally:
        conn.close()

def delete_repair_ticket_by_id(ticket_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM repair_tickets WHERE id = ?", (ticket_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


