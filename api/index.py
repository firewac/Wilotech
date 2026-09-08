import sys
from pathlib import Path

# Añadir el directorio raíz del proyecto al sys.path para resolver imports de 'backend'
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app import app
