import re
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Response, UploadFile, File, Form, Request, Depends
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from backend.config import BASE_DIR
from backend.database.db import (
    init_db,
    list_distributors,
    upsert_distributor,
    delete_distributor,
    get_recent_history,
    create_or_update_excel_catalog,
    list_excel_catalogs,
    delete_excel_catalog,
    upsert_repair_ticket,
    list_repair_tickets,
    get_repair_ticket_by_id,
    delete_repair_ticket_by_id,
    create_gremio_user,
    get_gremio_user_by_email,
    verify_gremio_password,
    list_gremio_users,
    update_gremio_user_status,
    list_gremio_price_items,
    upsert_gremio_price_item,
    delete_gremio_price_item,
    get_gremio_price_history,
    bulk_update_gremio_prices,
    seed_iphone_gremio_items_db,
    seed_ilab_gremio_items_db,
    verify_admin_login,
    reset_admin_password_by_email,
    get_system_setting,
    get_all_system_settings,
    save_system_settings
)
from backend.database.models import (
    DistributorConfig,
    DistributorResponse,
    SearchResponse,
    GremioRegisterRequest,
    GremioLoginRequest,
    GremioUserResponse,
    GremioPriceItem
)
from backend.services.currency_service import CurrencyService
from backend.services.imei_service import IMEIService
from backend.services.ticket_store import TicketStore
from backend.scrapers.manager import ScraperManager, SearchCache
from backend.exporters.excel_exporter import export_results_to_excel, export_results_to_csv
from datetime import datetime
from backend.services.backup_service import BackupService
from backend.services.security_service import (
    create_access_token,
    decode_access_token,
    RateLimiter,
    PasswordRecoveryStore
)

# Inicializar Base de Datos SQLite al arrancar
init_db()

app = FastAPI(
    title="Comparador Inteligente de Repuestos Multidistribuidora",
    description="Motor de búsqueda, comparación de precios y stock en tiempo real con autenticación y seguridad endurecida.",
    version="1.1.0"
)

# Configuración de Seguridad y Autenticación JWT Bearer
security_bearer = HTTPBearer(auto_error=False)

def get_current_admin(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)):
    """Valida el token JWT de administrador en endpoints protegidos."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Se requiere autenticación de administrador.")
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Token inválido, expirado o sin permisos de taller.")
    return payload

def get_current_gremio(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)):
    """Valida el token JWT para gremios o administradores."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Se requiere autenticación de gremio.")
    payload = decode_access_token(credentials.credentials)
    if not payload or payload.get("role") not in ["gremio", "admin"]:
        raise HTTPException(status_code=403, detail="Acceso denegado a sector gremios.")
    return payload

def get_current_admin_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)) -> Optional[dict]:
    """Retorna los datos del token admin si es válido; None en caso contrario."""
    if not credentials or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if payload and payload.get("role") == "admin":
        return payload
    return None

# CORS Seguro
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Cabeceras de Seguridad HTTP (Anti Clickjacking, Anti Sniffing, CSP)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response



# Rutas estáticas
STATIC_DIR = BASE_DIR / "frontend" / "static"
if not STATIC_DIR.exists():
    try:
        STATIC_DIR.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Montaje de subcarpetas estáticas para soporte de rutas relativas directas
for sub in ["js", "css", "assets"]:
    sub_dir = STATIC_DIR / sub
    if sub_dir.exists():
        app.mount(f"/{sub}", StaticFiles(directory=str(sub_dir)), name=sub)

PAGE_NO_CACHE_HEADERS = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}

@app.get("/")
@app.get("/index.html")
@app.get("/index")
async def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file), headers=PAGE_NO_CACHE_HEADERS)
    return {"message": "Servidor backend activo."}

@app.get("/admin.html")
@app.get("/admin")
async def admin_page():
    admin_file = STATIC_DIR / "admin.html"
    if admin_file.exists():
        return FileResponse(str(admin_file), headers=PAGE_NO_CACHE_HEADERS)
    raise HTTPException(status_code=404, detail="Página admin.html no encontrada")

@app.get("/login.html")
@app.get("/login")
async def login_page():
    login_file = STATIC_DIR / "login.html"
    if login_file.exists():
        return FileResponse(str(login_file), headers=PAGE_NO_CACHE_HEADERS)
    raise HTTPException(status_code=404, detail="Página login.html no encontrada")

