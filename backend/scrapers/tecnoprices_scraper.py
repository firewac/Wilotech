import re
import urllib.parse
from datetime import datetime
from typing import List, Tuple, Dict, Any
import httpx
from bs4 import BeautifulSoup
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

class TecnopricesScraper(BaseDistributorScraper):
    """Adaptador especializado para el portal Tecnoprices (https://www.tecnoprices.com/)."""

    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.base_url = "https://www.tecnoprices.com"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://www.tecnoprices.com/ingresar",
            "Origin": "https://www.tecnoprices.com"
        }

    async def test_login(self) -> Tuple[bool, str]:
        if not self.username or not self.password:
            return False, "Debes ingresar tu usuario/email y contraseña registrados en Tecnoprices."

        login_endpoint = f"{self.base_url}/control.php"
        payload = {
            "usuario": self.username.strip(),
            "password": self.password.strip()
        }

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=15.0, follow_redirects=True) as client:
                await client.get(f"{self.base_url}/ingresar")
                resp = await client.post(login_endpoint, data=payload)

                final_url = str(resp.url)
                if "errorusuario=1" in final_url or "login.php" in final_url:
                    return False, "Usuario o contraseña incorrectos en Tecnoprices."

                cookie_dict = dict(client.cookies)
                self.session_store.save_session(cookie_dict, extra_data={"user": self.username})
                return True, f"Inicio de sesión exitoso en Tecnoprices para '{self.username}'. Sesión guardada."

        except Exception as e:
            return False, f"Error al conectar con Tecnoprices: {str(e)}"

    async def search(self, query: str) -> List[PartResult]:
        clean_query = query.strip()
        if not clean_query:
            return []

        saved_session = self.session_store.load_session()
        cookies = saved_session.get("cookies", {}) if saved_session else {}

        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        try:
            encoded = urllib.parse.quote_plus(clean_query)
            search_url = f"{self.base_url}/buscar.php?q={encoded}"

            async with httpx.AsyncClient(headers=self.headers, cookies=cookies, timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(search_url)
                if resp.status_code != 200:
                    return []

                soup = BeautifulSoup(resp.text, "html.parser")
                cards = soup.find_all("div", class_=re.compile(r"product-card", re.I))

                seen_skus = set()

                for card in cards:
                    title_el = card.find("h3", class_=re.compile(r"product-card-title", re.I))
                    if not title_el:
                        continue
                    link = title_el.find("a")
                    if not link:
                        continue

                    desc_text = link.get_text(strip=True)
                    if not desc_text:
                        continue

                    href = link.get("href", "").strip()
                    if href.startswith("http"):
                        prod_url = href
                    else:
                        prod_url = f"{self.base_url}/{href.lstrip('/')}"

                    # SKU
                    code_el = card.find(class_=re.compile(r"product-card-code", re.I))
                    raw_code = code_el.get_text(strip=True) if code_el else ""
                    code_match = re.search(r"\d+", raw_code)
                    raw_id = code_match.group(0) if code_match else str(abs(hash(desc_text)) % 100000)
                    sku_val = f"TP-{raw_id}"

                    if sku_val in seen_skus:
                        continue
                    seen_skus.add(sku_val)

                    # Stock
                    card_classes = str(card.get("class", []))
                    card_text = card.get_text().upper()
                    has_stock = "STOCK-AVAILABLE" in card_classes.upper() or "EN STOCK" in card_text or "DISPONIBLE" in card_text
                    stock_str = "Disponible" if has_stock else "Sin Stock"

                    # Price
                    price_el = card.find(class_=re.compile(r"price", re.I))
                    price_str = price_el.get_text(strip=True) if price_el else ""

                    price_val = 0.0
                    price_matches = re.findall(r"\$\s*([\d\.,]+)", price_str)
                    if price_matches:
                        raw_p = price_matches[0]
                        if "," in raw_p and "." in raw_p and raw_p.rfind(",") > raw_p.rfind("."):
                            clean_p = raw_p.replace(".", "").replace(",", ".")
                        else:
                            clean_p = raw_p.replace(",", "")
                        try:
                            price_val = float(clean_p)
                        except Exception:
                            price_val = 0.0

                    # Detect brand
                    brand_val = "Tecnoprices"
                    known_brands = ["Kingston", "Hiksemi", "Derlar", "Netac", "MSI", "Adata", "Western Digital", "WD", "Samsung", "Crucial", "Seagate", "Sandisk", "Gigabyte", "Patriot", "PNY", "iPhone", "Apple", "Motorola", "Xiaomi"]
                    for b in known_brands:
                        if b.lower() in desc_text.lower():
                            brand_val = b
                            break

                    results.append(PartResult(
                        distributor_id=self.distributor_id,
                        distributor_name=self.name,
                        sku=sku_val,
                        description=desc_text,
                        brand=brand_val,
                        price=price_val,
                        currency="ARS",
                        stock=stock_str,
                        has_stock=has_stock,
                        delivery_time="Despacho inmediato mayorista",
                        product_url=prod_url,
                        scraped_at=now_str
                    ))

        except Exception as e:
            pass

        return results
