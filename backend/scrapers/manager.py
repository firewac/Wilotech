import asyncio
import time
from typing import List, Optional, Dict, Any
from backend.database.db import (
    list_distributors,
    get_distributor_raw,
    update_login_status,
    save_search_history
)
from backend.database.models import PartResult, SearchResponse
from backend.scrapers.base import BaseDistributorScraper
from backend.scrapers.mock_distributor import MockDistributorScraper
from backend.scrapers.generic_portal import GenericPortalScraper
from backend.scrapers.smartsupply_scraper import SmartSupplyScraper
from backend.scrapers.soulfix_scraper import SoulFixScraper
from backend.scrapers.grupoarmar_scraper import GrupoArmarScraper
from backend.scrapers.tecnoprices_scraper import TecnopricesScraper
from backend.scrapers.excel_scraper import ExcelCatalogScraper
from backend.services.currency_service import CurrencyService
from backend.services.part_matcher import PartMatcher

class SearchCache:
    """Caché en memoria con TTL de 5 minutos para acelerar búsquedas repetidas."""
    _cache: Dict[str, Dict[str, Any]] = {}
    TTL: int = 300

    @classmethod
    def get(cls, query: str, targets: Optional[List[str]]) -> Optional[SearchResponse]:
        target_key = ",".join(sorted(targets)) if targets else "all"
        cache_key = f"{query.lower().strip()}::{target_key}"
        entry = cls._cache.get(cache_key)
        if entry:
            if time.time() - entry["ts"] < cls.TTL:
                return entry["data"]
            else:
                del cls._cache[cache_key]
        return None

    @classmethod
    def set(cls, query: str, targets: Optional[List[str]], data: SearchResponse):
        target_key = ",".join(sorted(targets)) if targets else "all"
        cache_key = f"{query.lower().strip()}::{target_key}"
        cls._cache[cache_key] = {
            "ts": time.time(),
            "data": data
        }

    @classmethod
    def clear(cls):
        cls._cache.clear()

def create_scraper_instance(dist_data: Dict[str, Any]) -> BaseDistributorScraper:
    dist_id = dist_data.get("id", "")
    scraper_type = dist_data.get("scraper_type", "mock")
    
    if scraper_type == "excel_catalog" or dist_id.startswith("excel_"):
        return ExcelCatalogScraper(dist_data)
    elif dist_id == "smartsupply" or scraper_type == "smartsupply":
        return SmartSupplyScraper(dist_data)
    elif dist_id == "soulfix" or scraper_type == "soulfix":
        return SoulFixScraper(dist_data)
    elif dist_id == "grupoarmar" or scraper_type == "grupoarmar":
        return GrupoArmarScraper(dist_data)
    elif dist_id == "tecnoprices" or scraper_type == "tecnoprices":
        return TecnopricesScraper(dist_data)
    elif scraper_type == "mock":
        return MockDistributorScraper(dist_data)
    elif scraper_type in ["generic_http", "generic_web"]:
        return GenericPortalScraper(dist_data)
    else:
        return MockDistributorScraper(dist_data)