@app.get("/presupuesto.html")
@app.get("/presupuesto")
async def presupuesto_page():
    presupuesto_file = STATIC_DIR / "presupuesto.html"
    if presupuesto_file.exists():
        return FileResponse(str(presupuesto_file), headers=PAGE_NO_CACHE_HEADERS)
    raise HTTPException(status_code=404, detail="Página presupuesto.html no encontrada")

@app.get("/comparador.html")
@app.get("/comparador")
async def comparador_page():
    comp_file = STATIC_DIR / "comparador.html"
    if comp_file.exists():
        return FileResponse(str(comp_file), headers=PAGE_NO_CACHE_HEADERS)
    raise HTTPException(status_code=404, detail="Página comparador.html no encontrada")

@app.get("/gremios.html")
@app.get("/gremios")
async def gremios_page():
    gremios_file = STATIC_DIR / "gremios.html"
    if gremios_file.exists():
        return FileResponse(str(gremios_file))
    raise HTTPException(status_code=404, detail="Página gremios.html no encontrada")


# --- SECTOR GREMIOS & PRECIOS ---

@app.post("/api/gremios/register")
async def gremios_register_endpoint(req: GremioRegisterRequest):
    if not req.email or not req.password or not req.name:
        raise HTTPException(status_code=400, detail="Nombre, email y contraseña son obligatorios")
    if len(req.password.strip()) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")
    
    existing = get_gremio_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="El correo electrónico ya se encuentra registrado.")
    
    user = create_gremio_user(
        name=req.name,
        email=req.email,
        phone=req.phone or "",
        password_plain=req.password
    )
    if not user:
        raise HTTPException(status_code=500, detail="No se pudo crear la cuenta de gremio")
    
    return {
        "status": "ok",
        "message": "Registro completado con éxito. Tu cuenta ha quedado PENDIENTE DE ALTA. El administrador del taller habilitará tu ingreso.",
        "user": user
    }

@app.post("/api/gremios/login")
async def gremios_login_endpoint(req: GremioLoginRequest):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email y contraseña son requeridos")
    
    user_data = get_gremio_user_by_email(req.email)
    if not user_data:
        raise HTTPException(status_code=401, detail="Correo electrónico o contraseña incorrectos")
    
    stored_hash = user_data.get("password_hash", "")
    if not verify_gremio_password(req.password.strip(), stored_hash):
        raise HTTPException(status_code=401, detail="Correo electrónico o contraseña incorrectos")
    
    status = user_data.get("status", "pending")
    if status == "pending":
        raise HTTPException(
            status_code=403, 
            detail="Tu registro fue recibido con éxito, pero tu cuenta está PENDIENTE DE ALTA. El administrador del taller debe darte de alta antes de tu ingreso."
        )
    
    if status == "disabled":
        raise HTTPException(
            status_code=403, 
            detail="Tu cuenta de gremio ha sido desactivada por la administración del taller."
        )
    
    user_info = {
        "id": user_data["id"],
        "name": user_data["name"],
        "email": user_data["email"],
        "phone": user_data["phone"],
        "status": user_data["status"],
        "role": user_data.get("role", "gremio"),
        "created_at": user_data["created_at"]
    }
    
    token = create_access_token({
        "sub": user_data["email"],
        "role": user_data.get("role", "gremio"),
        "user_id": user_data["id"]
    })
    
    return {
        "status": "ok",
        "message": f"Bienvenido/a {user_data['name']}",
        "token": token,
        "user": user_info
    }

@app.get("/api/gremios/users")
async def gremios_list_users_endpoint(admin: dict = Depends(get_current_admin)):
    return list_gremio_users()

