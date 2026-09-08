import re
import unicodedata
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Set
from backend.database.models import PartResult

def normalize_str(text: str) -> str:
    """Elimina acentos, pasa a minúsculas y normaliza espacios."""
    if not text:
        return ""
    nfkd = unicodedata.normalize('NFKD', text)
    cleaned = ''.join(c for c in nfkd if not unicodedata.combining(c))
    cleaned = cleaned.lower()
    # Reemplazar caracteres especiales por espacios salvo letras y números
    cleaned = re.sub(r"[^\w\s\+]", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()

# Categorías reconocidas y sus palabras clave
CATEGORY_KEYWORDS = {
    "modulo": [
        "modulo", "pantalla", "display", "lcd", "oled", "amoled", "tactil",
        "touch", "screen", "incell", "fhd"
    ],
    "bateria": [
        "bateria", "battery", "pila"
    ],
    "pin_carga": [
        "pin de carga", "pin carga", "placa de carga", "placa carga",
        "subplaca", "sub placa", "sub-placa", "conector de carga", "puerto de carga"
    ],
    "tapa": [
        "tapa trasera", "tapa de bateria", "tapa bateria", "back cover",
        "tapa", "carcasa", "chasis"
    ],
    "camara": [
        "camara trasera", "camara frontal", "lente de camara", "lente camara", "camara"
    ],
    "flex": [
        "cable flex", "flex de carga", "flex interconexion", "flex encendido",
        "flex volumen", "flex"
    ],
    "vidrio": [
        "glass", "vidrio", "oca"
    ],
    "audio": [
        "auricular", "altavoz", "parlante", "speaker", "buzzer"
    ],
    "bandeja_sim": [
        "bandeja sim", "porta sim", "porta chip", "sim tray", "lector sim"
    ]
}

# Palabras que descartan un producto si el usuario buscó cierta categoría
ANTI_NOISE_EXCLUSIONS = {
    "modulo": [
        "protector de lente", "protector lente", "protector metalico", "protector camara",
        "protector fluor", "funda", "case", "cover", "silicona",
        "tapa trasera", "tapa de bateria", "tapa bateria", "tapa para",
        "bateria", "pila", "pin de carga", "placa de carga", "subplaca", "sub placa",
        "vidrio templado", "glass templado", "hidrogel",
        "tag on", "jc flex face id", "flex flash", "speaker", "altavoz", "parlante",
        "auricular", "porta sim", "bandeja sim", "antena", "tornillo", "destornillador"
    ],
    "bateria": [
        "modulo", "pantalla", "display", "lcd", "oled", "amoled",
        "tapa trasera", "tapa de bateria", "funda", "case", "silicona",
        "protector", "pin de carga", "placa de carga", "subplaca",
        "vidrio templado", "glass templado", "hidrogel", "tag on"
    ],
    "pin_carga": [
        "modulo", "pantalla", "display", "lcd", "oled",
        "bateria", "pila", "tapa", "funda", "case", "protector"
    ],
    "tapa": [
        "modulo", "pantalla", "display", "lcd", "oled", "bateria", "pin de carga"
    ],
    "camara": [
        "modulo", "pantalla", "display", "bateria", "funda", "case"
    ]
}

BRANDS_MAP = {
    "apple": ["iphone", "ipad", "apple", "ipod"],
    "samsung": ["samsung", "galaxy"],
    "motorola": ["motorola", "moto"],
    "xiaomi": ["xiaomi", "redmi", "poco"],
    "huawei": ["huawei", "honor"],
    "lg": ["lg"],
    "tcl": ["tcl"],
    "zte": ["zte", "blade"],
    "nokia": ["nokia"],
    "oppo": ["oppo"],
    "realme": ["realme"],
    "alcatel": ["alcatel"],
    "sony": ["sony", "xperia"]
}

# Marcas incompatibles entre sí
CROSS_BRAND_CONFLICTS = {
    "apple": ["samsung", "motorola", "moto ", "xiaomi", "redmi", "poco", "oppo", "tcl", "zte", "nokia", "huawei", "honor", "alcatel"],
    "samsung": ["iphone", "apple", "ipad", "motorola", "moto ", "xiaomi", "redmi", "poco", "oppo", "tcl", "zte"],
    "motorola": ["iphone", "apple", "samsung", "galaxy", "xiaomi", "redmi", "poco", "oppo"],
    "xiaomi": ["iphone", "apple", "samsung", "galaxy", "motorola", "moto "],
    "tcl": ["iphone", "apple", "samsung", "motorola"],
    "oppo": ["iphone", "apple", "samsung", "motorola"]
}

VARIANTS = ["pro max", "pro", "plus", "ultra", "mini", "lite", "fe", "5g", "4g", "play", "power", "se"]

IPHONE_MODELS = [
    "16 pro max", "16 pro", "16 plus", "16",
    "15 pro max", "15 pro", "15 plus", "15",
    "14 pro max", "14 pro", "14 plus", "14",
    "13 pro max", "13 pro", "13 mini", "13",
    "12 pro max", "12 pro", "12 mini", "12",
    "11 pro max", "11 pro", "11",
    "xs max", "xs", "xr", "x",
    "8 plus", "8", "7 plus", "7", "6s plus", "6s", "6 plus", "6", "se 2020", "se 2022", "se"
]

@dataclass
class QueryIntent:
    raw_query: str
    normalized: str
    category: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    variants: List[str] = field(default_factory=list)
    tokens: List[str] = field(default_factory=list)
    is_general: bool = False

def parse_query_intent(query: str) -> QueryIntent:
    norm = normalize_str(query)
    tokens = [t for t in norm.split() if len(t) > 0]
    
    # 1. Detectar Categoría
    detected_category = None
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in sorted(keywords, key=len, reverse=True):
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, norm):
                detected_category = cat
                break
        if detected_category:
            break

    # 2. Detectar Marca
    detected_brand = None
    for brand_key, aliases in BRANDS_MAP.items():
        for al in aliases:
            if re.search(r'\b' + re.escape(al) + r'\b', norm):
                detected_brand = brand_key
                break
        if detected_brand:
            break

    # 3. Detectar Variantes (pro, max, etc.)
    found_variants = []
    for var in VARIANTS:
        if re.search(r'\b' + re.escape(var) + r'\b', norm):
            found_variants.append(var)

    # 4. Detectar Número de Modelo o Código
    # Por ejemplo "14", "a52", "g8", "s23", "a03"
    detected_model_number = None
    
    # Caso iPhone
    if detected_brand == "apple" or "iphone" in norm:
        for im in IPHONE_MODELS:
            # Buscar coincidencia exacta de modelo de iPhone en query
            pat = r'\b' + re.escape(im) + r'\b'
            if re.search(pat, norm):
                detected_model_number = im
                break
        if not detected_model_number:
            m = re.search(r'\b(1[1-6]|[6-8]|x[rs]?|se)\b', norm)
            if m:
                detected_model_number = m.group(1)

    # Caso Samsung (A52, S23, A03, etc.)
    elif detected_brand == "samsung" or re.search(r'\b[as]\d{1,2}\b', norm):
        m = re.search(r'\b([as]\d{1,2}[a-z]?)\b', norm)
        if m:
            detected_model_number = m.group(1)

    # Caso Moto (G8, G22, E7, etc.)
    elif detected_brand == "motorola" or re.search(r'\b[ge]\d{1,2}\b', norm):
        m = re.search(r'\b([ge]\d{1,2})\b', norm)
        if m:
            detected_model_number = m.group(1)

    # Si no hubo match específico, buscar cualquier número relevante (ej: "14", "22")
    if not detected_model_number:
        m_num = re.search(r'\b\d{1,3}\b', norm)
        if m_num:
            detected_model_number = m_num.group(0)

    is_gen = (detected_category is None and detected_brand is None and detected_model_number is None)

    return QueryIntent(
        raw_query=query,
        normalized=norm,
        category=detected_category,
        brand=detected_brand,
        model_number=detected_model_number,
        variants=found_variants,
        tokens=tokens,
        is_general=is_gen
    )

