import asyncio
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
from backend.scrapers.excel_scraper import ExcelCatalogScraper
from backend.services.currency_service import CurrencyService
from backend.services.part_matcher import PartMatcher

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
    async def search_all(query: str, target_distributors: Optional[List[str]] = None) -> SearchResponse:
        clean_query = query.strip()
        if not clean_query:
            return SearchResponse(query="", total_results=0, results=[])

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

        tasks = []
        dist_names = []
        
        for d in selected:
            raw_data = get_distributor_raw(d.id)
            if raw_data:
                scraper = create_scraper_instance(raw_data)
                tasks.append(scraper.search(clean_query))
                dist_names.append(d.name)

        # Búsqueda concurrente con timeout de 15 segundos
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
            return SearchResponse(
                query=clean_query,
                total_results=0,
                results=[],
                distributors_queried=dist_names,
                errors=errors,
                dolar_blue_rate=blue_rate
            )

        # Filtrar semánticamente por tipo de repuesto, modelo y precio > 0
        filtered_parts = PartMatcher.filter_and_rank_results(all_parts, clean_query)

        if not filtered_parts:
            save_search_history(clean_query, 0, None, None)
            return SearchResponse(
                query=clean_query,
                total_results=0,
                results=[],
                distributors_queried=dist_names,
                errors=errors,
                dolar_blue_rate=blue_rate
            )

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

        return SearchResponse(
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