@app.put("/api/gremios/users/{user_id}/status")
async def gremios_update_user_status_endpoint(user_id: int, payload: Dict[str, Any], request: Request):
    verify_admin_header_permission(request)
    new_status = payload.get("status", "active")
    new_role = payload.get("role")
    if new_status not in ["active", "pending", "disabled"]:
        raise HTTPException(status_code=400, detail="Estado no válido. Use 'active', 'pending' o 'disabled'.")
    if new_role and new_role not in ["gremio", "admin"]:
        raise HTTPException(status_code=400, detail="Rol no válido. Use 'gremio' o 'admin'.")
    success = update_gremio_user_status(user_id, new_status, new_role)
    if not success:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    role_label = "Administrador del Taller" if (new_role == "admin") else "Cliente Gremio"
    msg = f"Dado de Alta como '{role_label}' y Autorizado para Ingreso" if new_status == "active" else f"Estado actualizado a '{new_status}' ({role_label})"
    return {"status": "ok", "message": f"Usuario {msg} exitosamente."}

def verify_admin_header_permission(request: Request, payload: Dict[str, Any] = None):
    """Valida token JWT de administrador en cabeceras HTTP."""
    auth_hdr = request.headers.get("Authorization", "")
    token = ""
    if auth_hdr.startswith("Bearer "):
        token = auth_hdr[7:].strip()
    elif request.headers.get("X-Auth-Token"):
        token = request.headers.get("X-Auth-Token", "").strip()

    if token:
        decoded = decode_access_token(token)
        if decoded and decoded.get("role") == "admin":
            return True

    raise HTTPException(
        status_code=403, 
        detail="Acceso Denegado: Se requiere autenticación válida con token de administrador."
    )

@app.get("/api/gremios/price-list")
async def gremios_get_price_list_endpoint(
    q: Optional[str] = Query(None, description="Búsqueda por código, título o marca"),
    category: Optional[str] = Query(None, description="Categoría de repuesto/servicio")
):
    return list_gremio_price_items(query=q, category=category)

@app.post("/api/gremios/price-list")
async def gremios_save_price_item_endpoint(item: Dict[str, Any], request: Request):
    verify_admin_header_permission(request, item)
    if not item.get("title") or item.get("price_gremio") is None:
        raise HTTPException(status_code=400, detail="Título y Precio Gremio son obligatorios")
    saved = upsert_gremio_price_item(item)
    return {"status": "ok", "message": f"Ítem '{saved['title']}' guardado.", "item": saved}

@app.put("/api/gremios/price-list/{item_id}")
async def gremios_update_price_item_endpoint(item_id: int, item: Dict[str, Any], request: Request):
    verify_admin_header_permission(request, item)
    item["id"] = item_id
    if not item.get("title") or item.get("price_gremio") is None:
        raise HTTPException(status_code=400, detail="Título y Precio Gremio son obligatorios")
    saved = upsert_gremio_price_item(item)
    return {"status": "ok", "message": f"Ítem '{saved['title']}' actualizado.", "item": saved}

@app.delete("/api/gremios/price-list/{item_id}")
async def gremios_delete_price_item_endpoint(item_id: int, request: Request):
    verify_admin_header_permission(request)
    deleted = delete_gremio_price_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    return {"status": "ok", "message": "Ítem eliminado de la lista de gremios"}

@app.get("/api/gremios/price-list/history")
async def gremios_price_history_endpoint(limit: int = Query(50, ge=1, le=200)):
    return get_gremio_price_history(limit=limit)

@app.post("/api/gremios/price-list/bulk-update")
async def gremios_price_bulk_update_endpoint(payload: Dict[str, Any], request: Request):
    verify_admin_header_permission(request, payload)
    item_ids = payload.get("item_ids", [])
    action_type = payload.get("action_type", "percent_add")
    amount = float(payload.get("amount", 0.0))
    usd_rate = float(payload.get("usd_rate", 1555.0))
    changed_by = payload.get("changed_by", "Administrador")

    if not item_ids or amount == 0:
        raise HTTPException(status_code=400, detail="Debe seleccionar al menos un ítem y un monto diferente de 0.")

    updated_count = bulk_update_gremio_prices(
        item_ids=item_ids,
        action_type=action_type,
        amount=amount,
        usd_rate=usd_rate,
        changed_by=changed_by
    )
    return {"status": "ok", "message": f"Se actualizaron {updated_count} precios exitosamente.", "updated_count": updated_count}

