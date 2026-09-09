import re
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
from backend.config import BASE_DIR

DB_PATH = BASE_DIR / "data" / "tac.db"

class IMEIService:
    @staticmethod
    def calculate_luhn(imei_clean: str) -> bool:
        """Verifica si los 15 dígitos del IMEI cumplen con el algoritmo de Luhn."""
        if len(imei_clean) != 15 or not imei_clean.isdigit():
            return False
        total = 0
        for i in range(14):
            digit = int(imei_clean[i])
            if i % 2 == 1:
                digit *= 2
                if digit > 9:
                    digit -= 9
            total += digit
        check_digit = (10 - (total % 10)) % 10
        return check_digit == int(imei_clean[14])

    @staticmethod
    def infer_device_attributes(brand: str, model: str) -> Dict[str, Any]:
        """Deduce opciones recomendadas de color, almacenamiento y tipo de equipo para un modelo dado."""
        b_lower = brand.lower()
        m_lower = model.lower()

        # Categoría por defecto
        device_type = "Celular"
        if "pad" in m_lower or "tab" in m_lower:
            device_type = "Tablet"
        elif "watch" in m_lower:
            device_type = "Smartwatch"

        # Opciones por defecto
        colors = ["Negro Espacial", "Plata / Blanco", "Azul Oscuro", "Gris Grafito", "Dorado"]
        storages = ["128 GB", "256 GB", "512 GB", "64 GB", "1 TB"]
        default_color = colors[0]
        default_storage = "128 GB"

        # --- APPLE ---
        if "apple" in b_lower:
            if "iphone 16 pro" in m_lower or "16 pro" in m_lower:
                colors = ["Titanio Desierto", "Titanio Natural", "Titanio Blanco", "Titanio Negro"]
                storages = ["128 GB", "256 GB", "512 GB", "1 TB"]
                default_color = "Titanio Natural"
                default_storage = "256 GB" if "max" in m_lower else "128 GB"
            elif "iphone 16" in m_lower:
                colors = ["Negro", "Blanco", "Rosa", "Verde Azulado", "Azul Ultramar"]
                storages = ["128 GB", "256 GB", "512 GB"]
                default_color = "Negro"
                default_storage = "128 GB"
            elif "iphone 15 pro" in m_lower or "15 pro" in m_lower:
                colors = ["Titanio Natural", "Titanio Azul", "Titanio Blanco", "Titanio Negro"]
                storages = ["128 GB", "256 GB", "512 GB", "1 TB"]
                default_color = "Titanio Natural"
                default_storage = "256 GB" if "max" in m_lower else "128 GB"
            elif "iphone 15" in m_lower:
                colors = ["Negro", "Azul", "Verde", "Amarillo", "Rosa"]
                storages = ["128 GB", "256 GB", "512 GB"]
                default_color = "Negro"
                default_storage = "128 GB"
            elif "iphone 14 pro" in m_lower or "14 pro" in m_lower:
                colors = ["Deep Purple (Morado Oscuro)", "Negro Espacial", "Oro", "Plata"]
                storages = ["128 GB", "256 GB", "512 GB", "1 TB"]
                default_color = "Deep Purple (Morado Oscuro)"
                default_storage = "128 GB"
            elif "iphone 14" in m_lower:
                colors = ["Medianoche (Negro)", "Blanco Estrella", "Azul", "Púrpura", "Rojo (PRODUCT)RED", "Amarillo"]
                storages = ["128 GB", "256 GB", "512 GB"]
                default_color = "Medianoche (Negro)"
                default_storage = "128 GB"
            elif "iphone 13 pro" in m_lower or "13 pro" in m_lower:
                colors = ["Azul Sierra", "Grafito", "Oro", "Plata", "Verde Alpino"]
                storages = ["128 GB", "256 GB", "512 GB", "1 TB"]
                default_color = "Azul Sierra"
                default_storage = "128 GB"
            elif "iphone 13" in m_lower:
                colors = ["Medianoche", "Blanco Estrella", "Azul", "Rosa", "Verde", "Rojo"]
                storages = ["128 GB", "256 GB", "512 GB"]
                default_color = "Medianoche"
                default_storage = "128 GB"
            elif "iphone 12 pro" in m_lower or "12 pro" in m_lower:
                colors = ["Azul Pacífico", "Grafito", "Oro", "Plata"]
                storages = ["128 GB", "256 GB", "512 GB"]
                default_color = "Azul Pacífico"
                default_storage = "128 GB"
            elif "iphone 12" in m_lower:
                colors = ["Negro", "Blanco", "Azul", "Verde", "Rojo", "Púrpura"]
                storages = ["64 GB", "128 GB", "256 GB"]
                default_color = "Negro"
                default_storage = "128 GB"
            elif "iphone 11 pro" in m_lower or "11 pro" in m_lower:
                colors = ["Verde Noche", "Gris Espacial", "Plata", "Oro"]
                storages = ["64 GB", "256 GB", "512 GB"]
                default_color = "Verde Noche"
                default_storage = "256 GB"
            elif "iphone 11" in m_lower:
                colors = ["Negro", "Blanco", "Verde", "Amarillo", "Púrpura", "Rojo"]
                storages = ["64 GB", "128 GB", "256 GB"]
                default_color = "Negro"
                default_storage = "128 GB"
            elif "ipad" in m_lower:
                colors = ["Gris Espacial", "Plata", "Oro Rosa", "Azul"]
                storages = ["64 GB", "128 GB", "256 GB", "512 GB"]
                default_color = "Gris Espacial"
                default_storage = "64 GB"
                device_type = "Tablet"
            else:
                colors = ["Gris Espacial", "Plata", "Oro", "Negro"]
                storages = ["64 GB", "128 GB", "256 GB"]
                default_color = "Gris Espacial"
                default_storage = "128 GB"

        # --- SAMSUNG ---
        elif "samsung" in b_lower:
            if "ultra" in m_lower:
                colors = ["Titanium Black", "Titanium Gray", "Titanium Violet", "Titanium Yellow", "Phantom Black", "Green"]
                storages = ["256 GB", "512 GB", "1 TB"]
                default_color = "Titanium Black"
                default_storage = "256 GB"
            elif "flip" in m_lower or "fold" in m_lower:
                colors = ["Phantom Black", "Cream", "Icy Blue", "Mint", "Graphite", "Lavender"]
                storages = ["256 GB", "512 GB", "1 TB"]
                default_color = "Phantom Black"
                default_storage = "256 GB"
            elif "s2" in m_lower: # S20, S21, S22, S23, S24
                colors = ["Phantom Black", "Cream", "Green", "Lavender", "Graphite", "Violet"]
                storages = ["128 GB", "256 GB", "512 GB"]
                default_color = "Phantom Black"
                default_storage = "128 GB"
            elif "a" in m_lower: # Galaxy A14, A15, A24, A34, A54, A55
                colors = ["Awesome Black (Negro)", "Awesome Blue (Azul)", "Awesome Lime (Verde Lima)", "Awesome Lilac (Lila)", "Awesome Graphite"]
                storages = ["128 GB", "256 GB", "64 GB"]
                default_color = "Awesome Black (Negro)"
                default_storage = "128 GB"
            else:
                colors = ["Negro Phantom", "Plata", "Azul", "Verde"]
                storages = ["64 GB", "128 GB", "256 GB"]
                default_color = "Negro Phantom"
                default_storage = "128 GB"

        # --- MOTOROLA ---
        elif "motorola" in b_lower:
            colors = ["Midnight Blue (Azul)", "Marshmallow Blue", "Viva Magenta", "Negro Carbón", "Azul Océano", "Gris Grafito"]
            storages = ["128 GB", "256 GB", "512 GB", "64 GB"]
            default_color = "Midnight Blue (Azul)"
            default_storage = "256 GB" if ("g84" in m_lower or "edge" in m_lower) else "128 GB"

        # --- XIAOMI / REDMI / POCO ---
        elif any(x in b_lower or x in m_lower for x in ["xiaomi", "redmi", "poco"]):
            colors = ["Midnight Black (Negro)", "Glacier Blue (Azul)", "Aurora Purple (Púrpura)", "Titanium Gray", "Moonlight White"]
            storages = ["128 GB", "256 GB", "512 GB", "64 GB"]
            default_color = "Midnight Black (Negro)"
            default_storage = "256 GB" if ("pro" in m_lower or "poco" in m_lower) else "128 GB"

        # --- GOOGLE ---
        elif "google" in b_lower:
            colors = ["Obsidian (Negro)", "Porcelain (Blanco)", "Bay (Azul)", "Hazel", "Rose"]
            storages = ["128 GB", "256 GB", "512 GB"]
            default_color = "Obsidian (Negro)"
            default_storage = "128 GB"

        return {
            "device_type": device_type,
            "colors": colors,
            "default_color": default_color,
            "storages": storages,
            "default_storage": default_storage
        }

    @classmethod
    def lookup_imei(cls, imei: str) -> Dict[str, Any]:
        """
        Busca el equipo por IMEI (o TAC) en la base de datos oficial SQLite y deduce sus características.
        """
        if not imei:
            return {"found": False, "message": "IMEI vacío"}

        clean_imei = re.sub(r"\D", "", imei)
        if len(clean_imei) < 8:
            return {
                "found": False,
                "clean_imei": clean_imei,
                "message": f"Se requieren al menos 8 dígitos para consultar el TAC (ingresados: {len(clean_imei)})"
            }

        tac = clean_imei[:8]
        is_luhn_valid = cls.calculate_luhn(clean_imei) if len(clean_imei) == 15 else None

        record = None
        if DB_PATH.exists():
            try:
                conn = sqlite3.connect(str(DB_PATH))
                cur = conn.cursor()
                cur.execute("SELECT tac, brand, model, specs FROM tac_records WHERE tac = ?", (tac,))
                record = cur.fetchone()
                conn.close()
            except Exception as e:
                print(f"[IMEIService] Error consultando tac.db: {e}")

        if record:
            _, brand, model, specs = record
            # Limpiar nombre de marca
            brand = brand.strip().title()
            # Ajustar modelo
            model = model.strip()
            # Si el modelo incluye la marca, remover prefijo redundante
            if model.lower().startswith(brand.lower()):
                model = model[len(brand):].strip()
            
            # Normalizar nombres como "Iphone" a "iPhone"
            model = re.sub(r"\bIphone\b", "iPhone", model, flags=re.IGNORECASE)
            model = re.sub(r"\bIpad\b", "iPad", model, flags=re.IGNORECASE)

            attrs = cls.infer_device_attributes(brand, model)

            return {
                "found": True,
                "imei": clean_imei,
                "tac": tac,
                "brand": brand,
                "model": model,
                "color": "",  # No forzar un color arbitrario que pueda diferir del equipo físico real
                "default_color": attrs["default_color"],
                "available_colors": attrs["colors"],
                "storage": attrs["default_storage"],
                "available_storages": attrs["storages"],
                "device_type": attrs["device_type"],
                "specs": specs,
                "is_valid_luhn": is_luhn_valid,
                "source": "tac_database"
            }

        # Búsqueda de reserva (Heurística o dispositivos ultra comunes)
        # Prefijos conocidos: 35 = GSM global, 86 = Xiaomi/Huawei/China, 01 = USA/PTCRB
        heuristic_brand = "Celular Multimarca"
        heuristic_model = f"Terminal TAC {tac}"
        
        if tac.startswith("35"):
            heuristic_brand = "Apple / Samsung / Global"
        elif tac.startswith("86"):
            heuristic_brand = "Xiaomi / Motorola / BBK"

        attrs = cls.infer_device_attributes(heuristic_brand, heuristic_model)

        return {
            "found": False,
            "imei": clean_imei,
            "tac": tac,
            "suggested_brand": heuristic_brand,
            "suggested_model": "",
            "color": attrs["default_color"],
            "available_colors": attrs["colors"],
            "storage": attrs["default_storage"],
            "available_storages": attrs["storages"],
            "device_type": attrs["device_type"],
            "is_valid_luhn": is_luhn_valid,
            "message": f"TAC {tac} no registrado en catálogo local. Puedes ingresar marca y modelo manualmente."
        }
