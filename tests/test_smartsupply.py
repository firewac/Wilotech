import asyncio
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.database.db import init_db
from backend.scrapers.manager import ScraperManager

init_db()

async def main():
    print("Testing SmartSupply scraper for 'iphone'...")
    res = await ScraperManager.search_all("iphone", target_distributors=["smartsupply"])
    print(f"Total results: {res.total_results}")
    for r in res.results[:5]:
        print(f" - [{r.distributor_name}] {r.description} -> ${r.price:,.2f} ARS")

if __name__ == "__main__":
    asyncio.run(main())
