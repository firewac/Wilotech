import re
from typing import List, Dict, Any, Optional, Tuple, Set
from backend.database.models import PartResult

# Familias de tipos de repuesto
COMPONENT_CATEGORIES = {
    "modulo": {
        "keywords": ["modulo", "módulo", "pantalla", "display", "oled", "incell", "amoled", "lcd", "touch", "tactil", "táctil"],
        "excludes": [
            "protector de lente", "protector lente", "lente de camara", "lente camara", 
            "tapa trasera", "cubierta trasera", "bateria", "batería", 
            "pin de carga", "placa de carga", "flex de carga", "porta sim", "bandeja sim", 
            "funda", "antichoque", "templado", "vidrio templado", "pegamento", "b-7000", "t-7000"
        ]
    },
    "bateria": {
        "keywords": ["bateria", "batería", "pila", "battery"],
        "excludes": [
            "conector de bateria", "conector bateria", "fpc", "tag on", "adhesivo", "cinta", 
            "modulo", "módulo", "pantalla", "display", "tapa trasera", "pin de carga", 
            "placa de carga", "camara", "cámara", "funda"
        ]
    },
    "pin_carga": {
        "keywords": ["pin de carga", "pin carga", "placa de carga", "placa carga", "subplaca", "sub board", "flex de carga", "flex carga", "puerto de carga", "conector de carga"],
        "excludes": ["modulo", "módulo", "pantalla", "display", "bateria", "batería", "tapa trasera", "funda"]
    },
    "camara": {
        "keywords": ["camara", "cámara", "lente de camara", "lente de cámara", "lente camara", "camara frontal", "camara trasera"],
        "excludes": ["modulo", "módulo", "bateria", "batería", "funda"]
    },
    "tapa": {
        "keywords": ["tapa", "cubierta", "back cover", "carcasa trasera", "chasis"],
        "excludes": ["modulo", "módulo", "pantalla", "display", "bateria", "batería", "pin de carga"]
    },
    "flex": {
        "keywords": ["flex", "cable flex", "flex power", "flex volumen", "flex huella", "flex flash", "flex antena"],
        "excludes": ["modulo", "módulo", "pantalla", "display", "bateria", "batería", "pin de carga"]
    },
    "glass": {
        "keywords": ["glass", "vidrio", "cristal", "oca"],
        "excludes": ["bateria", "batería", "pin de carga", "placa de carga", "funda"]
    }
}

# Modelos numéricos conocidos de iPhone para evitar mezclar generaciones (ej: 12 vs 13, 11, 14, 15, 16)
IPHONE_MODELS = ["16", "15", "14", "13", "12", "11", "xr", "xs", "x", "8", "7", "6s", "6"]

def normalize_text(text: str) -> str:
    """Normaliza texto para comparación: minúsculas, sin acentos ni puntuación extra."""
    if not text:
        return ""
    t = text.lower()
    t = t.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    t = re.sub(r"[^\w\s\+\-\/]", " ", t)
    return re.sub(r"\s+", " ", t).strip()

