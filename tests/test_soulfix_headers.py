import httpx
import bs4

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
}

with httpx.Client(headers=headers, follow_redirects=True, timeout=15.0) as client:
    r = client.get("https://soulfix.com.ar/?s=iphone")
    soup = bs4.BeautifulSoup(r.text, "html.parser")
    title = soup.title.string if soup.title else ""
    print(f"Status: {r.status_code}, Title: {title}")
    prods = soup.select(".product, .type-product")
    print(f"Products found: {len(prods)}")
    for p in prods[:3]:
        t = p.select_one(".product-title, h2, h3, a")
        price = p.select_one(".price")
        print(" -", t.get_text(strip=True) if t else "N/A", "|", price.get_text(strip=True) if price else "N/A")