@app.post("/api/gremios/price-list/seed-iphone")
async def gremios_seed_iphone_endpoint(request: Request):
    verify_admin_header_permission(request)
    inserted = seed_iphone_gremio_items_db(overwrite=False)
    return {"status": "ok", "message": f"Se sincronizaron los precios de mano de obra para iPhone 11 a 17 Pro Max ({inserted} ítems nuevos agregados)."}

@app.post("/api/gremios/price-list/import-ilab")
async def gremios_import_ilab_endpoint(request: Request, payload: Optional[Dict[str, Any]] = None):
    verify_admin_header_permission(request)
    rate = 1300.0
    if payload and payload.get("usd_rate"):
        try:
            rate = float(payload["usd_rate"])
        except ValueError:
            rate = 1300.0
    inserted = seed_ilab_gremio_items_db(usd_rate=rate, overwrite=False)
    return {"status": "ok", "message": f"Se importaron {inserted} tarifas basadas en iLab (cotización ref. ${rate} ARS/USD)."}


# --- AUTENTICACIÓN Y RECUPERACIÓN DE PANEL DE TALLER ---

@app.post("/api/admin/login")
async def admin_login_endpoint(request: Request, payload: Dict[str, Any]):
    client_ip = request.client.host if request.client else "unknown"
    allowed, wait_sec = RateLimiter.check(client_ip, "admin_login", max_attempts=5, window_seconds=300)
    if not allowed:
        raise HTTPException(
            status_code=429, 
            detail=f"Demasiados intentos fallidos. Por seguridad, intente nuevamente en {wait_sec} segundos."
        )

    username = (payload.get("username") or "").strip()
    password = (payload.get("password") or "").strip()
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Usuario/email y contraseña son requeridos")
        
    if verify_admin_login(username, password):
        token = create_access_token({"sub": username, "role": "admin"})
        return {
            "status": "ok", 
            "message": "Inicio de sesión de taller correcto",
            "token": token
        }
    raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

