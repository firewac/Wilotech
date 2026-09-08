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
    delete_excel_catalog
)
from backend.database.models import (
    DistributorConfig,
    DistributorResponse,
    SearchResponse
)
from backend.parsers.excel_parser import parse_price_list_file
from backend.services.currency_service import CurrencyService
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

# Rutas estáticas
STATIC_DIR = BASE_DIR / "frontend" / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Servidor backend activo. El frontend está en /static/index.html"}

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
        "preview": items[:5]
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