class PartMatcher:
    """Motor de validación semántica para asegurar que los repuestos coincidan en tipo y modelo."""

    @classmethod
    def detect_target_category(cls, query_norm: str) -> Optional[str]:
        """Detecta qué tipo de componente está buscando el usuario."""
        for cat, data in COMPONENT_CATEGORIES.items():
            for kw in data["keywords"]:
                pattern = r"\b" + re.escape(kw) + r"\b"
                if re.search(pattern, query_norm):
                    return cat
        return None

    @classmethod
    def detect_conflicting_model(cls, query_norm: str, desc_norm: str) -> bool:
        """
        Detecta si el repuesto pertenece a un modelo diferente incompatible.
        Ej: Si la búsqueda pide 'iphone 12', descarta si el producto es de 'iphone 13' o 'iphone 11' (y no menciona 12).
        """
        # 1. Chequeo de iPhone
        if "iphone" in query_norm or "apple" in query_norm:
            queried_iphone_model = None
            for m in IPHONE_MODELS:
                if re.search(r"\b(iphone|apple)?\s*" + re.escape(m) + r"\b", query_norm):
                    queried_iphone_model = m
                    break

            if queried_iphone_model:
                has_queried = bool(re.search(r"\b" + re.escape(queried_iphone_model) + r"\b", desc_norm))
                
                conflicting_models = [m for m in IPHONE_MODELS if m != queried_iphone_model]
                has_conflict = False
                for m in conflicting_models:
                    if re.search(r"\biphone\s*" + re.escape(m) + r"\b", desc_norm):
                        has_conflict = True
                        break

                if has_conflict and not has_queried:
                    return True
                
                if not has_queried:
                    return True

        # 2. Chequeo de Motorola serie G (ej: G8 vs G22, G9, G52)
        m_moto = re.search(r"\b(moto|motorola)?\s*g(\d{1,2})\b", query_norm)
        if m_moto:
            queried_g = f"g{m_moto.group(2)}"
            has_queried_g = bool(re.search(r"\b" + re.escape(queried_g) + r"\b", desc_norm))
            m_desc_g = re.search(r"\bg(\d{1,2})\b", desc_norm)
            if m_desc_g and m_desc_g.group(0) != queried_g and not has_queried_g:
                return True
            if not has_queried_g and "g" in query_norm:
                return True

        # 3. Chequeo de Samsung serie A (ej: A14 vs A54, A04, A13)
        m_sam = re.search(r"\b(samsung|galaxy)?\s*a(\d{1,2})\b", query_norm)
        if m_sam:
            queried_a = f"a{m_sam.group(2)}"
            has_queried_a = bool(re.search(r"\b" + re.escape(queried_a) + r"\b", desc_norm))
            m_desc_a = re.search(r"\ba(\d{1,2})\b", desc_norm)
            if m_desc_a and m_desc_a.group(0) != queried_a and not has_queried_a:
                return True
            if not has_queried_a:
                return True

        return False

    @classmethod
    def evaluate_relevance(cls, item: PartResult, query: str) -> Tuple[bool, float]:
        """
        Evalúa si un repuesto es relevante para la búsqueda y calcula un puntaje de 0 a 100.
        Retorna (is_valid, score).
        """
        if item.price < 0:
            return False, 0.0

        query_norm = normalize_text(query)
        desc_norm = normalize_text(f"{item.description} {item.brand} {item.sku}")

        if not query_norm or not desc_norm:
            return False, 0.0

        target_cat = cls.detect_target_category(query_norm)

        # 1. Validar categoría de componente
        if target_cat:
            cat_info = COMPONENT_CATEGORIES[target_cat]
            for excl in cat_info["excludes"]:
                if excl in desc_norm and excl not in query_norm:
                    return False, 0.0

            has_cat_kw = any(kw in desc_norm for kw in cat_info["keywords"])
            if not has_cat_kw:
                return False, 0.0

        # 2. Validar conflicto de modelo de celular
        if cls.detect_conflicting_model(query_norm, desc_norm):
            return False, 0.0

        # 3. Calcular puntaje de coincidencia de tokens
        query_tokens = [t for t in query_norm.split() if len(t) > 1]
        if not query_tokens:
            return True, 50.0

        matched_tokens = 0
        for token in query_tokens:
            pattern = r"\b" + re.escape(token) + r"\b"
            if re.search(pattern, desc_norm) or token in desc_norm:
                matched_tokens += 1

        match_ratio = matched_tokens / len(query_tokens)

        # Si no coincide al menos el 50% de las palabras clave, descartar
        if match_ratio < 0.5:
            return False, 0.0

        score = match_ratio * 70.0

        if target_cat:
            score += 20.0

        if item.has_stock:
            score += 10.0

        return True, min(score, 100.0)

    @classmethod
    def filter_and_rank_results(cls, parts: List[PartResult], query: str) -> List[PartResult]:
        """
        Filtra los resultados eliminando repuestos no pertinentes o con precios inválidos,
        y los ordena por stock, menor precio y relevancia.
        """
        scored_parts: List[Tuple[PartResult, float]] = []

        for p in parts:
            valid, score = cls.evaluate_relevance(p, query)
            if valid:
                scored_parts.append((p, score))

        # Si no hubo ninguna coincidencia estricta (por ejemplo, búsqueda de un código raro),
        # relajar el filtro solo a aquellos con precio > 0 y que contengan al menos un token
        if not scored_parts and parts:
            tokens = [t for t in normalize_text(query).split() if len(t) > 1]
            for p in parts:
                if p.price >= 0:
                    d_norm = normalize_text(p.description)
                    if any(t in d_norm for t in tokens):
                        scored_parts.append((p, 30.0))

        # Ordenar:
        # 1. Disponibilidad de stock (has_stock = True primero)
        # 2. Menor precio ascendente (precios mayor a 0 primero)
        scored_parts.sort(key=lambda x: (not x[0].has_stock, x[0].price if x[0].price > 0 else 999999999.0, -x[1]))

        return [item[0] for item in scored_parts]
