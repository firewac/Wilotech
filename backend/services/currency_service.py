import time
import httpx
from typing import Dict, Any, Optional

class CurrencyService:
    """Servicio para consulta y conversión de cotización del Dólar Blue en tiempo real."""

    _cached_info: Optional[Dict[str, Any]] = None
    _last_fetched: float = 0
    _CACHE_TTL: int = 900  # 15 minutos de caché
    _custom_rate: Optional[float] = None

    @classmethod
    async def get_dolar_blue_info(cls, force_refresh: bool = False) -> Dict[str, Any]:
        now = time.time()
        
        # Si hay cotización manual fijada por el usuario
        if cls._custom_rate and cls._custom_rate > 0:
            return {
                "compra": cls._custom_rate,
                "venta": cls._custom_rate,
                "tarifa_usada": cls._custom_rate,
                "is_custom": True,
                "fuente": "Personalizada por el usuario",
                "actualizado": "Manual"
            }

        # Usar caché si está vigente
        if not force_refresh and cls._cached_info and (now - cls._last_fetched) < cls._CACHE_TTL:
            return cls._cached_info

        info = None

        # 1. Intentar con DolarApi (rápido y actualizado)
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get("https://dolarapi.com/v1/dolares/blue")
                if r.status_code == 200:
                    data = r.json()
                    venta = float(data.get("venta", 0))
                    compra = float(data.get("compra", 0))
                    if venta > 0:
                        info = {
                            "compra": compra,
                            "venta": venta,
                            "tarifa_usada": venta,
                            "is_custom": False,
                            "fuente": "DolarApi (Argentina)",
                            "actualizado": data.get("fechaActualizacion", "")
                        }
        except Exception as e:
            print(f"[!] Error consultando DolarApi: {e}")

        # 2. Fallback con Bluelytics
        if not info:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    r = await client.get("https://api.bluelytics.com.ar/v2/latest")
                    if r.status_code == 200:
                        data = r.json()
                        blue_data = data.get("blue", {})
                        venta = float(blue_data.get("value_sell", 0))
                        compra = float(blue_data.get("value_buy", 0))
                        if venta > 0:
                            info = {
                                "compra": compra,
                                "venta": venta,
                                "tarifa_usada": venta,
                                "is_custom": False,
                                "fuente": "Bluelytics",
                                "actualizado": data.get("last_update", "")
                            }
            except Exception as e:
                print(f"[!] Error consultando Bluelytics: {e}")

        # 3. Fallback de emergencia si no hay internet o ambas APIs fallan
        if not info:
            if cls._cached_info:
                return cls._cached_info
            # Cotización estimada de seguridad si no hay conexión
            info = {
                "compra": 1500.0,
                "venta": 1540.0,
                "tarifa_usada": 1540.0,
                "is_custom": False,
                "fuente": "Valor referencial de respaldo (sin conexión)",
                "actualizado": "Estimado"
            }

        cls._cached_info = info
        cls._last_fetched = now
        return info

    @classmethod
    async def get_rate(cls) -> float:
        """Devuelve el valor de venta del Dólar Blue actual para convertir de USD a ARS."""
        info = await cls.get_dolar_blue_info()
        return float(info.get("tarifa_usada", 1540.0))

    @classmethod
    def set_custom_rate(cls, rate: Optional[float]):
        """Fija una cotización manual o vuelve a la automática si es None/0."""
        if rate and rate > 0:
            cls._custom_rate = float(rate)
        else:
            cls._custom_rate = None
