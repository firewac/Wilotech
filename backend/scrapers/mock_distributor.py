import asyncio
import hashlib
import random
from datetime import datetime
from typing import List, Tuple, Dict, Any
from backend.database.models import PartResult
from backend.scrapers.base import BaseDistributorScraper

# Catálogo base para simulaciones realistas
SAMPLE_PARTS_DB = [
    {
        "sku": "MOD-SAM-A14",
        "description": "Módulo Display Pantalla Samsung Galaxy A14 con Marco",
        "brand": "Samsung",
        "base_price": 32500.0,
        "keywords": ["modulo", "pantalla", "samsung", "a14", "display"]
    },
    {
        "sku": "BAT-IPH-11",
        "description": "Batería iPhone 11 3110mAh Calidad Original Foxconn",
        "brand": "Apple / Foxconn",
        "base_price": 24900.0,
        "keywords": ["bateria", "iphone", "11", "apple"]
    },
    {
        "sku": "PIN-MOT-G8",
        "description": "Pin Conector de Carga Tipo C Motorola Moto G8 / G8 Plus",
        "brand": "Motorola",
        "base_price": 1850.0,
        "keywords": ["pin", "carga", "motorola", "g8", "conector"]
    },
    {
        "sku": "MOD-XIA-RN11",
        "description": "Módulo Pantalla Táctil AMOLED Xiaomi Redmi Note 11",
        "brand": "Xiaomi",
        "base_price": 48200.0,
        "keywords": ["modulo", "xiaomi", "redmi", "note", "11", "pantalla"]
    },
    {
        "sku": "PAN-MOT-G22",
        "description": "Pantalla Módulo Completo Motorola Moto G22 Negro",
        "brand": "Motorola",
        "base_price": 28400.0,
        "keywords": ["pantalla", "modulo", "motorola", "g22"]
    },
    {
        "sku": "FLX-CAR-A52",
        "description": "Flex Placa Sub Board Conector de Carga Samsung Galaxy A52",
        "brand": "Samsung",
        "base_price": 7900.0,
        "keywords": ["flex", "placa", "carga", "samsung", "a52", "sub"]
    },
    {
        "sku": "GLS-IPH-13",
        "description": "Glass Vidrio Táctil Frontal + Lámina OCA iPhone 13 / 13 Pro",
        "brand": "Apple",
        "base_price": 9400.0,
        "keywords": ["glass", "oca", "vidrio", "iphone", "13"]
    },
    {
        "sku": "IC-PMIC-S20",
        "description": "Circuito Integrado IC Power Management PMIC Qualcomm",
        "brand": "Qualcomm",
        "base_price": 14500.0,
        "keywords": ["ic", "circuito", "chip", "pmic", "microsoldadura"]
    },
    {
        "sku": "TAP-SAM-A32",
        "description": "Tapa Trasera Cubierta de Batería Samsung Galaxy A32 con Lente",
        "brand": "Samsung",
        "base_price": 6200.0,
        "keywords": ["tapa", "trasera", "samsung", "a32", "cubierta"]
    },
    {
        "sku": "MOD-IPH-XR",
        "description": "Módulo Pantalla LCD Liquid Retina iPhone XR Calidad Premium",
        "brand": "Apple",
        "base_price": 38900.0,
        "keywords": ["modulo", "pantalla", "iphone", "xr", "lcd"]
    }
]

class MockDistributorScraper(BaseDistributorScraper):
    """Scraper simulado de alta fidelidad para pruebas, demostración y comparación inmediata."""
    
    async def test_login(self) -> Tuple[bool, str]:
        # Simular latencia de red
        await asyncio.sleep(0.4)
        
        if not self.username or not self.password:
            return False, "Falta usuario o contraseña en la configuración de la distribuidora."
        
        # Guardar cookies de sesión simuladas
        self.session_store.save_session(
            cookies={"session_id": hashlib.md5(f"{self.username}:{self.password}".encode()).hexdigest(), "logged_in": "true"},
            extra_data={"portal_user": self.username}
        )
        return True, f"Login simulado exitoso como '{self.username}'. Sesión lista."

    async def search(self, query: str) -> List[PartResult]:
        # Simular latencia de búsqueda de la distribuidora
        delay_ms = self.custom_config.get("delay_ms", 300)
        await asyncio.sleep(delay_ms / 1000.0)
        
        q = query.strip().lower()
        if not q:
            return []
            
        markup = float(self.custom_config.get("markup_rate", 1.0))
        results: List[PartResult] = []
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Semilla determinística para que la misma distribuidora y consulta arrojen precios consistentes
        seed_val = int(hashlib.md5(f"{self.distributor_id}:{q}".encode()).hexdigest(), 16)
        rng = random.Random(seed_val)
        
        # 1. Buscar coincidencias en catálogo base
        matched_items = []
        for item in SAMPLE_PARTS_DB:
            score = 0
            if q in item["sku"].lower():
                score += 3
            if q in item["description"].lower():
                score += 2
            if q in item["brand"].lower():
                score += 2
            for kw in item["keywords"]:
                if kw in q or q in kw:
                    score += 1
            if score > 0:
                matched_items.append(item)
                
        # 2. Si no hubo coincidencia directa, generar 1 a 2 opciones coherentes con el texto de búsqueda
        if not matched_items:
            pseudo_sku = f"{q.upper()[:4]}-{rng.randint(1000, 9999)}"
            pseudo_brand = rng.choice(["Bosch", "Valeo", "SKF", "Mahle", "Brembo", "Gates", "TRW"])
            base_p = rng.randint(9500, 75000)
            matched_items.append({
                "sku": pseudo_sku,
                "description": f"Repuesto compatible para: {query.capitalize()}",
                "brand": pseudo_brand,
                "base_price": float(base_p),
                "keywords": []
            })
            
        for item in matched_items:
            # Variación de precio específica para este distribuidor (entre -8% y +12%)
            dist_factor = markup * (1.0 + (rng.uniform(-0.08, 0.08)))
            final_price = round(item["base_price"] * dist_factor, 2)
            
            # Stock simulado según el distribuidor
            stock_qty = rng.randint(0, 45)
            has_stock = stock_qty > 0
            stock_text = f"{stock_qty} unidades" if has_stock else "Sin stock inmediato"
            
            delivery_options = ["Inmediato (Retiro en mostrador)", "Despacho en 24 hs", "Envío en 48 hs"]
            delivery = rng.choice(delivery_options) if has_stock else "A consultar"
            
            results.append(PartResult(
                distributor_id=self.distributor_id,
                distributor_name=self.name,
                sku=item["sku"],
                description=item["description"],
                brand=item["brand"],
                price=final_price,
                currency="ARS",
                stock=stock_text,
                has_stock=has_stock,
                delivery_time=delivery,
                product_url=f"{self.base_url}/articulo/{item['sku']}",
                scraped_at=now_str,
                is_best_price=False
            ))
            
        return results
