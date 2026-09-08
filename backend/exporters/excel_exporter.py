import io
import pandas as pd
from typing import List
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from backend.database.models import PartResult

def export_results_to_excel(results: List[PartResult], query: str) -> io.BytesIO:
    """Genera un archivo Excel (.xlsx) formateado con la comparativa de precios."""
    data = []
    for r in results:
        orig_str = f"U$D {r.original_price:.2f} (Blue ${r.exchange_rate_used:,.0f})" if r.original_price else "ARS Original"
        data.append({
            "Distribuidora": r.distributor_name,
            "Código / SKU": r.sku,
            "Descripción": r.description,
            "Marca": r.brand,
            "Precio (ARS)": r.price,
            "Moneda Original": orig_str,
            "Disponibilidad": r.stock,
            "Plazo de Entrega": r.delivery_time,
            "¿Mejor Precio?": "SÍ (MÁS CONVENIENTE)" if r.is_best_price else "No",
            "Enlace al Producto": r.product_url
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Comparativa de Precios", index=False)
        worksheet = writer.sheets["Comparativa de Precios"]
        
        # Estilos de cabecera
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Azul oscuro
        best_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid") # Verde suave
        best_font = Font(name="Calibri", size=11, bold=True, color="166534")
        
        thin_border = Border(
            left=Side(style='thin', color='CBD5E1'),
            right=Side(style='thin', color='CBD5E1'),
            top=Side(style='thin', color='CBD5E1'),
            bottom=Side(style='thin', color='CBD5E1')
        )
        
        # Formato de cabecera
        for col_idx in range(1, len(df.columns) + 1):
            cell = worksheet.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")
            
        # Formato de datos
        for row_idx, r in enumerate(results, start=2):
            is_best = r.is_best_price
            for col_idx in range(1, len(df.columns) + 1):
                cell = worksheet.cell(row=row_idx, column=col_idx)
                cell.border = thin_border
                
                # Resaltar la fila ganadora
                if is_best:
                    cell.fill = best_fill
                    if col_idx == 8: # Columna de Mejor Precio
                        cell.font = best_font
                
                # Formato numérico para el precio
                if col_idx == 5:
                    cell.number_format = '$ #,##0.00'
                    cell.alignment = Alignment(horizontal="right")
                elif col_idx in [1, 2, 4, 6, 7, 8]:
                    cell.alignment = Alignment(horizontal="center")
                else:
                    cell.alignment = Alignment(horizontal="left")
                    
        # Autoajustar ancho de columnas
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 4, 12)
            
    output.seek(0)
    return output

def export_results_to_csv(results: List[PartResult]) -> io.StringIO:
    """Genera un archivo CSV de texto plano para importación rápida."""
    data = []
    for r in results:
        data.append({
            "distribuidora": r.distributor_name,
            "sku": r.sku,
            "descripcion": r.description,
            "marca": r.brand,
            "precio_ars": r.price,
            "precio_original": r.original_price or "",
            "moneda_original": r.original_currency or "ARS",
            "dolar_blue_usado": r.exchange_rate_used or "",
            "stock": r.stock,
            "entrega": r.delivery_time,
            "es_mejor_precio": r.is_best_price,
            "url": r.product_url
        })
    df = pd.DataFrame(data)
    output = io.StringIO()
    df.to_csv(output, index=False, sep=";", encoding="utf-8-sig")
    output.seek(0)
    return output
