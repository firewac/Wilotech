import re
from datetime import datetime
from typing import List, Tuple, Dict, Any
import httpx
from bs4 import BeautifulSoup
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

def parse_price_str(raw: str) -> float:
    try:
        raw = raw.strip()
        if "," in raw and "." in raw:
            if raw.rfind(".") > raw.rfind(","):
                raw = raw.replace(",", "")
            else:
                raw = raw.replace(".", "").replace(",", ".")
        elif "," in raw:
            raw = raw.replace(",", ".")
        return float(raw)
    except Exception:
        return 0.0

class GrupoArmarScraper(BaseDistributorScraper):
    """Adaptador especializado para el portal Grupo Armar (https://grupoarmar.com.ar/)."""

    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.base_url = "https://grupoarmar.com.ar"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Referer": "https://grupoarmar.com.ar/",
            "Origin": "https://grupoarmar.com.ar"
        }

    async def test_login(self) -> Tuple[bool, str]:
        if not self.username or not self.password:
            return False, "Debes ingresar tu email y contraseña registrados en Grupo Armar."

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=15.0, follow_redirects=True) as client:
                # 1. Obtener token CSRF de la página de login
                resp_get = await client.get(f"{self.base_url}/ingresar")
                if resp_get.status_code != 200:
                    return False, f"No se pudo conectar a Grupo Armar (HTTP {resp_get.status_code})"

                soup = BeautifulSoup(resp_get.text, "html.parser")
                token_input = soup.find("input", attrs={"name": "_token"})
                if not token_input:
                    return False, "No se encontró el token de seguridad CSRF en la página de login."
                
                csrf_token = token_input.get("value", "")

                # 2. Enviar login
                login_payload = {
                    "_token": csrf_token,
                    "email": self.username.strip(),
                    "pass": self.password.strip(),
                    "remember_me": "on"
                }

                resp_login = await client.post(f"{self.base_url}/login", data=login_payload)
                soup_after = BeautifulSoup(resp_login.text, "html.parser")

                # Comprobar alertas de error
                alert = soup_after.find(class_=lambda x: x and any(c in x for c in ["alert-danger", "alert", "error"]))
                if alert and "ingresar" in str(resp_login.url):
                    msg = alert.get_text(strip=True)
                    return False, f"Falla de acceso en Grupo Armar: {msg}"

                if "ingresar" not in str(resp_login.url):
                    # Login exitoso
                    cookie_dict = dict(client.cookies)
                    self.session_store.save_session(cookie_dict, extra_data={"user": self.username})
                    return True, f"Inicio de sesión exitoso en Grupo Armar para '{self.username}'. Sesión guardada."
                else:
                    return False, "Credenciales incorrectas o cuenta no encontrada en Grupo Armar."

        except Exception as e:
            return False, f"Error al conectar con Grupo Armar: {str(e)}"

    async def search(self, query: str) -> List[PartResult]:
        clean_query = query.strip()
        if not clean_query:
            return []

        saved_session = self.session_store.load_session(max_age_hours=48)
        cookies = saved_session.get("cookies", {}) if saved_session else {}

        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        try:
            async with httpx.AsyncClient(headers=self.headers, cookies=cookies, timeout=15.0, follow_redirects=True) as client:
                # 1. Obtener token y shop_id desde la portada
                resp_home = await client.get(self.base_url)
                if resp_home.status_code != 200:
                    return []

                soup_home = BeautifulSoup(resp_home.text, "html.parser")
                token_el = soup_home.find("input", attrs={"name": "_token"})
                shop_el = soup_home.find("input", attrs={"name": "shop_id"})

                csrf_token = token_el.get("value", "") if token_el else ""
                shop_id = shop_el.get("value", "85") if shop_el else "85"

                # 2. Enviar búsqueda
                search_payload = {
                    "_token": csrf_token,
                    "shop_id": shop_id,
                    "search": clean_query
                }

                resp_search = await client.post(f"{self.base_url}/search", data=search_payload)
                if resp_search.status_code != 200:
                    return []

                soup_search = BeautifulSoup(resp_search.text, "html.parser")
                
                # Buscar todos los enlaces a artículos
                article_links = soup_search.find_all("a", href=lambda h: h and "/tienda/articulo/" in h)
                seen_ids = set()

                for a_elem in article_links:
                    href = a_elem.get("href", "")
                    m_id = re.search(r"/articulo/(\d+)", href)
                    art_id = m_id.group(1) if m_id else href
                    if art_id in seen_ids:
                        continue
                    seen_ids.add(art_id)

                    card = a_elem.find_parent(class_=lambda x: x and any(c in x for c in ["col-", "card", "item"]))
                    if not card:
                        continue

                    card_text = card.get_text(" # ", strip=True)

                    # Stock
                    has_stock = "sin stock" not in card_text.lower()
                    stock_str = "Disponible" if has_stock else "Sin stock"

                    # Extraer precio en efectivo o lista
                    price_val = 0.0
                    m_efectivo = re.search(r"Efectivo:\s*(?:#\s*)?\$?\s*([\d.,]+)", card_text, re.IGNORECASE)
                    if m_efectivo:
                        price_val = parse_price_str(m_efectivo.group(1))
                    else:
                        matches_p = re.findall(r"\$\s*([\d.,]+)", card_text)
                        if matches_p:
                            price_val = parse_price_str(matches_p[-1])

                    # Título del producto
                    desc_text = ""
                    # Buscar el enlace con texto descriptivo más largo
                    text_candidates = [a.get_text(strip=True) for a in card.find_all("a", href=lambda h: h and "/articulo/" in h)]
                    text_candidates = [t for t in text_candidates if len(t) > 3 and "mas info" not in t.lower()]
                    if text_candidates:
                        desc_text = max(text_candidates, key=len)
                    else:
                        desc_text = f"Repuesto / Accesorio Código {art_id}"

                    # Enlace al producto
                    prod_url = f"{self.base_url}{href}" if href.startswith("/") else href

                    # Marca
                    brand_val = "Grupo Armar"
                    for b in ["Aitech", "iPhone", "Apple", "Samsung", "Motorola", "Xiaomi", "Huawei", "TCL"]:
                        if b.lower() in desc_text.lower():
                            brand_val = b
                            break

                    results.append(PartResult(
                        distributor_id=self.distributor_id,
                        distributor_name=self.name,
                        sku=f"GA-{art_id}",
                        description=desc_text,
                        brand=brand_val,
                        price=price_val,
                        currency="ARS",
                        stock=stock_str,
                        has_stock=has_stock,
                        delivery_time="Retiro / Despacho 24 hs",
                        product_url=prod_url,
                        scraped_at=now_str
                    ))

        except Exception:
            pass

        return results