def evaluate_part_relevance(intent: QueryIntent, item: PartResult, strict: bool = True) -> Tuple[bool, int, str]:
    """
    Evalúa la relevancia de un repuesto respecto a la intención de búsqueda.
    Retorna: (es_valido, puntaje_0_a_100, nivel_match)
    """
    desc_norm = normalize_str(item.description)
    brand_norm = normalize_str(item.brand or "")
    combined = f"{desc_norm} {brand_norm}"

    # Si es una consulta general (ej: "destornillador torx", "alcohol isopropilico")
    if intent.is_general:
        # Validar que todos los tokens significativos estén presentes
        for t in intent.tokens:
            if len(t) > 2 and t not in combined:
                return False, 0, "none"
        return True, 80, "high"

    score = 0

    # -------------------------------------------------------------
    # 1. Reglas Anti-Ruido de Categoría (Exclusiones Duras)
    # -------------------------------------------------------------
    if intent.category:
        anti_noise = ANTI_NOISE_EXCLUSIONS.get(intent.category, [])
        for bad_kw in anti_noise:
            # Si el usuario NO incluyó esta palabra en su búsqueda, pero el producto sí la tiene
            if bad_kw not in intent.normalized:
                bad_pat = r'\b' + re.escape(bad_kw) + r'\b'
                if re.search(bad_pat, desc_norm):
                    # Excepción especial: Si el producto dice "modulo" y además "tactil" o "con marco", es válido.
                    # Pero si dice "protector de lente", "tapa trasera", "funda", "bateria" cuando se pidió modulo: DESCARTE TOTAL.
                    return False, 0, "excluded_noise"

        # Verificar si el producto efectivamente pertenece a la categoría pedida
        cat_keywords = CATEGORY_KEYWORDS.get(intent.category, [])
        has_category = False
        for ckw in cat_keywords:
            if re.search(r'\b' + re.escape(ckw) + r'\b', desc_norm):
                has_category = True
                break

        if has_category:
            score += 35
        else:
            # Si el usuario explícitamente pidió "modulo" y el producto no menciona modulo/pantalla/display/lcd/oled/incell
            if strict:
                return False, 0, "category_mismatch"
            score += 0

    # -------------------------------------------------------------
    # 2. Aislamiento Estricto de Marca
    # -------------------------------------------------------------
    if intent.brand:
        # Verificar conflictos con otras marcas
        conflicts = CROSS_BRAND_CONFLICTS.get(intent.brand, [])
        for conf in conflicts:
            conf_pat = r'\b' + re.escape(conf.strip()) + r'\b'
            if re.search(conf_pat, combined):
                # Conflicto directo de marca (ej: usuario busca iPhone y el repuesto es Samsung)
                return False, 0, "brand_conflict"

        # Verificar si la marca del usuario está presente
        brand_aliases = BRANDS_MAP.get(intent.brand, [])
        has_brand = any(re.search(r'\b' + re.escape(al) + r'\b', combined) for al in brand_aliases)
        if has_brand:
            score += 25
        else:
            # Si la marca no está explícita en el título pero no hay conflicto
            score += 10

    # -------------------------------------------------------------
    # 3. Coincidencia de Modelo / Número de Generación
    # -------------------------------------------------------------
    if intent.model_number:
        # Caso especial iPhone: distinguir generaciones (14 vs 11, 12, 13, 15)
        if intent.brand == "apple" or "iphone" in intent.normalized:
            # Extraer número base si tiene variante (ej: "14 pro" -> base "14")
            base_num = intent.model_number.split()[0]
            
            # Verificar si el producto contiene el número de modelo
            num_pat = r'\b' + re.escape(base_num) + r'\b'
            if not re.search(num_pat, desc_norm):
                # No contiene el número de modelo
                return False, 0, "model_mismatch"

            # Verificar que no sea otra generación de iPhone diferente
            other_generations = ["11", "12", "13", "14", "15", "16", "8", "7", "6", "x", "xr", "xs"]
            for og in other_generations:
                if og != base_num:
                    og_pat = r'\biphone\s+' + re.escape(og) + r'\b'
                    # Si menciona "iphone 11" y el usuario pidió "14", descartar
                    if re.search(og_pat, desc_norm) and not re.search(r'\biphone\s+' + re.escape(base_num) + r'\b', desc_norm):
                        return False, 0, "wrong_generation"

            score += 30

            # Manejo de variantes (Pro, Pro Max, Plus)
            req_pro = "pro" in intent.variants or "pro" in intent.normalized
            req_max = "max" in intent.variants or "max" in intent.normalized
            req_plus = "plus" in intent.variants or "plus" in intent.normalized

            prod_has_pro = bool(re.search(r'\bpro\b', desc_norm))
            prod_has_max = bool(re.search(r'\bmax\b', desc_norm))
            prod_has_plus = bool(re.search(r'\bplus\b', desc_norm))

            # Caso 1: El usuario pidió modelo base exacto (ej: "modulo iphone 14" sin pro ni max)
            if not req_pro and not req_max and not req_plus:
                if not prod_has_pro and not prod_has_max:
                    # Coincidencia exacta de modelo base
                    score += 10
                    tier = "exact"
                else:
                    # Es variante (ej: 14 pro), pero de la misma familia 14
                    tier = "variant"
            # Caso 2: El usuario pidió Pro o Pro Max
            elif req_pro and req_max:
                if prod_has_pro and prod_has_max:
                    score += 10
                    tier = "exact"
                else:
                    tier = "variant"
            elif req_pro and not req_max:
                if prod_has_pro and not prod_has_max:
                    score += 10
                    tier = "exact"
                else:
                    tier = "variant"
            elif req_plus:
                if prod_has_plus:
                    score += 10
                    tier = "exact"
                else:
                    tier = "variant"
            else:
                tier = "high"

        # Caso Samsung / Motorola / Otras marcas
        else:
            mod_pat = r'\b' + re.escape(intent.model_number) + r'\b'
            if re.search(mod_pat, desc_norm):
                score += 30
                tier = "exact"
            else:
                # Comprobar si al menos los dígitos o identificador coinciden
                clean_id = re.sub(r"[^\w]", "", intent.model_number)
                if clean_id and clean_id in re.sub(r"[^\w]", "", desc_norm):
                    score += 20
                    tier = "high"
                else:
                    if strict:
                        return False, 0, "model_mismatch"
                    tier = "medium"
    else:
        tier = "high" if score >= 60 else "medium"

    # Umbral de aprobación
    min_threshold = 55 if strict else 30
    is_valid = score >= min_threshold
    return is_valid, score, tier

