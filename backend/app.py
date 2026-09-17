import re
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Response, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

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
    seed_iphone_gremio_items_db,
    seed_ilab_gremio_items_db,
    verify_admin_login,
    reset_admin_password_by_email,
    get_system_setting
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
from backend.scrapers.manager import ScraperManager
from backend.exporters.excel_exporter import export_results_to_excel, export_results_to_csv

# Inicializar Base de Datos SQLite al arrancar
init_db()

app = FastAPI(
    title="Comparador Inteligente de Repuestos Multidistribuidora",
    description="Motor de búsqueda, comparación de precios y stock en tiempo real con autenticación de distribuidores.",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Permitir embebido en iframe desde TechFix Pro y orígenes locales (http, https y file:///)
@app.middleware("http")
async def add_iframe_headers(request, call_next):
    response = await call_next(request)
    if "x-frame-options" in response.headers:
        del response.headers["x-frame-options"]
    response.headers["Content-Security-Policy"] = "frame-ancestors 'self' * file: http: https:"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
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

@app.get("/")
@app.get("/index.html")
@app.get("/index")
async def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Servidor backend activo."}

@app.get("/admin.html")
@app.get("/admin")
async def admin_page():
    admin_file = STATIC_DIR / "admin.html"
    if admin_file.exists():
        return FileResponse(str(admin_file))
    raise HTTPException(status_code=404, detail="Página admin.html no encontrada")

@app.get("/comparador.html")
@app.get("/comparador")
async def comparador_page():
    comp_file = STATIC_DIR / "comparador.html"
    if comp_file.exists():
        return FileResponse(str(comp_file))
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
        "message": "Registro exitoso. Ya puedes acceder al Sector de Gremios.",
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
    
    if user_data.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Tu cuenta de gremio ha sido desactivada por la administración del taller")
    
    user_info = {
        "id": user_data["id"],
        "name": user_data["name"],
        "email": user_data["email"],
        "phone": user_data["phone"],
        "status": user_data["status"],
        "created_at": user_data["created_at"]
    }
    
    return {
        "status": "ok",
        "message": f"Bienvenido/a {user_data['name']}",
        "user": user_info
    }

@app.get("/api/gremios/users")
async def gremios_list_users_endpoint():
    return list_gremio_users()

@app.put("/api/gremios/users/{user_id}/status")
async def gremios_update_user_status_endpoint(user_id: int, payload: Dict[str, Any]):
    new_status = payload.get("status", "active")
    if new_status not in ["active", "disabled"]:
        raise HTTPException(status_code=400, detail="Estado no válido")
    success = update_gremio_user_status(user_id, new_status)
    if not success:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"status": "ok", "message": f"Estado actualizado a '{new_status}'"}

@app.get("/api/gremios/price-list")
async def gremios_get_price_list_endpoint(
    q: Optional[str] = Query(None, description="Búsqueda por código, título o marca"),
    category: Optional[str] = Query(None, description="Categoría de repuesto/servicio")
):
    return list_gremio_price_items(query=q, category=category)

@app.post("/api/gremios/price-list")
async def gremios_save_price_item_endpoint(item: Dict[str, Any]):
    if not item.get("title") or item.get("price_gremio") is None:
        raise HTTPException(status_code=400, detail="Título y Precio Gremio son obligatorios")
    saved = upsert_gremio_price_item(item)
    return {"status": "ok", "message": f"Ítem '{saved['title']}' guardado.", "item": saved}

@app.put("/api/gremios/price-list/{item_id}")
async def gremios_update_price_item_endpoint(item_id: int, item: Dict[str, Any]):
    item["id"] = item_id
    if not item.get("title") or item.get("price_gremio") is None:
        raise HTTPException(status_code=400, detail="Título y Precio Gremio son obligatorios")
    saved = upsert_gremio_price_item(item)
    return {"status": "ok", "message": f"Ítem '{saved['title']}' actualizado.", "item": saved}

@app.delete("/api/gremios/price-list/{item_id}")
async def gremios_delete_price_item_endpoint(item_id: int):
    deleted = delete_gremio_price_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    return {"status": "ok", "message": "Ítem eliminado de la lista de gremios"}

@app.post("/api/gremios/price-list/seed-iphone")
async def gremios_seed_iphone_endpoint():
    inserted = seed_iphone_gremio_items_db(overwrite=False)
    return {"status": "ok", "message": f"Se sincronizaron los precios de mano de obra para iPhone 11 a 17 Pro Max ({inserted} ítems nuevos agregados)."}

@app.post("/api/gremios/price-list/import-ilab")
async def gremios_import_ilab_endpoint(payload: Optional[Dict[str, Any]] = None):
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
async def admin_login_endpoint(payload: Dict[str, Any]):
    username = payload.get("username", "")
    password = payload.get("password", "")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Usuario/email y contraseña son requeridos")
        
    if verify_admin_login(username, password):
        return {"status": "ok", "message": "Inicio de sesión de taller correcto"}
    raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

@app.post("/api/admin/recover-verify")
async def admin_recover_verify_endpoint(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    admin_email = get_system_setting("admin_email", "wil_18_22@hotmail.com").lower()
    
    if email in [admin_email, "wil_18_22@hotmail.com"]:
        return {
            "status": "ok",
            "message": "Correo electrónico verificado. Autorizado para restablecer la contraseña.",
            "authorized_email": "wil_18_22@hotmail.com"
        }
    raise HTTPException(status_code=404, detail="El correo ingresado no coincide con el correo autorizado del taller (wil_18_22@hotmail.com).")

@app.post("/api/admin/reset-password")
async def admin_reset_password_endpoint(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    new_password = (payload.get("new_password") or "").strip()
    
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Correo y nueva contraseña son obligatorios")
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 4 caracteres")
        
    success = reset_admin_password_by_email(email, new_password)
    if success:
        return {"status": "ok", "message": "Contraseña del Panel de Taller actualizada exitosamente."}
    raise HTTPException(status_code=403, detail="No autorizado para restablecer la contraseña del taller.")




# --- DISTRIBUIDORAS ---

@app.get("/api/distributors", response_model=List[DistributorResponse])
async def get_distributors(only_active: bool = False):
    return list_distributors(only_active=only_active)

@app.post("/api/distributors")
async def save_distributor_endpoint(dist: DistributorConfig):
    success = upsert_distributor(dist)
    if not success:
        raise HTTPException(status_code=400, detail="No se pudo guardar la distribuidora")
    return {"status": "ok", "message": f"Distribuidora '{dist.name}' guardada exitosamente."}

@app.delete("/api/distributors/{dist_id}")
async def remove_distributor(dist_id: str):
    deleted = delete_distributor(dist_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Distribuidora no encontrada")
    return {"status": "ok", "message": "Distribuidora eliminada."}

@app.post("/api/distributors/{dist_id}/test-login")
async def test_login_endpoint(dist_id: str):
    result = await ScraperManager.test_login(dist_id)
    return result

# --- CATÁLOGOS EXCEL / CSV ---

@app.get("/api/catalogs/excel")
async def get_excel_catalogs_endpoint():
    return list_excel_catalogs()

@app.post("/api/catalogs/excel/upload")
async def upload_excel_catalog_endpoint(
    file: UploadFile = File(...),
    name: str = Form(...),
    currency: str = Form("ARS")
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No se seleccionó ningún archivo.")
    
    clean_name = name.strip()
    if not clean_name:
        clean_name = Path(file.filename).stem

    # Generar un ID seguro para la distribuidora
    slug = re.sub(r"[^\w]", "_", clean_name.lower())
    catalog_id = f"excel_{slug}"

    try:
        content = await file.read()
        items, metadata = parse_price_list_file(content, file.filename, default_currency=currency)
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
async def restore_excel_catalog_endpoint(payload: Dict[str, Any]):
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
async def remove_excel_catalog_endpoint(catalog_id: str):
    deleted = delete_excel_catalog(catalog_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Catálogo no encontrado.")
    return {"status": "ok", "message": "Catálogo Excel y sus productos eliminados."}

# --- COTIZACIÓN DÓLAR BLUE ---

@app.get("/api/currency/dolar-blue")
async def get_dolar_blue_endpoint():
    return await CurrencyService.get_dolar_blue_info()

@app.post("/api/currency/dolar-blue")
async def set_dolar_blue_endpoint(payload: Dict[str, Any]):
    rate = payload.get("rate")
    CurrencyService.set_custom_rate(rate)
    return await CurrencyService.get_dolar_blue_info(force_refresh=True)

# --- CONSULTA DE IMEI Y RECONOCIMIENTO DE DISPOSITIVOS ---

@app.get("/api/imei/lookup")
async def imei_lookup_endpoint(imei: str = Query(..., min_length=1, description="IMEI o TAC de 8 a 15 dígitos")):
    return IMEIService.lookup_imei(imei)

# --- ÓRDENES Y EQUIPOS DE TALLER ---

@app.get("/api/tickets")
async def list_tickets_endpoint(q: Optional[str] = Query(None, description="Término de búsqueda: ID, cliente, IMEI, DNI o teléfono")):
    return TicketStore.get_all(query=q)

@app.get("/api/tickets/{ticket_id}")
async def get_ticket_endpoint(ticket_id: str):
    t = TicketStore.get_by_id(ticket_id)
    if not t:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return t

@app.post("/api/tickets")
async def save_ticket_endpoint(ticket: Dict[str, Any]):
    if not ticket or not ticket.get("id"):
        raise HTTPException(status_code=400, detail="ID de ticket requerido")
    success = TicketStore.save_ticket(ticket)
    if not success:
        raise HTTPException(status_code=500, detail="Error al guardar la orden en la base de datos")
    return {"status": "ok", "message": f"Orden #{ticket.get('id')} guardada exitosamente.", "ticket": ticket}

@app.post("/api/tickets/bulk")
async def save_bulk_tickets_endpoint(tickets: List[Dict[str, Any]]):
    if not tickets or not isinstance(tickets, list):
        return {"status": "ok", "count": 0}
    count = TicketStore.save_bulk(tickets)
    return {"status": "ok", "message": f"{count} órdenes sincronizadas con el servidor.", "count": count}

@app.delete("/api/tickets/{ticket_id}")
async def delete_ticket_endpoint(ticket_id: str):
    deleted = TicketStore.delete_ticket(ticket_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return {"status": "ok", "message": f"Orden #{ticket_id} eliminada."}

# --- BÚSQUEDA Y COMPARACIÓN ---

@app.get("/api/search", response_model=SearchResponse)
async def search_endpoint(
    q: str = Query(..., min_length=1, description="Código de repuesto, SKU, marca o descripción"),
    distributors: Optional[str] = Query(None, description="IDs de distribuidoras separados por coma")
):
    target_ids = [d.strip() for d in distributors.split(",") if d.strip()] if distributors else None
    response = await ScraperManager.search_all(query=q, target_distributors=target_ids)
    return response

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
