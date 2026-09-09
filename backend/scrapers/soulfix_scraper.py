import os
import re
import httpx
from datetime import datetime
from typing import List, Tuple, Dict, Any
from bs4 import BeautifulSoup
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

IS_SERVERLESS = bool(
    os.environ.get("VERCEL")
    or os.environ.get("VERCEL_ENV")
    or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
    or os.environ.get("AWS_EXECUTION_ENV")
    or os.environ.get("K_SERVICE")
)

try:
    if IS_SERVERLESS:
        PLAYWRIGHT_AVAILABLE = False
    else:
        from playwright.async_api import async_playwright
        PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


class SoulFixScraper(BaseDistributorScraper):
    """Adaptador para Soul Fix (https://soulfix.com.ar/).
    Soporta Playwright (para entornos locales) y motor HTTP (httpx/bs4) de alto rendimiento para entornos Serverless como Vercel.
    """

    def __init__(self, dist_config: Dict[str, Any]):
        super().__init__(dist_config)
        self.base_url = "https://soulfix.com.ar"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
        }

    async def test_login(self) -> Tuple[bool, str]:
        if not self.username or not self.password:
            return False, "Debes ingresar tu usuario y contraseña registrados en Soul Fix."

        # En entornos Serverless o si Playwright falla (faltan binarios de Chrome), recurrir automáticamente al motor HTTP
        if PLAYWRIGHT_AVAILABLE:
            try:
                return await self._playwright_test_login()
            except Exception:
                return await self._httpx_test_login()
        else:
            return await self._httpx_test_login()

    async def search(self, query: str) -> List[PartResult]:
        clean_query = query.strip()
        if not clean_query:
            return []

        if PLAYWRIGHT_AVAILABLE:
            try:
                results = await self._playwright_search(clean_query)
                if results:
                    return results
            except Exception:
                pass
        
        # Fallback siempre listo por HTTP
        return await self._httpx_search(clean_query)

    # -------------------------------------------------------------------------
    # MOTOR HTTP (Compatible con Vercel y entornos Serverless sin Chromium)
    # -------------------------------------------------------------------------
    async def _httpx_test_login(self) -> Tuple[bool, str]:
        try:
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=20.0) as client:
                r_get = await client.get(f"{self.base_url}/mi-cuenta/")
                if r_get.status_code != 200:
                    return False, f"No se pudo conectar al servidor de Soul Fix (HTTP {r_get.status_code})"

                soup = BeautifulSoup(r_get.text, "html.parser")
                if soup.select_one(".woocommerce-MyAccount-navigation, .woocommerce-MyAccount-content"):
                    return True, f"Sesión activa persistida en Soul Fix para '{self.username}'."

                nonce_el = soup.find("input", {"name": "woocommerce-login-nonce"})
                nonce = nonce_el.get("value") if nonce_el else ""

                payload = {
                    "username": self.username.strip(),
                    "password": self.password.strip(),
                    "woocommerce-login-nonce": nonce,
                    "_wp_http_referer": "/mi-cuenta/",
                    "rememberme": "forever",
                    "login": "Acceder"
                }

                r_post = await client.post(f"{self.base_url}/mi-cuenta/", data=payload)
                post_soup = BeautifulSoup(r_post.text, "html.parser")

                err_el = post_soup.select_one(".woocommerce-error, .woocommerce-notices-wrapper .woocommerce-error")
                if err_el:
                    err_msg = err_el.get_text(strip=True)
                    return False, f"Falla de acceso en Soul Fix: {err_msg}"

                if post_soup.select_one(".woocommerce-MyAccount-navigation, .woocommerce-MyAccount-content") or "mi-cuenta" in str(r_post.url):
                    cookies_dict = {k: v for k, v in client.cookies.items()}
                    self.session_store.save_session(cookies=cookies_dict, extra_data={"user": self.username})
                    return True, f"Inicio de sesión exitoso en Soul Fix para '{self.username}'."

                return False, "No se pudo confirmar el acceso en Soul Fix. Verifica tu usuario y contraseña."
        except Exception as e:
            return False, f"Error al conectar con Soul Fix vía HTTP: {str(e)}"

    async def _httpx_search(self, clean_query: str) -> List[PartResult]:
        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        saved = self.session_store.load_session(max_age_hours=48)
        cookies = saved.get("cookies", {}) if saved else {}

        try:
            async with httpx.AsyncClient(headers=self.headers, cookies=cookies, follow_redirects=True, timeout=20.0) as client:
                search_url = f"{self.base_url}/?s={clean_query}&post_type=product"
                r = await client.get(search_url)
                if r.status_code != 200:
                    return []

                soup = BeautifulSoup(r.text, "html.parser")
                products = soup.select(".product, .type-product, .fusion-product-wrapper, article.product")

                for p_elem in products:
                    title_el = p_elem.select_one(".wd-entities-title a, .woocommerce-loop-product__title, .product-title, h3 a, h2 a, h3, h2")
                    desc_text = title_el.get_text(strip=True) if title_el else ""
                    if not desc_text:
                        aria_el = p_elem.select_one("a[aria-label], img[alt]")
                        if aria_el:
                            desc_text = (aria_el.get("aria-label") or aria_el.get("alt") or "").strip()

                    if not desc_text or len(desc_text) < 3:
                        continue

                    price_el = p_elem.select_one(".price")
                    price_val = 0.0
                    if price_el:
                        price_text = price_el.get_text(" ", strip=True)
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

                    link_el = p_elem.select_one(".wd-entities-title a, a.wd-product-img-link, a[href]")
                    prod_url = link_el.get("href", f"{self.base_url}/") if link_el else f"{self.base_url}/"

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
        except Exception:
            pass

        return results

    # -------------------------------------------------------------------------
    # MOTOR PLAYWRIGHT (Para ejecuciones locales donde Playwright está instalado)
    # -------------------------------------------------------------------------
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
            user_agent=self.headers["User-Agent"],
            viewport={"width": 1280, "height": 800}
        )
        saved = self.session_store.load_session(max_age_hours=48)
        if saved and "playwright_cookies" in saved:
            try:
                await context.add_cookies(saved["playwright_cookies"])
            except Exception:
                pass
        return browser, context

    async def _playwright_test_login(self) -> Tuple[bool, str]:
        async with async_playwright() as p:
            browser, context = await self._create_browser_context(p)
            page = await context.new_page()
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

            await page.goto(f"{self.base_url}/", wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(6000)
            await page.goto(f"{self.base_url}/mi-cuenta/", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(3000)

            nav = await page.query_selector(".woocommerce-MyAccount-navigation, .woocommerce-MyAccount-content")
            if nav:
                cookies = await context.cookies()
                self.session_store.save_session(
                    cookies={c["name"]: c["value"] for c in cookies},
                    extra_data={"playwright_cookies": cookies, "user": self.username}
                )
                await browser.close()
                return True, f"Sesión activa persistida en Soul Fix para '{self.username}'."

            user_input = await page.query_selector("input#username, input[name='username']")
            pass_input = await page.query_selector("input#password, input[name='password']")
            btn = await page.query_selector("button[name='login'], input[name='login']")

            if not user_input or not pass_input:
                await browser.close()
                return False, "No se encontró el formulario de inicio de sesión en Soul Fix."

            await user_input.fill(self.username.strip())
            await pass_input.fill(self.password.strip())
            await btn.click()
            await page.wait_for_timeout(4500)

            error_el = await page.query_selector(".woocommerce-error, .woocommerce-notices-wrapper .woocommerce-error")
            if error_el:
                err_msg = await error_el.inner_text()
                await browser.close()
                return False, f"Falla de acceso en Soul Fix: {err_msg.strip()}"

            logged_in = await page.query_selector(".woocommerce-MyAccount-navigation, .woocommerce-MyAccount-content")
            if logged_in or "mi-cuenta" in page.url:
                cookies = await context.cookies()
                self.session_store.save_session(
                    cookies={c["name"]: c["value"] for c in cookies},
                    extra_data={"playwright_cookies": cookies, "user": self.username}
                )
                await browser.close()
                return True, f"Inicio de sesión exitoso en Soul Fix para '{self.username}'."

            await browser.close()
            return False, "No se pudo confirmar la sesión en Soul Fix."

    async def _playwright_search(self, clean_query: str) -> List[PartResult]:
        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

        async with async_playwright() as p:
            browser, context = await self._create_browser_context(p)
            page = await context.new_page()
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

            await page.goto(f"{self.base_url}/?s={clean_query}&post_type=product", wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(4000)

            content = await page.content()
            soup = BeautifulSoup(content, "html.parser")
            products = soup.select(".product, .type-product, .fusion-product-wrapper")

            for p_elem in products:
                title_el = p_elem.select_one(".wd-entities-title a, .woocommerce-loop-product__title, .product-title, h3 a, h2 a, h3, h2")
                desc_text = title_el.get_text(strip=True) if title_el else ""
                if not desc_text or len(desc_text) < 3:
                    continue

                price_el = p_elem.select_one(".price")
                price_val = 0.0
                if price_el:
                    price_text = price_el.get_text(" ", strip=True)
                    matches = re.findall(r"\$\s*([\d.,]+)", price_text)
                    raw_target = matches[-1] if matches else ""
                    if raw_target:
                        try:
                            clean_p = raw_target.replace(".", "").replace(",", ".")
                            price_val = float(clean_p)
                        except Exception:
                            price_val = 0.0

                if price_val <= 0:
                    continue

                link_el = p_elem.select_one(".wd-entities-title a, a.wd-product-img-link, a[href]")
                prod_url = link_el.get("href", f"{self.base_url}/") if link_el else f"{self.base_url}/"

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
        return results
