import asyncio
from playwright.async_api import async_playwright
import bs4

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
        
        print("Navigating to https://soulfix.com.ar/categoria-producto/baterias/ ...")
        await page.goto("https://soulfix.com.ar/categoria-producto/baterias/")
        
        # Wait for challenges to settle (BitNinja + Cloudflare)
        for second in range(1, 15):
            await page.wait_for_timeout(1000)
            title = await page.title()
            if "Bater" in title or "Soul Fix" in title and "One moment" not in title and "No Encontrado" not in title:
                print(f"Passed challenge at {second}s! Title: {title}")
                break
            print(f" [{second}s] Title: {title}")

        print("Final Title:", await page.title())
        content = await page.content()
        soup = bs4.BeautifulSoup(content, "html.parser")
        products = soup.select(".product, .type-product")
        print(f"Products found: {len(products)}")
        for idx, it in enumerate(products[:5]):
            tit = it.select_one(".woocommerce-loop-product__title, h2, h3, a")
            pr = it.select_one(".price")
            print(f" [{idx+1}] {tit.get_text(strip=True) if tit else 'N/A'} : {pr.get_text(strip=True) if pr else 'N/A'}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test())
