import sys
import time
import webbrowser
import threading
from pathlib import Path

# Asegurar que el directorio raíz esté en sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uvicorn
from backend.app import app

def open_browser():
    time.sleep(1.2)
    url = "http://127.0.0.1:8000"
    print(f"\n[+] Abriendo panel web en el navegador: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    print("=" * 65)
    print("  Wilotech — Comparador Inteligente de Repuestos")
    print("=" * 65)
    print("[*] Iniciando servidor web local en http://127.0.0.1:8000 ...")
    print("[*] Presiona Ctrl+C para detener el servicio.\n")

    # Abrir navegador automáticamente en segundo plano
    threading.Thread(target=open_browser, daemon=True).start()

    # Ejecutar servidor FastAPI con recarga automática
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)