def filter_and_rank_parts(query: str, items: List[PartResult], strict: bool = True) -> Tuple[List[PartResult], int]:
    """
    Filtra y ordena los repuestos según relevancia semántica y precio.
    Devuelve (items_filtrados, cantidad_descartados).
    """
    if not items or not query.strip():
        return items, 0

    intent = parse_query_intent(query)
    
    valid_items: List[PartResult] = []
    discarded_count = 0

    for it in items:
        is_ok, sc, tier = evaluate_part_relevance(intent, it, strict=strict)
        if is_ok:
            it.relevance_score = sc
            it.match_tier = tier
            valid_items.append(it)
        else:
            discarded_count += 1

    # Si el filtro estricto descartó todo por ser demasiado restrictivo,
    # evaluar en modo permisivo para no dejar la pantalla vacía
    if not valid_items and strict and len(items) > 0:
        for it in items:
            is_ok, sc, tier = evaluate_part_relevance(intent, it, strict=False)
            if is_ok:
                it.relevance_score = sc
                it.match_tier = "medium"
                valid_items.append(it)
        discarded_count = len(items) - len(valid_items)

    # Ordenar:
    # 1. Disponibilidad de Stock (con stock primero)
    # 2. Nivel de coincidencia ("exact" primero)
    # 3. Puntaje de relevancia descendente
    # 4. Precio ascendente
    tier_order = {"exact": 0, "high": 1, "variant": 2, "medium": 3, "none": 4}
    
    valid_items.sort(
        key=lambda p: (
            not p.has_stock,
            tier_order.get(p.match_tier or "medium", 3),
            - (p.relevance_score or 0),
            p.price if p.price > 0 else 999999999
        )
    )

    return valid_items, discarded_count