@app.post("/api/admin/recover-verify")
async def admin_recover_verify_endpoint(request: Request, payload: Dict[str, Any]):
    client_ip = request.client.host if request.client else "unknown"
    allowed, wait_sec = RateLimiter.check(client_ip, "admin_recover", max_attempts=3, window_seconds=600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Límite de solicitudes alcanzado. Reintente en {wait_sec}s.")

    email = (payload.get("email") or "").strip().lower()
    admin_email = get_system_setting("admin_email", "wil_18_22@hotmail.com").lower()
    
    # Verificación estricta del correo autorizado
    if email in [admin_email, "wil_18_22@hotmail.com"]:
        recovery_token = PasswordRecoveryStore.create_token(email)
        return {
            "status": "ok",
            "message": "Correo verificado. Token de recuperación temporal generado (válido por 15 minutos).",
            "authorized": True,
            "recovery_token": recovery_token
        }
    raise HTTPException(status_code=404, detail="El correo ingresado no coincide con el correo autorizado del taller.")

@app.post("/api/admin/reset-password")
async def admin_reset_password_endpoint(request: Request, payload: Dict[str, Any]):
    client_ip = request.client.host if request.client else "unknown"
    allowed, wait_sec = RateLimiter.check(client_ip, "admin_reset", max_attempts=3, window_seconds=600)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Límite de solicitudes alcanzado. Reintente en {wait_sec}s.")

    email = (payload.get("email") or "").strip().lower()
    new_password = (payload.get("new_password") or "").strip()
    recovery_token = (payload.get("recovery_token") or "").strip()
    
    if not email or not new_password or not recovery_token:
        raise HTTPException(status_code=400, detail="Correo, nueva contraseña y token de recuperación son obligatorios")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
        
    if not PasswordRecoveryStore.verify_and_consume(recovery_token, email):
        raise HTTPException(status_code=403, detail="Token de recuperación inválido, expirado o ya utilizado.")

    success = reset_admin_password_by_email(email, new_password)
    if success:
        return {"status": "ok", "message": "Contraseña del Panel de Taller actualizada exitosamente."}
    raise HTTPException(status_code=403, detail="No autorizado para restablecer la contraseña del taller.")


# --- DISTRIBUIDORAS ---

@app.get("/api/distributors", response_model=List[DistributorResponse])
async def get_distributors(only_active: bool = False):
    return list_distributors(only_active=only_active)

@app.post("/api/distributors")
async def save_distributor_endpoint(dist: DistributorConfig, admin: dict = Depends(get_current_admin)):
    success = upsert_distributor(dist)
    if not success:
        raise HTTPException(status_code=400, detail="No se pudo guardar la distribuidora")
    return {"status": "ok", "message": f"Distribuidora '{dist.name}' guardada exitosamente."}

@app.delete("/api/distributors/{dist_id}")
async def remove_distributor(dist_id: str, admin: dict = Depends(get_current_admin)):
    deleted = delete_distributor(dist_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Distribuidora no encontrada")
    return {"status": "ok", "message": "Distribuidora eliminada."}

@app.post("/api/distributors/{dist_id}/test-login")
async def test_login_endpoint(dist_id: str, admin: dict = Depends(get_current_admin)):
    result = await ScraperManager.test_login(dist_id)
    return result

@app.get("/api/distributors/health")
async def distributors_health_endpoint():
    return await ScraperManager.check_all_health()

# --- COPIAS DE SEGURIDAD Y RESPALDOS (BACKUPS) ---

@app.get("/api/backup/download")
async def download_backup_endpoint(admin: dict = Depends(get_current_admin)):
    zip_bytes = BackupService.create_backup_zip()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=wilotech_backup_{timestamp}.zip"}
    )

@app.get("/api/backup/list")
async def list_backups_endpoint(admin: dict = Depends(get_current_admin)):
    return BackupService.list_backups()

@app.post("/api/backup/restore")
async def restore_backup_endpoint(
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se seleccionó ningún archivo de respaldo.")
    
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="El archivo debe ser un paquete .zip de respaldo de Wilotech.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo permitido (50 MB).")

    try:
        result = BackupService.restore_from_zip(content)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al restaurar: {str(e)}")

# --- CATÁLOGOS EXCEL / CSV ---

@app.get("/api/catalogs/excel")
async def get_excel_catalogs_endpoint():
    return list_excel_catalogs()

@app.post("/api/catalogs/excel/upload")
async def upload_excel_catalog_endpoint(
    file: UploadFile = File(...),
    name: str = Form(...),
    currency: str = Form("ARS"),
    admin: dict = Depends(get_current_admin)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se seleccionó ningún archivo.")
    
    ext = Path(file.filename).suffix.lower()
    if ext not in [".xlsx", ".xls", ".csv"]:
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Se admiten únicamente planillas .xlsx, .xls o .csv")

    clean_name = name.strip()
    if not clean_name:
        clean_name = Path(file.filename).stem

    # Generar un ID seguro para la distribuidora
    slug = re.sub(r"[^\w]", "_", clean_name.lower())[:50]
    catalog_id = f"excel_{slug}"

    try:
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="El archivo excede el tamaño máximo permitido de 15 MB.")
        items, metadata = parse_price_list_file(content, file.filename, default_currency=currency)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer la planilla Excel/CSV: {str(e)}")

    if not items:
        raise HTTPException(status_code=400, detail="No se encontraron repuestos con precio válido en el archivo.")

    catalog_data = create_or_update_excel_catalog(
        catalog_id=catalog_id,
        name=clean_name,
        filename=file.filename,
        currency=currency,
        items=items
    )

    return {
        "status": "ok",
        "message": f"Lista '{clean_name}' procesada e importada con éxito ({len(items)} repuestos).",
        "catalog": catalog_data,
        "metadata": metadata,
        "items": items,
        "preview": items[:5]
    }

@app.post("/api/catalogs/excel/restore")
async def restore_excel_catalog_endpoint(payload: Dict[str, Any], admin: dict = Depends(get_current_admin)):
    catalog_id = payload.get("catalog_id")
    name = payload.get("name")
    filename = payload.get("filename", "catalog.xlsx")
    currency = payload.get("currency", "ARS")
    items = payload.get("items", [])

    if not catalog_id or not name or not items:
        raise HTTPException(status_code=400, detail="Datos incompletos para restaurar catálogo.")

    catalog_data = create_or_update_excel_catalog(
        catalog_id=catalog_id,
        name=name,
        filename=filename,
        currency=currency,
        items=items
    )
    return {
        "status": "ok",
        "message": f"Catálogo '{name}' restaurado con éxito.",
        "catalog": catalog_data
    }

@app.delete("/api/catalogs/excel/{catalog_id}")
async def remove_excel_catalog_endpoint(catalog_id: str, admin: dict = Depends(get_current_admin)):
    deleted = delete_excel_catalog(catalog_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado.")
    return {"status": "ok", "message": "Catálogo Excel y sus productos eliminados."}

# --- COTIZACIÓN DÓLAR BLUE ---

@app.get("/api/currency/dolar-blue")
async def get_dolar_blue_endpoint():
    return await CurrencyService.get_dolar_blue_info()

@app.post("/api/currency/dolar-blue")
async def set_dolar_blue_endpoint(payload: Dict[str, Any], admin: dict = Depends(get_current_admin)):
    rate = payload.get("rate")
    CurrencyService.set_custom_rate(rate)
    return await CurrencyService.get_dolar_blue_info(force_refresh=True)

# --- CONSULTA DE IMEI Y RECONOCIMIENTO DE DISPOSITIVOS ---

@app.get("/api/imei/lookup")
async def imei_lookup_endpoint(imei: str = Query(..., min_length=1, description="IMEI o TAC de 8 a 15 dígitos")):
    return IMEIService.lookup_imei(imei)

# --- ÓRDENES Y EQUIPOS DE TALLER ---

@app.get("/api/tickets")
async def list_tickets_endpoint(
    q: Optional[str] = Query(None, description="Término de búsqueda: ID, cliente, IMEI, DNI o teléfono"),
    admin: Optional[dict] = Depends(get_current_admin_optional)
):
    # Si no es administrador y no busca por término específico, denegar para impedir volcado masivo de clientes
    if not admin:
        if not q or len(q.strip()) < 3:
            raise HTTPException(
                status_code=401, 
                detail="Se requiere autenticación de administrador para listar todas las órdenes del taller."
            )
    return TicketStore.get_all(query=q)

@app.get("/api/tickets/{ticket_id}")
async def get_ticket_endpoint(ticket_id: str):
    t = TicketStore.get_by_id(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return t

@app.post("/api/tickets")
async def save_ticket_endpoint(
    ticket: Dict[str, Any],
    admin: Optional[dict] = Depends(get_current_admin_optional)
):
    if not ticket or not ticket.get("id"):
        raise HTTPException(status_code=400, detail="ID de ticket requerido")
    
    # Si no es admin, solo se permite aprobar o rechazar un presupuesto existente (para clientes en presupuesto.html)
    if not admin:
        ticket_id = str(ticket.get("id"))
        existing = TicketStore.get_by_id(ticket_id)
        if not existing:
            raise HTTPException(
                status_code=401, 
                detail="Se requiere inicio de sesión administrativo para crear nuevas órdenes."
            )
        new_status = ticket.get("status")
        if new_status not in ["approved", "rejected"]:
            raise HTTPException(
                status_code=403, 
                detail="Operación no autorizada: Solo se permite la aprobación o rechazo del presupuesto."
            )
        existing["status"] = new_status
        if "statusStep" in ticket:
            existing["statusStep"] = ticket["statusStep"]
        success = TicketStore.save_ticket(existing)
        if not success:
            raise HTTPException(status_code=500, detail="Error al actualizar estado del ticket")
        return {"status": "ok", "message": f"Presupuesto de la orden #{ticket_id} actualizado.", "ticket": existing}

    success = TicketStore.save_ticket(ticket)
    if not success:
        raise HTTPException(status_code=500, detail="Error al guardar la orden en la base de datos")
    return {"status": "ok", "message": f"Orden #{ticket.get('id')} guardada exitosamente.", "ticket": ticket}

@app.post("/api/tickets/bulk")
async def save_bulk_tickets_endpoint(tickets: List[Dict[str, Any]], admin: dict = Depends(get_current_admin)):
    if not tickets or not isinstance(tickets, list):
        return {"status": "ok", "count": 0}
    count = TicketStore.save_bulk(tickets)
    return {"status": "ok", "message": f"{count} órdenes sincronizadas con el servidor.", "count": count}

@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket_endpoint(ticket_id: str, admin: dict = Depends(get_current_admin)):
    deleted = TicketStore.delete_ticket(ticket_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return {"status": "ok", "message": f"Orden #{ticket_id} eliminada."}

# --- CONFIGURACIÓN GENERAL DEL TALLER & NEGOCIO ---

@app.get("/api/settings")
async def get_settings_endpoint():
    return get_all_system_settings()

@app.post("/api/settings")
async def save_settings_endpoint(payload: Dict[str, Any], admin: dict = Depends(get_current_admin)):
    success = save_system_settings(payload)
    if not success:
        raise HTTPException(status_code=500, detail="Error al guardar la configuración del taller.")
    return {"status": "ok", "message": "Configuración del taller guardada exitosamente.", "settings": get_all_system_settings()}

# --- BÚSQUEDA Y COMPARACIÓN ---

@app.get("/api/search", response_model=SearchResponse)
async def search_endpoint(
    q: str = Query(..., min_length=1, description="Código de repuesto, SKU, marca o descripción"),
    distributors: Optional[str] = Query(None, description="IDs de distribuidoras separados por coma")
):
    target_ids = [d.strip() for d in distributors.split(",") if d.strip()] if distributors else None
    response = await ScraperManager.search_all(query=q, target_distributors=target_ids)
    return response

@app.post("/api/search/clear-cache")
async def clear_search_cache_endpoint():
    SearchCache.clear()
    return {"status": "ok", "message": "Caché de búsquedas vaciada con éxito."}

@app.post("/api/presupuesto/calcular")
async def calcular_presupuesto_endpoint(payload: Dict[str, Any]):
    try:
        costo_repuesto = float(payload.get("costo_repuesto", 0))
    except (ValueError, TypeError):
        costo_repuesto = 0.0
    try:
        mano_obra = float(payload.get("mano_obra", 0))
    except (ValueError, TypeError):
        mano_obra = 0.0
    try:
        margen_pct = float(payload.get("margen_pct", 0))
    except (ValueError, TypeError):
        margen_pct = 0.0

    concepto = str(payload.get("concepto", "Reparación Técnica")).strip()
    equipo = str(payload.get("equipo", "Dispositivo Móvil / PC")).strip()

    subtotal = (costo_repuesto * (1.0 + (margen_pct / 100.0))) + mano_obra
    total = round(subtotal, 2)

    wa_message = (
        f"🛠️ *WILOTECH - Presupuesto Técnico Oficial*\n"
        f"📱 *Equipo:* {equipo}\n"
        f"🔧 *Repuesto / Servicio:* {concepto}\n"
        f"💵 *Total Estimado:* ${total:,.2f} ARS\n"
        f"⏱️ *Garantía:* 30 días en mano de obra y repuesto.\n"
        f"🔬 *Laboratorio:* Nivel 3 y 4 con instrumental de precisión."
    )

    return {
        "status": "ok",
        "costo_repuesto": costo_repuesto,
        "mano_obra": mano_obra,
        "margen_pct": margen_pct,
        "total": total,
        "whatsapp_message": wa_message
    }

@app.get("/api/history")
async def history_endpoint():
    return get_recent_history(limit=12)

# --- EXPORTACIÓN ---

@app.get("/api/export/excel")
async def export_excel_endpoint(q: str = Query(..., min_length=1)):
    resp = await ScraperManager.search_all(query=q)
    if not resp.results:
        raise HTTPException(status_code=404, detail="No se encontraron repuestos para exportar.")
    
    excel_stream = export_results_to_excel(resp.results, query=q)
    filename = f"comparativa_{q.replace(' ', '_')}.xlsx"
    
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/export/csv")
async def export_csv_endpoint(q: str = Query(..., min_length=1)):
    resp = await ScraperManager.search_all(query=q)
    if not resp.results:
        raise HTTPException(status_code=404, detail="No se encontraron repuestos para exportar.")
    
    csv_stream = export_results_to_csv(resp.results)
    filename = f"comparativa_{q.replace(' ', '_')}.csv"
    
    return Response(
        content=csv_stream.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- MONTAR ARCHIVOS ESTÁTICOS Y PÁGINAS HTML DEL FRONTEND ---
try:
    STATIC_DIR = BASE_DIR / "frontend" / "static"
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static_files")
except Exception:
    pass
