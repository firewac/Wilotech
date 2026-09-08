import re
from datetime import datetime
from typing import List, Tuple, Dict, Any
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

class SoulFixScraper(BaseDistributorScraper):
    """Adaptador especializado para el portal Soul Fix (https://soulfix.com.ar/) con soporte para Cloudflare y WooCommerce."""

    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.base_url = "https://soulfix.com.ar"

    async def _create_browser_context(self, p):
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        
        # Cargar cookies previas si existen
        saved = self.session_store.load_session(max_age_hours=48)
        if saved and "playwright_cookies" in saved:
            try:
                await context.add_cookies(saved["playwright_cookies"])
            except Exception:
                pass

        return browser, context

    async def test_login(self) -> Tuple[bool, str]:
        if not self.username or not self.password:
            return False, "Debes ingresar tu usuario y contraseña registrados en Soul Fix."

        try:
            async with async_playwright() as p:
                browser, context = await self._create_browser_context(p)
                page = await context.new_page()
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

                # 1. Warm-up en homepage para obtener cf_clearance
                await page.goto(f"{self.base_url}/", wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(6000)

                # 2. Ir a Mi Cuenta
                await page.goto(f"{self.base_url}/mi-cuenta/", wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(3000)

                # Comprobar si ya está logueado
                nav = await page.query_selector(".woocommerce-MyAccount-navigation, .woocommerce-MyAccount-content")
                if nav:
                    cookies = await context.cookies()
                    self.session_store.save_session(
                        cookies={c["name"]: c["value"] for c in cookies},
                        extra_data={"playwright_cookies": cookies, "user": self.username}
                    )
                    await browser.close()
                    return True, f"Sesión activa persistida en Soul Fix para '{self.username}'."

                # Llenar formulario de login WooCommerce
                user_input = await page.query_selector("input#username, input[name='username']")
                pass_input = await page.query_selector("input#password, input[name='password']")
                btn = await page.query_selector("button[name='login'], input[name='login']")

                if not user_input or not pass_input:
                    await browser.close()
                    return False, "No se encontró el formulario de inicio de sesión en Soul Fix."

                await user_input.fill(self.username.strip())
                await pass_input.fill(self.password.strip())
                
                # Enviar login
                await btn.click()
                await page.wait_for_timeout(4500)

                # Verificar errores de login WooCommerce
                error_el = await page.query_selector(".woocommerce-error, .woocommerce-notices-wrapper .woocommerce-error")
                if error_el:
                    err_msg = await error_el.inner_text()
                    await browser.close()
                    return False, f"Falla de acceso en Soul Fix: {err_msg.strip()}"

                # Comprobar si ahora figura la cuenta
                logged_in = await page.query_selector(".woocommerce-MyAccount-navigation, .woocommerce-MyAccount-content")
                if logged_in or "mi-cuenta" in page.url:
                    cookies = await context.cookies()
                    self.session_store.save_session(
                        cookies={c["name"]: c["value"] for c in cookies},
                        extra_data={"playwright_cookies": cookies, "user": self.username}
                    )
                    await browser.close()
                    return True, f"Inicio de sesión exitoso en Soul Fix para '{self.username}'. Sesión guardada."

                await browser.close()
                return False, "No se pudo confirmar la sesión en Soul Fix. Verifica usuario y contraseña."

        except Exception as e:
            return False, f"Error al conectar con Soul Fix: {str(e)}"

    async def search(self, query: str) -> List[PartResult]:
        clean_query = query.strip()
        if not clean_query:
            return []

        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        try:
            async with async_playwright() as p:
                browser, context = await self._create_browser_context(p)
                page = await context.new_page()
                await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

                # 1. Warm-up
                await page.goto(f"{self.base_url}/", wait_until="domcontentloaded", timeout=20000)
                await page.wait_for_timeout(5500)

                # 2. Búsqueda directa con el campo de la barra de navegación
                search_input = await page.query_selector("input.s, input[type='search'], input[name='s']")
                if search_input:
                    await search_input.fill(clean_query)
                    await search_input.press("Enter")
                    await page.wait_for_timeout(4000)
                else:
                    await page.goto(f"{self.base_url}/?s={clean_query}&post_type=product", wait_until="domcontentloaded", timeout=20000)
                    await page.wait_for_timeout(4000)

                # 3. Parsear resultados HTML
                content = await page.content()
                soup = BeautifulSoup(content, "html.parser")
                products = soup.select(".product, .type-product, .fusion-product-wrapper")

                for p_elem in products:
                    # 1. Extraer título descriptivo
                    title_el = p_elem.select_one(".wd-entities-title a, .woocommerce-loop-product__title, .product-title, h3 a, h2 a, h3, h2")
                    desc_text = title_el.get_text(strip=True) if title_el else ""
                    if not desc_text:
                        aria_el = p_elem.select_one("a[aria-label], img[alt]")
                        if aria_el:
                            desc_text = (aria_el.get("aria-label") or aria_el.get("alt") or "").strip()

                    if not desc_text or len(desc_text) < 3:
                        continue

                    # 2. Extraer precio
                    price_el = p_elem.select_one(".price")
                    price_val = 0.0
                    if price_el:
                        price_text = price_el.get_text(" ", strip=True)
                        # Si hay precio rebajado 'El precio actual es: $XXX'
                        m_current = re.search(r"precio actual es:\s*\$?\s*([\d.,]+)", price_text, re.IGNORECASE)
                        if m_current:
                            raw_target = m_current.group(1)
                        else:
                            matches = re.findall(r"\$\s*([\d.,]+)", price_text)
                            raw_target = matches[-1] if matches else ""

                        if raw_target:
                            clean_p = raw_target.strip()
                            if "," in clean_p and "." in clean_p:
                                if clean_p.rfind(",") > clean_p.rfind("."):
                                    clean_p = clean_p.replace(".", "").replace(",", ".")
                                else:
                                    clean_p = clean_p.replace(",", "")
                            elif "." in clean_p:
                                parts = clean_p.split(".")
                                if len(parts) > 1 and len(parts[-1]) == 3:
                                    clean_p = clean_p.replace(".", "")
                                elif len(parts) == 2 and len(parts[1]) in [1, 2]:
                                    pass
                                else:
                                    clean_p = clean_p.replace(".", "")
                            elif "," in clean_p:
                                parts = clean_p.split(",")
                                if len(parts) == 2 and len(parts[1]) in [1, 2]:
                                    clean_p = clean_p.replace(",", ".")
                                else:
                                    clean_p = clean_p.replace(",", "")
                            try:
                                price_val = float(clean_p)
                            except Exception:
                                price_val = 0.0

                    if price_val <= 0:
                        continue

                    # 3. Enlace
                    link_el = p_elem.select_one(".wd-entities-title a, a.wd-product-img-link, a[href]")
                    prod_url = link_el.get("href", f"{self.base_url}/") if link_el else f"{self.base_url}/"

                    # 4. Marca estimada
                    brand_val = "Soul Fix"
                    for b in ["iPhone", "Apple", "Samsung", "Motorola", "Moto", "Xiaomi", "Redmi", "Huawei", "TCL", "ZTE", "Nokia", "LG"]:
                        if b.lower() in desc_text.lower():
                            brand_val = "Apple" if b.lower() == "iphone" else ("Motorola" if b.lower() == "moto" else b)
                            break

                    sku_candidate = f"SF-{abs(hash(desc_text)) % 100000:05d}"

                    results.append(PartResult(
                        distributor_id=self.distributor_id,
                        distributor_name=self.name,
                        sku=sku_candidate,
                        description=desc_text,
                        brand=brand_val,
                        price=price_val,
                        currency="ARS",
                        stock="En stock",
                        has_stock=True,
                        delivery_time="Envío inmediato / Retiro en sucursal",
                        product_url=prod_url,
                        scraped_at=now_str
                    ))

                await browser.close()

        except Exception as e:
            # Fallback en caso de timeout
            pass

        return results
