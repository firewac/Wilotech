import re
from datetime import datetime
from typing import List, Tuple, Dict, Any
import httpx
from bs4 import BeautifulSoup
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

class SmartSupplyScraper(BaseDistributorScraper):
    """Adaptador especializado para el portal Smart Supply (https://smartsupply.com.ar/)."""

    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.base_url = "https://smartsupply.com.ar"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://smartsupply.com.ar/login",
            "Origin": "https://smartsupply.com.ar"
        }

    async def test_login(self) -> Tuple[bool, str]:
        if not self.username or not self.password:
            return False, "Debes ingresar tu correo y contraseña registrados en Smart Supply."

        login_endpoint = f"{self.base_url}/carrito/acciones_carrito.php"
        payload = {
            "ingreso-cliente": 1,
            "login_mail": self.username.strip(),
            "login_pass": self.password.strip(),
            "g-recaptcha-response": ""
        }

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=15.0, follow_redirects=True) as client:
                # Primero visitar login para inicializar cookies de sesión
                await client.get(f"{self.base_url}/login")
                
                resp = await client.post(login_endpoint, data=payload)
                if resp.status_code != 200:
                    return False, f"El servidor respondió con código HTTP {resp.status_code}"

                try:
                    data = resp.json()
                except Exception:
                    data = {}

                # El portal retorna JSON con el atributo 'estado'
                if data.get("estado"):
                    cookie_dict = dict(client.cookies)
                    self.session_store.save_session(cookie_dict, extra_data={"user": self.username})
                    return True, f"Inicio de sesión exitoso en Smart Supply para '{self.username}'. Sesión guardada."
                else:
                    msg = data.get("mensaje") or "Correo o contraseña incorrectos en Smart Supply."
                    return False, msg

        except Exception as e:
            return False, f"Error al conectar con Smart Supply: {str(e)}"

    async def search(self, query: str) -> List[PartResult]:
        clean_query = query.strip()
        if not clean_query:
            return []

        saved_session = self.session_store.load_session()
        cookies = saved_session.get("cookies", {}) if saved_session else {}

        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        try:
            # Consultar directamente el endpoint JSON de búsqueda avanzada oficial de SmartSupply
            search_api_url = f"{self.base_url}/busqueda_avanzada.php?busqueda={httpx.URL('', params={'q': clean_query}).params.get('q')}&limit=40"
            async with httpx.AsyncClient(headers=self.headers, cookies=cookies, timeout=12.0, follow_redirects=True) as client:
                resp = await client.get(search_api_url)
                if resp.status_code != 200:
                    return []

                try:
                    data = resp.json()
                except Exception:
                    return []

                productos = data.get("productos", [])
                if not productos:
                    return []

                for p in productos:
                    desc_text = (p.get("descripcion") or "").strip()
                    if not desc_text:
                        continue

                    # Extraer precio: preferir precio de lista público/gremio activo (precio_final3/precio_final1)
                    price_val = 0.0
                    for field in ["precio_final3", "precio_final1", "precio_final2"]:
                        raw_field = p.get(field)
                        if raw_field:
                            try:
                                pv = float(str(raw_field).replace(",", "."))
                                if pv > 0:
                                    price_val = pv
                                    break
                            except Exception:
                                pass

                    # Si el precio es 0 o negativo, descartar
                    if price_val <= 0:
                        continue

                    # Enlace al producto
                    enlace = p.get("enlace", "")
                    if enlace:
                        prod_url = f"{self.base_url}/producto/{enlace.lstrip('/')}"
                    else:
                        prod_url = f"{self.base_url}/buscar"

                    # SKU
                    raw_code = str(p.get("codigo") or "").strip()
                    sku_val = f"SS-{raw_code}" if raw_code else f"SS-{abs(hash(desc_text)) % 100000:05d}"

                    # Marca detectada
                    brand_val = "Smart Supply"
                    for b in ["iPhone", "Apple", "Samsung", "Motorola", "Moto", "Xiaomi", "Redmi", "Nokia", "ZTE", "TCL", "Oppo", "Realme", "Honor", "LG", "Huawei", "Infinix"]:
                        if b.lower() in desc_text.lower():
                            brand_val = "Apple" if b.lower() == "iphone" else ("Motorola" if b.lower() == "moto" else b)
                            break

                    results.append(PartResult(
                        distributor_id=self.distributor_id,
                        distributor_name=self.name,
                        sku=sku_val,
                        description=desc_text,
                        brand=brand_val,
                        price=price_val,
                        currency="ARS",
                        stock="Disponible",
                        has_stock=True,
                        delivery_time="Despacho en 24 hs (Envío a todo el país)",
                        product_url=prod_url,
                        scraped_at=now_str
                    ))

        except Exception as e:
            # Fallback silencioso en caso de timeout o corte
            pass

        return results
