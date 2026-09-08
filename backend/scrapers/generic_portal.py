import httpx
import re
from datetime import datetime
from typing import List, Tuple, Dict, Any
from bs4 import BeautifulSoup
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

class GenericPortalScraper(BaseDistributorScraper):
    """Scraper genérico basado en HTTPX con soporte para login por formulario/API y extracción HTML."""
    
    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }

    async def test_login(self) -> Tuple[bool, str]:
        if not self.login_url:
            return False, "No se configuró la URL de login para esta distribuidora."
        if not self.username or not self.password:
            return False, "Usuario o contraseña incompletos."

        # Revisar campos configurables o valores por defecto comunes
        cfg = self.custom_config or {}
        user_field = cfg.get("user_field", "username")
        pass_field = cfg.get("pass_field", "password")
        login_method = cfg.get("login_method", "POST").upper()
        
        payload = {
            user_field: self.username,
            pass_field: self.password
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=self.headers) as client:
                if login_method == "JSON":
                    resp = await client.post(self.login_url, json=payload)
                else:
                    resp = await client.post(self.login_url, data=payload)
                
                if resp.status_code in [200, 302]:
                    # Extraer cookies
                    cookie_dict = dict(resp.cookies)
                    if cookie_dict:
                        self.session_store.save_session(cookie_dict)
                        return True, f"Inicio de sesión exitoso. Se capturaron {len(cookie_dict)} cookies de sesión."
                    else:
                        return True, f"Respuesta HTTP {resp.status_code} recibida del portal."
                else:
                    return False, f"El servidor respondió con código {resp.status_code}."
        except Exception as e:
            return False, f"Error de conexión al portal: {str(e)}"

    async def search(self, query: str) -> List[PartResult]:
        cfg = self.custom_config or {}
        search_url_template = cfg.get("search_url", f"{self.base_url}/buscar?q={{query}}")
        search_url = search_url_template.format(query=query)
        
        saved_session = self.session_store.load_session()
        cookies = saved_session.get("cookies", {}) if saved_session else {}
        
        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=self.headers, cookies=cookies) as client:
                resp = await client.get(search_url)
                if resp.status_code != 200:
                    return []
                
                # Intentar parseo como JSON si la cabecera lo indica
                if "application/json" in resp.headers.get("content-type", ""):
                    data = resp.json()
                    items = data.get("items") or data.get("results") or data.get("data") or []
                    for item in items:
                        results.append(PartResult(
                            distributor_id=self.distributor_id,
                            distributor_name=self.name,
                            sku=str(item.get("sku") or item.get("code") or item.get("id") or query),
                            description=str(item.get("name") or item.get("title") or item.get("description") or ""),
                            brand=str(item.get("brand") or "General"),
                            price=float(item.get("price") or 0.0),
                            currency=str(item.get("currency") or "ARS"),
                            stock=str(item.get("stock") or "Consultar"),
                            has_stock=bool(item.get("has_stock", True)),
                            delivery_time=str(item.get("delivery") or "Inmediato"),
                            product_url=str(item.get("url") or search_url),
                            scraped_at=now_str
                        ))
                    return results

                # Parseo HTML con BeautifulSoup
                soup = BeautifulSoup(resp.text, "html.parser")
                row_selector = cfg.get("row_selector", ".product-item, .repuesto-item, tr.item-row")
                items = soup.select(row_selector)
                
                for item in items:
                    sku_el = item.select_one(cfg.get("sku_selector", ".sku, .code, td.code"))
                    desc_el = item.select_one(cfg.get("desc_selector", ".title, .name, .desc, td.desc"))
                    price_el = item.select_one(cfg.get("price_selector", ".price, td.price"))
                    stock_el = item.select_one(cfg.get("stock_selector", ".stock, td.stock"))
                    
                    sku_val = sku_el.get_text(strip=True) if sku_el else query
                    desc_val = desc_el.get_text(strip=True) if desc_el else "Repuesto encontrado"
                    
                    price_val = 0.0
                    if price_el:
                        price_clean = re.sub(r"[^\d.,]", "", price_el.get_text())
                        try:
                            price_val = float(price_clean.replace(".", "").replace(",", "."))
                        except Exception:
                            pass
                            
                    stock_val = stock_el.get_text(strip=True) if stock_el else "Disponible"
                    
                    results.append(PartResult(
                        distributor_id=self.distributor_id,
                        distributor_name=self.name,
                        sku=sku_val,
                        description=desc_val,
                        brand="Distribuido",
                        price=price_val,
                        currency="ARS",
                        stock=stock_val,
                        has_stock=True,
                        delivery_time="Consultar",
                        product_url=search_url,
                        scraped_at=now_str
                    ))
        except Exception:
            pass
            
        return results
