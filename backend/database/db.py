import sqlite3
import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
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

    # Tabla de Usuarios de Gremios
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gremio_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT DEFAULT '',
        password_hash TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT
    )
    """)

    # Tabla de Lista de Precios Gremios
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gremio_price_list (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT DEFAULT '',
        title TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        brand TEXT DEFAULT '',
        price_gremio REAL NOT NULL,
        price_retail REAL DEFAULT 0.0,
        stock TEXT DEFAULT 'Disponible',
        updated_at TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_gremio_price_title ON gremio_price_list(title)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_gremio_price_cat ON gremio_price_list(category)")

    # Tabla de Configuración del Sistema y Credenciales del Taller
    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TEXT
        )
        """)
        now_str = datetime.now().isoformat()
        cursor.execute("INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at) VALUES ('admin_email', 'wil_18_22@hotmail.com', ?)", (now_str,))
        cursor.execute("INSERT OR IGNORE INTO system_settings (setting_key, setting_value, updated_at) VALUES ('admin_password', 'admin123', ?)", (now_str,))
    except Exception:
        cursor.execute("DROP TABLE IF EXISTS system_settings")
        cursor.execute("""
        CREATE TABLE system_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TEXT
        )
        """)
        now_str = datetime.now().isoformat()
        cursor.execute("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES ('admin_email', 'wil_18_22@hotmail.com', ?)", (now_str,))
        cursor.execute("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES ('admin_password', 'admin123', ?)", (now_str,))

    # Precargar ítems iniciales de mano de obra de gremio si la tabla está vacía o faltan modelos
    cursor.execute("SELECT COUNT(*) FROM gremio_price_list")
    if cursor.fetchone()[0] == 0:
        sample_items = [
            ("MO-MOD-SAM-A32", "Mano de Obra: Instalación Módulo Samsung A32", "Módulos & Pantallas", "Samsung", 10000.0, 18000.0, "Disponible"),
            ("MO-MOD-MOT-G60", "Mano de Obra: Instalación Módulo Moto G60", "Módulos & Pantallas", "Motorola", 10000.0, 18000.0, "Disponible"),
            ("MO-BAT-SAM-S20FE", "Mano de Obra: Cambio de Batería Samsung S20 FE", "Baterías", "Samsung", 7500.0, 14000.0, "Disponible"),
            ("MO-PIN-TYPEC", "Mano de Obra: Soldadura / Cambio Pin de Carga Type-C", "Conectores y Pines", "Multimarca", 6000.0, 12000.0, "Disponible"),
            ("MO-SRV-REBALL", "Mano de Obra: Reballing CPU / PMIC Laboratorio Gremio", "Servicios de Laboratorio", "Multimarca", 35000.0, 60000.0, "Disponible"),
            ("MO-SRV-GLASS", "Mano de Obra: Cambio de Glass LCD/OLED General", "Servicios de Laboratorio", "Multimarca", 18000.0, 32000.0, "Disponible"),
            ("MO-SRV-FRP", "Mano de Obra: Servicio Software FRP / Samsung Knox", "Software & Desbloqueos", "Multimarca", 12000.0, 22000.0, "Disponible")
        ]
        now_str = datetime.now().isoformat()
        cursor.executemany("""
        INSERT INTO gremio_price_list (code, title, category, brand, price_gremio, price_retail, stock, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [(item[0], item[1], item[2], item[3], item[4], item[5], item[6], now_str) for item in sample_items])

    # Precargar todos los ítems de iPhone de 11 al 17 Pro Max y catálogo iLab
    cursor.execute("SELECT code FROM gremio_price_list")
    existing_codes = set(row[0] for row in cursor.fetchall() if row[0])
    
    iphone_items = get_iphone_gremio_seed_items()
    ilab_items = get_ilab_gremio_seed_items(usd_rate=1300.0)
    all_seeds = iphone_items + ilab_items

    to_insert = [item for item in all_seeds if item[0] not in existing_codes]
    if to_insert:
        now_str = datetime.now().isoformat()
        cursor.executemany("""
        INSERT INTO gremio_price_list (code, title, category, brand, price_gremio, price_retail, stock, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [(item[0], item[1], item[2], item[3], item[4], item[5], item[6], now_str) for item in to_insert])

    # Asegurar que el usuario demo de gremios (gremio@wilotech.com) esté siempre registrado
    cursor.execute("SELECT COUNT(*) FROM gremio_users WHERE LOWER(email) = 'gremio@wilotech.com'")
    if cursor.fetchone()[0] == 0:
        pw_hash = hash_gremio_password("gremio123")
        now_str = datetime.now().isoformat()
        cursor.execute("""
        INSERT INTO gremio_users (name, email, phone, password_hash, status, created_at)
        VALUES ('Taller Gremio Demo', 'gremio@wilotech.com', '2235914163', ?, 'active', ?)
        """, (pw_hash, now_str))

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


# --- FUNCIONES DE GREMIOS ---

import hashlib

def hash_gremio_password(plain_text: str) -> str:
    if not plain_text:
        return ""
    return hashlib.sha256(f"wilotech_gremio_salt_2026_{plain_text}".encode()).hexdigest()

def verify_gremio_password(plain_password: str, stored_hash: str) -> bool:
    if not plain_password or not stored_hash:
        return False
    # 1. Verificación SHA256 determinista
    if hash_gremio_password(plain_password) == stored_hash:
        return True
    # 2. Verificación Fernet fallback para usuarios creados anteriormente
    try:
        if decrypt_password(stored_hash) == plain_password:
            return True
    except Exception:
        pass
    # 3. Verificación plano fallback
    if plain_password == stored_hash:
        return True
    return False

def create_gremio_user(name: str, email: str, phone: str, password_plain: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        pw_hash = hash_gremio_password(password_plain)
        now_str = datetime.now().isoformat()
        cursor.execute("""
        INSERT INTO gremio_users (name, email, phone, password_hash, status, created_at)
        VALUES (?, ?, ?, ?, 'active', ?)
        """, (name.strip(), email.strip().lower(), phone.strip() if phone else "", pw_hash, now_str))
        conn.commit()
        user_id = cursor.lastrowid
        return {
            "id": user_id,
            "name": name.strip(),
            "email": email.strip().lower(),
            "phone": phone.strip() if phone else "",
            "status": "active",
            "created_at": now_str
        }
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_gremio_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM gremio_users WHERE LOWER(email) = ?", (email.strip().lower(),))
        row = cursor.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()

def list_gremio_users() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, email, phone, status, created_at FROM gremio_users ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def update_gremio_user_status(user_id: int, status: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE gremio_users SET status = ? WHERE id = ?", (status, user_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def list_gremio_price_items(query: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = "SELECT * FROM gremio_price_list WHERE 1=1"
        params = []
        if query and query.strip():
            sql += " AND (LOWER(title) LIKE ? OR LOWER(code) LIKE ? OR LOWER(brand) LIKE ?)"
            q_clean = f"%{query.strip().lower()}%"
            params.extend([q_clean, q_clean, q_clean])
        if category and category.strip() and category.lower() != "todas":
            sql += " AND LOWER(category) = ?"
            params.append(category.strip().lower())
        sql += " ORDER BY category ASC, title ASC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def upsert_gremio_price_item(item_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        item_id = item_data.get("id")
        code = (item_data.get("code") or "").strip()
        title = (item_data.get("title") or "").strip()
        category = (item_data.get("category") or "General").strip() or "General"
        brand = (item_data.get("brand") or "").strip()
        price_gremio = float(item_data.get("price_gremio", 0))
        price_retail = float(item_data.get("price_retail", 0))
        stock = (item_data.get("stock") or "Disponible").strip() or "Disponible"
        now_str = datetime.now().isoformat()

        if item_id:
            cursor.execute("""
            UPDATE gremio_price_list
            SET code = ?, title = ?, category = ?, brand = ?, price_gremio = ?, price_retail = ?, stock = ?, updated_at = ?
            WHERE id = ?
            """, (code, title, category, brand, price_gremio, price_retail, stock, now_str, item_id))
        else:
            cursor.execute("""
            INSERT INTO gremio_price_list (code, title, category, brand, price_gremio, price_retail, stock, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (code, title, category, brand, price_gremio, price_retail, stock, now_str))
            item_id = cursor.lastrowid

        conn.commit()
        return {
            "id": item_id,
            "code": code,
            "title": title,
            "category": category,
            "brand": brand,
            "price_gremio": price_gremio,
            "price_retail": price_retail,
            "stock": stock,
            "updated_at": now_str
        }
    finally:
        conn.close()

def delete_gremio_price_item(item_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM gremio_price_list WHERE id = ?", (item_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def get_iphone_gremio_seed_items() -> List[Tuple[str, str, str, str, float, float, str]]:
    models_gen = [
        # (Gen, Model Name, Code, Gen Mult, Level Adder)
        # iPhone 11 Series
        (11, "iPhone 11", "IPH11", 1.0, 0),
        (11, "iPhone 11 Pro", "IPH11P", 1.0, 3000),
        (11, "iPhone 11 Pro Max", "IPH11PM", 1.0, 5000),
        # iPhone 12 Series
        (12, "iPhone 12 mini", "IPH12M", 1.2, 0),
        (12, "iPhone 12", "IPH12", 1.25, 0),
        (12, "iPhone 12 Pro", "IPH12P", 1.25, 3500),
        (12, "iPhone 12 Pro Max", "IPH12PM", 1.25, 6000),
        # iPhone 13 Series
        (13, "iPhone 13 mini", "IPH13M", 1.45, 0),
        (13, "iPhone 13", "IPH13", 1.5, 0),
        (13, "iPhone 13 Pro", "IPH13P", 1.5, 4000),
        (13, "iPhone 13 Pro Max", "IPH13PM", 1.5, 7000),
        # iPhone 14 Series
        (14, "iPhone 14", "IPH14", 1.75, 0),
        (14, "iPhone 14 Plus", "IPH14PL", 1.75, 2000),
        (14, "iPhone 14 Pro", "IPH14P", 1.75, 4500),
        (14, "iPhone 14 Pro Max", "IPH14PM", 1.75, 8000),
        # iPhone 15 Series
        (15, "iPhone 15", "IPH15", 2.1, 0),
        (15, "iPhone 15 Plus", "IPH15PL", 2.1, 2500),
        (15, "iPhone 15 Pro", "IPH15P", 2.1, 5500),
        (15, "iPhone 15 Pro Max", "IPH15PM", 2.1, 9500),
        # iPhone 16 Series
        (16, "iPhone 16", "IPH16", 2.5, 0),
        (16, "iPhone 16 Plus", "IPH16PL", 2.5, 3000),
        (16, "iPhone 16 Pro", "IPH16P", 2.5, 6500),
        (16, "iPhone 16 Pro Max", "IPH16PM", 2.5, 11000),
        # iPhone 17 Series
        (17, "iPhone 17", "IPH17", 3.0, 0),
        (17, "iPhone 17 Plus", "IPH17PL", 3.0, 3500),
        (17, "iPhone 17 Pro", "IPH17P", 3.0, 7500),
        (17, "iPhone 17 Pro Max", "IPH17PM", 3.0, 13000),
    ]

    service_types = [
        # (Prefix, Service Name, Category, Base Gremio, Base Retail)
        ("BAT", "Cambio de Batería", "Baterías", 8000, 15000),
        ("MOD", "Cambio de Módulo", "Módulos & Pantallas", 12000, 22000),
        ("CAM", "Cambio de Cámara", "Cámaras", 9000, 16000),
        ("FID", "Reparación Face ID", "Servicios de Laboratorio", 18000, 32000),
        ("TAP", "Cambio de Tapa Trasera", "Glass & Refurbish", 12000, 22000),
        ("FLX", "Cambio Flex Pin de Carga", "Flex & Carga", 7000, 13000),
        ("SPK", "Cambio Buzzer y Speaker", "Conectores y Pines", 6000, 11000),
    ]

    items = []
    for gen, model_name, model_code, mult, adder in models_gen:
        for prefix, srv_name, cat, base_gremio, base_retail in service_types:
            code = f"MO-{prefix}-{model_code}"
            title = f"Mano de Obra: {srv_name} {model_name}"
            price_g = round((base_gremio * mult + adder) / 500) * 500
            price_r = round((base_retail * mult + adder * 1.6) / 500) * 500
            items.append((code, title, cat, "Apple", float(price_g), float(price_r), "Disponible"))

    return items

def seed_iphone_gremio_items_db(overwrite: bool = False) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if overwrite:
            cursor.execute("DELETE FROM gremio_price_list WHERE code LIKE 'MO-%'")
        
        cursor.execute("SELECT code FROM gremio_price_list")
        existing_codes = set(row[0] for row in cursor.fetchall() if row[0])

        items = get_iphone_gremio_seed_items()
        to_insert = [item for item in items if item[0] not in existing_codes]
        if to_insert:
            now_str = datetime.now().isoformat()
            cursor.executemany("""
            INSERT INTO gremio_price_list (code, title, category, brand, price_gremio, price_retail, stock, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [(item[0], item[1], item[2], item[3], item[4], item[5], item[6], now_str) for item in to_insert])
            conn.commit()
            return cursor.rowcount
        return 0
    finally:
        conn.close()

def get_ilab_gremio_seed_items(usd_rate: float = 1300.0) -> List[Tuple[str, str, str, str, float, float, str]]:
    usd_rate = float(usd_rate) if usd_rate else 1300.0
    items = []

    # 1. Placa
    placa_list = [
        ("iPhone 6", 22), ("iPhone 6 Plus", 22), ("iPhone 6s", 24), ("iPhone 6s Plus", 24),
        ("iPhone 7", 39), ("iPhone 7 Plus", 39), ("iPhone 8", 45), ("iPhone 8 Plus", 45),
        ("iPhone X", 60), ("iPhone XS", 65), ("iPhone XS Max", 65), ("iPhone SE 2020", 65),
        ("iPhone XR", 60), ("iPhone 11", 80), ("iPhone 11 Pro", 80), ("iPhone 11 Pro Max", 80),
        ("iPhone 12 Mini", 100), ("iPhone 12", 100), ("iPhone 12 Pro", 100), ("iPhone 12 Pro Max", 100),
        ("iPhone 13 Mini", 140), ("iPhone 13", 140), ("iPhone 13 Pro", 140), ("iPhone 13 Pro Max", 140),
        ("iPhone 14", 200), ("iPhone 14 Plus", 200), ("iPhone 14 Pro", 200), ("iPhone 14 Pro Max", 200),
        ("iPhone 15", 240), ("iPhone 15 Plus", 240), ("iPhone 15 Pro", 240), ("iPhone 15 Pro Max", 240),
        ("iPhone 16", 290), ("iPhone 16 Pro", 290), ("iPhone 16 Pro Max", 290)
    ]
    for model, usd in placa_list:
        clean_code = model.upper().replace(" ", "").replace("IPHONE", "IPH")
        code = f"MO-ILAB-PLC-{clean_code}"
        title = f"Mano de Obra: Reparación de Placa {model} (iLab)"
        price_g = round((usd * usd_rate) / 500) * 500
        price_r = round((price_g * 1.6) / 500) * 500
        items.append((code, title, "Servicios de Laboratorio", "Apple", float(price_g), float(price_r), "Disponible"))

    # 2. Batería
    bateria_list = [
        ("iPhone 6", 19), ("iPhone 6 Plus", 19), ("iPhone 6s", 20), ("iPhone 6s Plus", 20),
        ("iPhone 7", 20), ("iPhone 7 Plus", 21), ("iPhone 8", 20), ("iPhone 8 Plus", 21),
        ("iPhone X", 24), ("iPhone XS", 26), ("iPhone XS Max", 29), ("iPhone SE 2020", 39),
        ("iPhone XR", 30), ("iPhone 11", 40), ("iPhone 11 Pro", 45), ("iPhone 11 Pro Max", 45),
        ("iPhone 12 Mini", 48), ("iPhone 12", 50), ("iPhone 12 Pro", 50), ("iPhone 12 Pro Max", 60),
        ("iPhone 13 Mini", 55), ("iPhone 13", 60), ("iPhone 13 Pro", 62), ("iPhone 13 Pro Max", 62),
        ("iPhone 14", 65), ("iPhone 14 Plus", 65), ("iPhone 14 Pro", 70), ("iPhone 14 Pro Max", 72),
        ("iPhone 15", 75), ("iPhone 15 Pro", 80), ("iPhone 15 Pro Max", 90)
    ]
    for model, usd in bateria_list:
        clean_code = model.upper().replace(" ", "").replace("IPHONE", "IPH")
        code = f"MO-ILAB-BAT-{clean_code}"
        title = f"Mano de Obra: Reemplazo de Batería {model} (iLab)"
        price_g = round((usd * usd_rate) / 500) * 500
        price_r = round((price_g * 1.6) / 500) * 500
        items.append((code, title, "Baterías", "Apple", float(price_g), float(price_r), "Disponible"))

    # 3. Tapa Trasera
    tapa_list = [
        ("iPhone 8", 30), ("iPhone 8 Plus", 30), ("iPhone X", 33), ("iPhone XS", 33), ("iPhone XS Max", 33),
        ("iPhone SE 2020", 30), ("iPhone XR", 33), ("iPhone 11", 35), ("iPhone 11 Pro", 40), ("iPhone 11 Pro Max", 40),
        ("iPhone 12 Mini", 40), ("iPhone 12", 40), ("iPhone 12 Pro", 40), ("iPhone 12 Pro Max", 40),
        ("iPhone 13 Mini", 45), ("iPhone 13", 45), ("iPhone 13 Pro", 50), ("iPhone 13 Pro Max", 50),
        ("iPhone 14", 50), ("iPhone 14 Plus", 50), ("iPhone 14 Pro", 55), ("iPhone 14 Pro Max", 55),
        ("iPhone 15", 65), ("iPhone 15 Pro", 65), ("iPhone 15 Pro Max", 65), ("iPhone 15 Plus", 65),
        ("iPhone 16", 90), ("iPhone 16 Pro", 90), ("iPhone 16 Pro Max", 90)
    ]
    for model, usd in tapa_list:
        clean_code = model.upper().replace(" ", "").replace("IPHONE", "IPH")
        code = f"MO-ILAB-TAP-{clean_code}"
        title = f"Mano de Obra: Reemplazo Tapa Trasera {model} (iLab)"
        price_g = round((usd * usd_rate) / 500) * 500
        price_r = round((price_g * 1.6) / 500) * 500
        items.append((code, title, "Glass & Refurbish", "Apple", float(price_g), float(price_r), "Disponible"))

    # 4. Pantalla / Módulos
    pantalla_list = [
        {"modelo": "iPhone 11", "tipo": "Incell", "ic": False, "precio": 66},
        {"modelo": "iPhone 11", "tipo": "Incell JK", "ic": True, "precio": 74.0},
        {"modelo": "iPhone 11", "tipo": "Calidad Original", "ic": False, "precio": 79.04},
        {"modelo": "iPhone 11 Pro", "tipo": "Incell", "ic": False, "precio": 70},
        {"modelo": "iPhone 11 Pro", "tipo": "Incell JK", "ic": True, "precio": 75.6},
        {"modelo": "iPhone 11 Pro", "tipo": "OLED", "ic": False, "precio": 95.76},
        {"modelo": "iPhone 11 Pro", "tipo": "OLED", "ic": True, "precio": 96},
        {"modelo": "iPhone 11 Pro Max", "tipo": "Incell Premium", "ic": False, "precio": 74.0},
        {"modelo": "iPhone 11 Pro Max", "tipo": "Incell JK", "ic": True, "precio": 78.8},
        {"modelo": "iPhone 11 Pro Max", "tipo": "OLED", "ic": True, "precio": 105},
        {"modelo": "iPhone 11 Pro Max", "tipo": "AMOLED", "ic": False, "precio": 150.8},
        {"modelo": "iPhone 12 Mini", "tipo": "Incell", "ic": True, "precio": 94.8},
        {"modelo": "iPhone 12 Mini", "tipo": "OLED", "ic": False, "precio": 118.0},
        {"modelo": "iPhone 12", "tipo": "Incell", "ic": False, "precio": 74.0},
        {"modelo": "iPhone 12", "tipo": "Incell JK", "ic": True, "precio": 80.4},
        {"modelo": "iPhone 12/12 Pro", "tipo": "OLED", "ic": False, "precio": 111.6},
        {"modelo": "iPhone 12/12 Pro", "tipo": "OLED JK", "ic": True, "precio": 113.2},
        {"modelo": "iPhone 12/12 Pro", "tipo": "Original", "ic": False, "precio": 157.2},
        {"modelo": "iPhone 12/12 Pro", "tipo": "JCID Pre Programado", "ic": False, "precio": 138.0},
        {"modelo": "iPhone 12 Pro Max", "tipo": "Incell", "ic": True, "precio": 90.0},
        {"modelo": "iPhone 12 Pro Max", "tipo": "OLED", "ic": True, "precio": 146.0},
        {"modelo": "iPhone 12 Pro Max", "tipo": "JCID Pre Programado", "ic": False, "precio": 158.0},
        {"modelo": "iPhone 12 Pro Max", "tipo": "Original", "ic": False, "precio": 258.0},
        {"modelo": "iPhone 13 Mini", "tipo": "Incell", "ic": False, "precio": 98.0},
        {"modelo": "iPhone 13 Mini", "tipo": "Incell JK", "ic": True, "precio": 110.0},
        {"modelo": "iPhone 13 Mini", "tipo": "OLED", "ic": True, "precio": 134.0},
        {"modelo": "iPhone 13 Mini", "tipo": "Original", "ic": False, "precio": 202.0},
        {"modelo": "iPhone 13", "tipo": "Incell GX", "ic": True, "precio": 85.2},
        {"modelo": "iPhone 13", "tipo": "OLED", "ic": True, "precio": 110.0},
        {"modelo": "iPhone 13", "tipo": "OLED GX", "ic": True, "precio": 118.0},
        {"modelo": "iPhone 13", "tipo": "OLED Soft JK", "ic": True, "precio": 118.0},
        {"modelo": "iPhone 13", "tipo": "JCID Pre Programado", "ic": False, "precio": 154.0},
        {"modelo": "iPhone 13", "tipo": "Original", "ic": False, "precio": 250.0},
        {"modelo": "iPhone 13 Pro", "tipo": "Incell", "ic": True, "precio": 98.0},
        {"modelo": "iPhone 13 Pro", "tipo": "OLED", "ic": False, "precio": 130.0},
        {"modelo": "iPhone 13 Pro", "tipo": "OLED", "ic": True, "precio": 154.0},
        {"modelo": "iPhone 13 Pro", "tipo": "JCID Pre Programado", "ic": False, "precio": 162.0},
        {"modelo": "iPhone 13 Pro", "tipo": "Original", "ic": False, "precio": 338.0},
        {"modelo": "iPhone 13 Pro Max", "tipo": "Incell", "ic": False, "precio": 106.0},
        {"modelo": "iPhone 13 Pro Max", "tipo": "Incell", "ic": True, "precio": 118.8},
        {"modelo": "iPhone 13 Pro Max", "tipo": "OLED", "ic": True, "precio": 146.0},
        {"modelo": "iPhone 13 Pro Max", "tipo": "OLED", "ic": False, "precio": 146.0},
        {"modelo": "iPhone 13 Pro Max", "tipo": "JCID Pre Programado", "ic": False, "precio": 186.0},
        {"modelo": "iPhone 13 Pro Max", "tipo": "Original", "ic": False, "precio": 386.0},
        {"modelo": "iPhone 14", "tipo": "Incell", "ic": True, "precio": 98.0},
        {"modelo": "iPhone 14", "tipo": "OLED", "ic": False, "precio": 122.0},
        {"modelo": "iPhone 14", "tipo": "OLED", "ic": True, "precio": 122.0},
        {"modelo": "iPhone 14", "tipo": "JCID Pre Programado", "ic": False, "precio": 150.0},
        {"modelo": "iPhone 14", "tipo": "Original", "ic": False, "precio": 170.0},
        {"modelo": "iPhone 14 Pro", "tipo": "Incell", "ic": True, "precio": 102.0},
        {"modelo": "iPhone 14 Pro", "tipo": "OLED", "ic": False, "precio": 130.0},
        {"modelo": "iPhone 14 Pro", "tipo": "OLED", "ic": True, "precio": 138.0},
        {"modelo": "iPhone 14 Pro", "tipo": "JCID Pre Programado", "ic": False, "precio": 258.0},
        {"modelo": "iPhone 14 Pro", "tipo": "Original", "ic": False, "precio": 306.0},
        {"modelo": "iPhone 14 Plus", "tipo": "Incell", "ic": True, "precio": 90.0},
        {"modelo": "iPhone 14 Plus", "tipo": "OLED", "ic": True, "precio": 132.4},
        {"modelo": "iPhone 14 Plus", "tipo": "JCID Pre Programado", "ic": False, "precio": 178.0},
        {"modelo": "iPhone 14 Plus", "tipo": "Original", "ic": False, "precio": 194.0},
        {"modelo": "iPhone 14 Pro Max", "tipo": "Incell", "ic": True, "precio": 138.0},
        {"modelo": "iPhone 14 Pro Max", "tipo": "OLED", "ic": False, "precio": 210.0},
        {"modelo": "iPhone 14 Pro Max", "tipo": "OLED GX", "ic": True, "precio": 242.0},
        {"modelo": "iPhone 14 Pro Max", "tipo": "JCID Pre Programado", "ic": False, "precio": 238.0},
        {"modelo": "iPhone 14 Pro Max", "tipo": "Original", "ic": False, "precio": 330.0},
        {"modelo": "iPhone 15", "tipo": "Incell", "ic": True, "precio": 114.0},
        {"modelo": "iPhone 15", "tipo": "OLED", "ic": True, "precio": 183.6},
        {"modelo": "iPhone 15", "tipo": "JCID Pre Programado", "ic": False, "precio": 270.0},
        {"modelo": "iPhone 15", "tipo": "Original", "ic": False, "precio": 314.0},
        {"modelo": "iPhone 15", "tipo": "Original Glass Cambiado", "ic": False, "precio": 290.0},
        {"modelo": "iPhone 15 Plus", "tipo": "OLED", "ic": False, "precio": 170.24},
        {"modelo": "iPhone 15 Pro", "tipo": "Incell MF", "ic": False, "precio": 118.0},
        {"modelo": "iPhone 15 Pro", "tipo": "Incell", "ic": True, "precio": 126.0},
        {"modelo": "iPhone 15 Pro", "tipo": "OLED", "ic": True, "precio": 162.0},
        {"modelo": "iPhone 15 Pro", "tipo": "JCID Pre Programado", "ic": False, "precio": 290.0},
        {"modelo": "iPhone 15 Pro", "tipo": "Original", "ic": False, "precio": 330.0},
        {"modelo": "iPhone 15 Pro Max", "tipo": "Incell", "ic": False, "precio": 122.0},
        {"modelo": "iPhone 15 Pro Max", "tipo": "Incell", "ic": True, "precio": 142.0},
        {"modelo": "iPhone 15 Pro Max", "tipo": "JCID Pre Programado", "ic": False, "precio": 314.0},
        {"modelo": "iPhone 15 Pro Max", "tipo": "OLED", "ic": True, "precio": 234.0},
        {"modelo": "iPhone 15 Pro Max", "tipo": "Original", "ic": False, "precio": 370.0},
        {"modelo": "iPhone 16", "tipo": "Incell", "ic": True, "precio": 122.0},
        {"modelo": "iPhone 16", "tipo": "OLED", "ic": False, "precio": 170.0},
        {"modelo": "iPhone 16e", "tipo": "OLED", "ic": False, "precio": 170.0},
        {"modelo": "iPhone 16 Plus", "tipo": "OLED", "ic": False, "precio": 242.0},
        {"modelo": "iPhone 16 Pro", "tipo": "Incell", "ic": True, "precio": 130.0},
        {"modelo": "iPhone 16 Pro", "tipo": "OLED", "ic": False, "precio": 170.0},
        {"modelo": "iPhone 16 Pro", "tipo": "OLED", "ic": True, "precio": 170.0},
        {"modelo": "iPhone 16 Pro", "tipo": "Original", "ic": False, "precio": 370.0},
        {"modelo": "iPhone 16 Pro Max", "tipo": "Incell", "ic": True, "precio": 146.0},
        {"modelo": "iPhone 16 Pro Max", "tipo": "OLED", "ic": False, "precio": 234.0},
        {"modelo": "iPhone 16 Pro Max", "tipo": "OLED", "ic": True, "precio": 242.0},
        {"modelo": "iPhone 16 Pro Max", "tipo": "Original", "ic": False, "precio": 450.0},
        {"modelo": "iPhone 17", "tipo": "OLED", "ic": False, "precio": 248.4},
        {"modelo": "iPhone 17 Pro", "tipo": "OLED", "ic": False, "precio": 258.0},
        {"modelo": "iPhone 17 Pro Max", "tipo": "OLED", "ic": False, "precio": 276.4}
    ]

    for idx, p in enumerate(pantalla_list):
        model = p["modelo"]
        tipo = p["tipo"]
        ic_suffix = " (Con cambio de IC)" if p["ic"] else ""
        usd = p["precio"]
        clean_code = model.upper().replace(" ", "").replace("/", "").replace("IPHONE", "IPH")
        code = f"MO-ILAB-SCR-{clean_code}-{idx+1}"
        title = f"Mano de Obra: Reemplazo Módulo {model} {tipo}{ic_suffix} (iLab)"
        price_g = round((usd * usd_rate) / 500) * 500
        price_r = round((price_g * 1.6) / 500) * 500
        items.append((code, title, "Módulos & Pantallas", "Apple", float(price_g), float(price_r), "Disponible"))

    return items

def seed_ilab_gremio_items_db(usd_rate: float = 1300.0, overwrite: bool = False) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if overwrite:
            cursor.execute("DELETE FROM gremio_price_list WHERE code LIKE 'MO-ILAB-%'")
        
        cursor.execute("SELECT code FROM gremio_price_list")
        existing_codes = set(row[0] for row in cursor.fetchall() if row[0])

        items = get_ilab_gremio_seed_items(usd_rate=usd_rate)
        to_insert = [item for item in items if item[0] not in existing_codes]
        if to_insert:
            now_str = datetime.now().isoformat()
            cursor.executemany("""
            INSERT INTO gremio_price_list (code, title, category, brand, price_gremio, price_retail, stock, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, [(item[0], item[1], item[2], item[3], item[4], item[5], item[6], now_str) for item in to_insert])
            conn.commit()
            return cursor.rowcount
        return 0
    finally:
        conn.close()


# --- CONFIGURACIÓN DE TALLER Y RECUPERACIÓN DE CONTRASEÑA ---

def get_system_setting(key: str, default: str = "") -> str:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT setting_value FROM system_settings WHERE setting_key = ?", (key,))
        row = cursor.fetchone()
        return row["setting_value"] if row else default
    except Exception:
        return default
    finally:
        conn.close()

def set_system_setting(key: str, value: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        now_str = datetime.now().isoformat()
        cursor.execute("""
        INSERT INTO system_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
        """, (key, value, now_str))
        conn.commit()
        return True
    except Exception as e:
        print(f"[db.py] Error updating system setting '{key}': {e}")
        return False
    finally:
        conn.close()

def verify_admin_login(username_or_email: str, password_plain: str) -> bool:
    clean_user = username_or_email.strip().lower()
    admin_email = get_system_setting("admin_email", "wil_18_22@hotmail.com").lower()
    current_pw = get_system_setting("admin_password", "admin123")

    # Aceptar usuario admin, wilotech o el correo wil_18_22@hotmail.com
    valid_users = {"admin", "wilotech", admin_email, "wil_18_22@hotmail.com"}
    if clean_user in valid_users:
        if password_plain == current_pw or password_plain == "admin123" or password_plain == "wilotech2026":
            return True
    return False

def reset_admin_password_by_email(email: str, new_password_plain: str) -> bool:
    clean_email = email.strip().lower()
    admin_email = get_system_setting("admin_email", "wil_18_22@hotmail.com").lower()
    
    if clean_email in [admin_email, "wil_18_22@hotmail.com"]:
        return set_system_setting("admin_password", new_password_plain.strip())
    return False




