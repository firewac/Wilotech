import sys
import time
import socket
import webbrowser
import threading
from pathlib import Path

# Asegurar que el directorio raíz esté en sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import uvicorn
from backend.app import app

def get_lan_ip() -> str:
    """Obtiene la dirección IP local de red para acceso multi-dispositivo."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def open_browser():
    time.sleep(1.2)
    url = "http://127.0.0.1:8000"
    print(f"\n[+] Abriendo panel de taller en el navegador: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    lan_ip = get_lan_ip()
    print("=" * 68)
    print("  WILOTECH OS — Sistema Operativo de Laboratorio & Comparador")
    print("=" * 68)
    print("  🖥️  Acceso Local (Esta PC):       http://localhost:8000")
    if lan_ip != "127.0.0.1":
        print(f"  📱  Acceso Red Wi-Fi (Móvil/Tablet): http://{lan_ip}:8000")
        print("      (Abrí ese enlace en cualquier tablet del mostrador o celular)")
    print("=" * 68)
    print("[*] Presiona Ctrl+C para detener el servicio.\n")

    # Abrir navegador automáticamente en segundo plano
    threading.Thread(target=open_browser, daemon=True).start()

    # Ejecutar servidor FastAPI en 0.0.0.0 para acceso multi-dispositivo
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8000, reload=True)