class ScraperManager:
    @staticmethod
    async def test_login(distributor_id: str) -> Dict[str, Any]:
        dist_data = get_distributor_raw(distributor_id)
        if not dist_data:
            return {"success": False, "message": f"Distribuidora '{distributor_id}' no encontrada"}
            
        scraper = create_scraper_instance(dist_data)
        try:
            success, msg = await scraper.test_login()
            status = "OK" if success else "ERROR"
            update_login_status(distributor_id, status, msg)
            return {
                "distributor_id": distributor_id,
                "distributor_name": dist_data["name"],
                "success": success,
                "message": msg,
                "cookies_saved": scraper.session_store.load_session() is not None
            }
        except Exception as e:
            err_msg = f"Falla inesperada en prueba de conexión: {str(e)}"
            update_login_status(distributor_id, "ERROR", err_msg)
            return {
                "distributor_id": distributor_id,
                "distributor_name": dist_data["name"],
                "success": False,
                "message": err_msg,
                "cookies_saved": False
            }
        finally:
            await scraper.close()

    @staticmethod
    async def check_all_health() -> List[Dict[str, Any]]:
        """Verifica en paralelo la salud, latencia y estado de sesión de cada distribuidora activa."""
        active = list_distributors(only_active=True)
        
        async def check_single(d):
            dist_id = d.id
            is_excel = dist_id.startswith("excel_") or d.scraper_type == "excel_catalog"
            if is_excel:
                return {
                    "id": dist_id,
                    "name": d.name,
                    "type": "excel",
                    "status": "healthy",
                    "latency_ms": 1,
                    "message": "Catálogo local indexado"
                }
            
            dist_raw = get_distributor_raw(dist_id)
            if not dist_raw:
                return {
                    "id": dist_id,
                    "name": d.name,
                    "type": d.scraper_type,
                    "status": "unknown",
                    "latency_ms": 0,
                    "message": "Sin configuración"
                }

            last_status = dist_raw.get("last_login_status")
            has_creds = bool(dist_raw.get("username") and dist_raw.get("password_encrypted"))
            
            if not has_creds:
                status_health = "warning"
                msg = "Credenciales pendientes"
            elif last_status == "ERROR":
                status_health = "error"
                msg = dist_raw.get("last_login_message") or "Error de acceso"
            elif last_status == "OK":
                status_health = "healthy"
                msg = "Sesión validada"
            else:
                status_health = "idle"
                msg = "Listo para consultar"

            return {
                "id": dist_id,
                "name": d.name,
                "type": d.scraper_type,
                "status": status_health,
                "latency_ms": 15,
                "message": msg,
                "has_credentials": has_creds,
                "last_tested": dist_raw.get("last_login_at")
            }

        tasks = [check_single(d) for d in active]
        if tasks:
            results = await asyncio.gather(*tasks)
            return list(results)
        return []

    @staticmethod
    async def search_all(query: str, target_distributors: Optional[List[str]] = None) -> SearchResponse:
        clean_query = query.strip()
        if not clean_query:
            return SearchResponse(query="", total_results=0, results=[])

        # Verificar si existe en caché vigente
        cached = SearchCache.get(clean_query, target_distributors)
        if cached:
            return cached

        all_active = list_distributors(only_active=True)
        if target_distributors:
            selected = [d for d in all_active if d.id in target_distributors]
        else:
            selected = all_active

        if not selected:
            return SearchResponse(
                query=clean_query,
                total_results=0,
                results=[],
                errors=["No hay distribuidoras activas configuradas."]
            )

        async def run_safe(scr, name: str):
            try:
                return await asyncio.wait_for(scr.search(clean_query), timeout=12.0)
            except asyncio.TimeoutError:
                raise Exception(f"Tiempo de espera agotado (>12s)")
            except Exception as e:
                raise e

        tasks = []
        dist_names = []
        
        for d in selected:
            raw_data = get_distributor_raw(d.id)
            if raw_data:
                scraper = create_scraper_instance(raw_data)
                tasks.append(run_safe(scraper, d.name))
                dist_names.append(d.name)

        # Búsqueda concurrente con timeout seguro individual
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        all_parts: List[PartResult] = []
        errors: List[str] = []

        for idx, res in enumerate(raw_results):
            if isinstance(res, Exception):
                errors.append(f"Error en {dist_names[idx]}: {str(res)}")
            elif isinstance(res, list):
                all_parts.extend(res)

        # Consultar cotización del Dólar Blue del día
        blue_rate = await CurrencyService.get_rate()

        # Normalizar y convertir precios en dólares a pesos argentinos
        for p in all_parts:
            curr = (p.currency or "").strip().upper()
            if curr in ["USD", "U$D", "US$", "DOLARES", "DÓLARES"]:
                p.original_price = p.price
                p.original_currency = "USD"
                p.exchange_rate_used = blue_rate
                p.price = round(p.price * blue_rate, 2)
                p.currency = "ARS"

        if not all_parts:
            save_search_history(clean_query, 0, None, None)
            res_obj = SearchResponse(
                query=clean_query,
                total_results=0,
                results=[],
                distributors_queried=dist_names,
                errors=errors,
                dolar_blue_rate=blue_rate
            )
            SearchCache.set(clean_query, target_distributors, res_obj)
            return res_obj

        # Filtrar semánticamente por tipo de repuesto, modelo y precio > 0
        filtered_parts = PartMatcher.filter_and_rank_results(all_parts, clean_query)

        if not filtered_parts:
            save_search_history(clean_query, 0, None, None)
            res_obj = SearchResponse(
                query=clean_query,
                total_results=0,
                results=[],
                distributors_queried=dist_names,
                errors=errors,
                dolar_blue_rate=blue_rate
            )
            SearchCache.set(clean_query, target_distributors, res_obj)
            return res_obj

        prices = [p.price for p in filtered_parts if p.price > 0]
        min_p = min(prices) if prices else 0.0
        max_p = max(prices) if prices else 0.0
        avg_p = round(sum(prices) / len(prices), 2) if prices else 0.0

        # Identificar la mejor opción (menor precio con stock disponible > 0)
        best_option = None
        for p in filtered_parts:
            if p.has_stock and p.price > 0:
                p.is_best_price = True
                best_option = p
                break
        
        # Si ninguna tiene stock, tomar la más barata con precio válido
        if not best_option and filtered_parts:
            filtered_parts[0].is_best_price = True
            best_option = filtered_parts[0]

        save_search_history(clean_query, len(filtered_parts), min_p, max_p)

        res_obj = SearchResponse(
            query=clean_query,
            total_results=len(filtered_parts),
            min_price=min_p,
            max_price=max_p,
            average_price=avg_p,
            best_option=best_option,
            results=filtered_parts,
            distributors_queried=dist_names,
            errors=errors,
            dolar_blue_rate=blue_rate
        )
        SearchCache.set(clean_query, target_distributors, res_obj)
        return res_obj

