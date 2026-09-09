import re
import io
from typing import List, Dict, Any, Tuple, Optional
import pandas as pd

def clean_header(val: Any) -> str:
    """Normaliza el texto de un encabezado a minúsculas y sin acentos ni caracteres raros."""
    if not val or pd.isna(val):
        return ""
    text = str(val).strip().lower()
    text = text.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    return re.sub(r"[^\w\s]", "", text)

def parse_price(val: Any) -> float:
    """Extrae un valor numérico de precio de forma robusta soportando formatos argentinos y globales."""
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else 0.0

    s = str(val).strip()
    s = re.sub(r"[^\d.,]", "", s)
    if not s:
        return 0.0

    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) in [1, 2]:
            s = s.replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "." in s:
        parts = s.split(".")
        if len(parts) > 1 and len(parts[-1]) == 3 and len(parts) > 2:
            s = s.replace(".", "")
        elif len(parts) == 2 and len(parts[1]) > 2:
            s = s.replace(".", "")

    try:
        return float(s)
    except Exception:
        return 0.0

def ensure_string_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Garantiza que todas las columnas del DataFrame sean cadenas de texto únicas y limpias."""
    clean_cols = []
    seen = {}
    for i, col in enumerate(df.columns):
        if pd.isna(col) or str(col).strip().lower() in ["nan", "none", ""]:
            c_str = f"Columna_{i+1}"
        else:
            c_str = str(col).strip()
        
        if c_str in seen:
            seen[c_str] += 1
            c_str = f"{c_str}_{seen[c_str]}"
        else:
            seen[c_str] = 1
        clean_cols.append(c_str)
    
    df.columns = clean_cols
    return df

def safe_get_row_val(row: pd.Series, col_name: Optional[str]) -> Any:
    """Acceso ultra-seguro a un valor de la fila sin lanzar KeyError si la clave varía de tipo."""
    if not col_name:
        return None
    try:
        return row[col_name]
    except Exception:
        col_str = str(col_name).strip()
        for k in row.index:
            if str(k).strip() == col_str:
                return row[k]
        return None

def detect_columns(df: pd.DataFrame) -> Dict[str, Optional[str]]:
    """Detecta inteligentemente cuáles columnas corresponden a Descripción, Precio, SKU, Marca y Stock."""
    columns = [str(c) for c in df.columns]
    mapping = {
        "description": None,
        "price": None,
        "sku": None,
        "brand": None,
        "stock": None
    }

    desc_keywords = ["descripc", "producto", "detalle", "articulo", "repuesto", "item", "nombre", "modelo", "denominac"]
    price_keywords = ["precio gremio", "precio efectivo", "precio lista", "gremio", "efectivo", "precio", "costo", "valor", "importe", "usd", "ars", "pesos"]
    sku_keywords = ["codigo", "cod", "sku", "art", "id", "ref", "nro", "clave"]
    brand_keywords = ["marca", "linea", "fabricante", "familia"]
    stock_keywords = ["stock", "cant", "disponible", "disp", "existencia", "estado"]

    for col in columns:
        cleaned = clean_header(col)
        if any(kw in cleaned for kw in desc_keywords):
            mapping["description"] = col
            break

    for col in columns:
        cleaned = clean_header(col)
        if any(kw in cleaned for kw in price_keywords):
            mapping["price"] = col
            break

    for col in columns:
        cleaned = clean_header(col)
        if col != mapping["description"] and any(kw in cleaned for kw in sku_keywords):
            mapping["sku"] = col
            break

    for col in columns:
        cleaned = clean_header(col)
        if col not in [mapping["description"], mapping["sku"], mapping["price"]] and any(kw in cleaned for kw in brand_keywords):
            mapping["brand"] = col
            break

    for col in columns:
        cleaned = clean_header(col)
        if col not in [mapping["description"], mapping["sku"], mapping["price"]] and any(kw in cleaned for kw in stock_keywords):
            mapping["stock"] = col
            break

    if not mapping["description"]:
        best_col = None
        max_avg_len = 0
        for col in columns:
            if col == mapping["price"]:
                continue
            str_series = df[col].astype(str)
            avg_len = str_series.str.len().mean()
            if avg_len > max_avg_len:
                max_avg_len = avg_len
                best_col = col
        mapping["description"] = best_col

    if not mapping["price"]:
        for col in columns:
            if col != mapping["description"]:
                numeric_count = pd.to_numeric(df[col].astype(str).str.replace(r"[^\d.]", "", regex=True), errors="coerce").notnull().sum()
                if numeric_count > len(df) * 0.4:
                    mapping["price"] = col
                    break

    return mapping

def parse_price_list_file(file_content: bytes, filename: str, default_currency: str = "ARS") -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Lee un archivo Excel (.xlsx, .xls) o CSV y extrae la lista normalizada de repuestos.
    Retorna (items, metadata).
    """
    filename_lower = filename.lower()
    
    if filename_lower.endswith(".csv"):
        try:
            sample = file_content[:4096].decode("utf-8", errors="ignore")
            sep = ";" if sample.count(";") > sample.count(",") else ","
            df = pd.read_csv(io.BytesIO(file_content), sep=sep, dtype=str)
        except Exception:
            df = pd.read_csv(io.BytesIO(file_content), dtype=str)
    else:
        try:
            df = pd.read_excel(io.BytesIO(file_content), dtype=str)
        except Exception:
            df = pd.read_excel(io.BytesIO(file_content), engine="openpyxl", dtype=str)

    df = ensure_string_columns(df)

    unnamed_count = sum(1 for c in df.columns if "unnamed" in str(c).lower())
    if len(df) > 0 and (unnamed_count > len(df.columns) / 2):
        for i in range(min(5, len(df))):
            row_vals = df.iloc[i].dropna().astype(str).tolist()
            if len(row_vals) >= 2 and any(clean_header(v) in ["descripcion", "producto", "precio", "codigo"] for v in row_vals):
                df.columns = df.iloc[i]
                df = df.iloc[i + 1:].reset_index(drop=True)
                df = ensure_string_columns(df)
                break

    df = df.loc[:, ~df.columns.duplicated()]
    df = df.dropna(how="all")

    col_map = detect_columns(df)
    desc_col = col_map.get("description")
    price_col = col_map.get("price")
    sku_col = col_map.get("sku")
    brand_col = col_map.get("brand")
    stock_col = col_map.get("stock")

    if not desc_col:
        raise ValueError("No se pudo identificar una columna de descripción o nombre de producto en el archivo.")

    items: List[Dict[str, Any]] = []
    known_brands = ["iphone", "apple", "samsung", "motorola", "moto", "xiaomi", "redmi", "huawei", "tcl", "zte", "lg", "alcatel", "nokia", "sony", "poco", "infinix", "tecno"]

    for idx, row in df.iterrows():
        raw_desc = safe_get_row_val(row, desc_col)
        desc_val = str(raw_desc).strip() if raw_desc is not None and pd.notna(raw_desc) else ""
        if not desc_val or desc_val.lower() in ["nan", "none", "total", "subtotal"]:
            continue

        price_val = 0.0
        raw_price = safe_get_row_val(row, price_col)
        if raw_price is not None and pd.notna(raw_price):
            price_val = parse_price(raw_price)

        if price_val <= 0:
            continue

        sku_val = ""
        raw_sku = safe_get_row_val(row, sku_col)
        if raw_sku is not None and pd.notna(raw_sku):
            sku_val = str(raw_sku).strip()
        if not sku_val or sku_val.lower() in ["nan", "none"]:
            sku_val = f"EX-{abs(hash(desc_val)) % 1000000:06d}"

        brand_val = ""
        raw_brand = safe_get_row_val(row, brand_col)
        if raw_brand is not None and pd.notna(raw_brand):
            brand_val = str(raw_brand).strip().capitalize()
        if not brand_val or brand_val.lower() in ["nan", "none"]:
            desc_lower = desc_val.lower()
            for b in known_brands:
                if b in desc_lower:
                    brand_val = "Apple" if b == "iphone" else ("Motorola" if b == "moto" else b.capitalize())
                    break
        if not brand_val:
            brand_val = "Genérico / Multimarca"

        stock_val = "Disponible"
        has_stock = True
        raw_stock = safe_get_row_val(row, stock_col)
        if raw_stock is not None and pd.notna(raw_stock):
            s_raw = str(raw_stock).strip().lower()
            if s_raw in ["0", "no", "agotado", "sin stock", "false"]:
                stock_val = "Sin stock"
                has_stock = False
            elif s_raw in ["si", "disponible", "en stock", "true"]:
                stock_val = "Disponible"
                has_stock = True
            else:
                stock_val = str(raw_stock).strip()
                has_stock = True

        items.append({
            "sku": sku_val,
            "description": desc_val,
            "brand": brand_val,
            "price": price_val,
            "currency": default_currency.upper(),
            "stock": stock_val,
            "has_stock": has_stock,
            "raw_row": idx + 1
        })

    metadata = {
        "filename": filename,
        "total_imported": len(items),
        "columns_detected": {k: str(v) for k, v in col_map.items() if v}
    }

    return items, metadata
