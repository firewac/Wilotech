from datetime import datetime
from typing import List, Tuple, Dict, Any
from backend.database.models import PartResult
from backend.database.db import search_excel_catalog_items
from backend.scrapers.base import BaseDistributorScraper

class ExcelCatalogScraper(BaseDistributorScraper):
    """Adaptador para catálogos y listas de precios importadas desde planillas Excel / CSV."""

    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.catalog_id = dist_config.get("id", "")

    async def test_login(self) -> Tuple[bool, str]:
        return True, f"Catálogo Excel '{self.name}' activo en la base de datos local."

    async def search(self, query: str) -> List[PartResult]:
        clean_query = query.strip()
        if not clean_query:
            return []

        items = search_excel_catalog_items(self.catalog_id, clean_query, limit=40)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        results: List[PartResult] = []

        for it in items:
            raw_row = it.get("raw_row", 0)
            row_note = f" (Fila #{raw_row})" if raw_row > 0 else ""
            results.append(PartResult(
                distributor_id=self.distributor_id,
                distributor_name=self.name,
                sku=it.get("sku") or f"EX-{it.get('id')}",
                description=it.get("description", ""),
                brand=it.get("brand") or "Genérico",
                price=float(it.get("price", 0.0)),
                currency=it.get("currency", "ARS"),
                stock=it.get("stock", "Disponible"),
                has_stock=bool(it.get("has_stock", 1)),
                delivery_time=f"Stock de catálogo{row_note}",
                product_url="#",
                scraped_at=now_str
            ))

        return results
