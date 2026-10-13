import io
import json
import sqlite3
import zipfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "repuestos.db"
BACKUPS_DIR = DATA_DIR / "backups"

class BackupService:
    @classmethod
    def ensure_backups_dir(cls) -> Path:
        BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
        return BACKUPS_DIR

    @classmethod
    def create_backup_zip(cls) -> bytes:
        """Genera un archivo ZIP en memoria con la base de datos y metadatos."""
        cls.ensure_backups_dir()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Obtener estadísticas básicas de la base de datos
        stats = cls._get_db_stats()
        info = {
            "version": "1.2.0",
            "created_at": datetime.now().isoformat(),
            "timestamp": timestamp,
            "system": "WILOTECH OS",
            "stats": stats
        }

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            if DB_PATH.exists():
                # Forzar un checkpoint si está en WAL
                try:
                    conn = sqlite3.connect(str(DB_PATH))
                    conn.execute("PRAGMA wal_checkpoint(FULL);")
                    conn.close()
                except Exception:
                    pass
                zf.write(DB_PATH, arcname="repuestos.db")
            
            zf.writestr("backup_info.json", json.dumps(info, indent=2, ensure_ascii=False))

        zip_bytes = buffer.getvalue()

        # Guardar copia local en data/backups/
        backup_file = BACKUPS_DIR / f"wilotech_backup_{timestamp}.zip"
        backup_file.write_bytes(zip_bytes)
        cls._rotate_backups(max_keep=10)

        return zip_bytes

    @classmethod
    def restore_from_zip(cls, zip_bytes: bytes) -> Dict[str, Any]:
        """Restaura repuestos.db a partir de un archivo ZIP de respaldo."""
        cls.ensure_backups_dir()
        try:
            with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
                filenames = zf.namelist()
                if "repuestos.db" not in filenames:
                    raise ValueError("El archivo de respaldo no contiene la base de datos 'repuestos.db'.")

                # Crear un respaldo de emergencia de la base actual antes de pisarla
                if DB_PATH.exists():
                    emergency_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                    emergency_backup = BACKUPS_DIR / f"pre_restore_snapshot_{emergency_ts}.db"
                    shutil.copy2(DB_PATH, emergency_backup)

                # Extraer repuestos.db
                db_content = zf.read("repuestos.db")
                
                # Validar cabecera SQLite (los primeros 16 bytes deben ser 'SQLite format 3\000')
                if not db_content.startswith(b"SQLite format 3\x00"):
                    raise ValueError("El archivo extraído no es una base de datos SQLite válida.")

                DB_PATH.write_bytes(db_content)

                info = {}
                if "backup_info.json" in filenames:
                    try:
                        info = json.loads(zf.read("backup_info.json").decode("utf-8"))
                    except Exception:
                        pass

                new_stats = cls._get_db_stats()

                return {
                    "status": "ok",
                    "message": "Base de datos restaurada con éxito.",
                    "info": info,
                    "stats": new_stats
                }
        except Exception as e:
            raise ValueError(f"Error al procesar el archivo de respaldo: {str(e)}")

    @classmethod
    def list_backups(cls) -> List[Dict[str, Any]]:
        """Lista las copias de seguridad locales disponibles."""
        cls.ensure_backups_dir()
        backups = []
        for p in sorted(BACKUPS_DIR.glob("wilotech_backup_*.zip"), reverse=True):
            stat = p.stat()
            backups.append({
                "filename": p.name,
                "size_kb": round(stat.st_size / 1024, 1),
                "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
            })
        return backups

    @classmethod
    def _rotate_backups(cls, max_keep: int = 10):
        """Mantiene únicamente las últimas N copias de seguridad locales."""
        all_backups = sorted(BACKUPS_DIR.glob("wilotech_backup_*.zip"), key=lambda p: p.stat().st_mtime)
        if len(all_backups) > max_keep:
            to_remove = all_backups[: len(all_backups) - max_keep]
            for f in to_remove:
                try:
                    f.unlink()
                except Exception:
                    pass

    @classmethod
    def _get_db_stats(cls) -> Dict[str, Any]:
        """Consulta estadísticas de tablas de la base de datos."""
        stats = {"tickets": 0, "gremio_users": 0, "price_items": 0, "distributors": 0}
        if not DB_PATH.exists():
            return stats
        try:
            conn = sqlite3.connect(str(DB_PATH))
            c = conn.cursor()
            c.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in c.fetchall()}

            if "tickets" in tables:
                c.execute("SELECT COUNT(*) FROM tickets")
                stats["tickets"] = c.fetchone()[0]
            if "gremio_users" in tables:
                c.execute("SELECT COUNT(*) FROM gremio_users")
                stats["gremio_users"] = c.fetchone()[0]
            if "gremio_prices" in tables:
                c.execute("SELECT COUNT(*) FROM gremio_prices")
                stats["price_items"] = c.fetchone()[0]
            if "distributors" in tables:
                c.execute("SELECT COUNT(*) FROM distributors")
                stats["distributors"] = c.fetchone()[0]
            conn.close()
        except Exception:
            pass
        return stats
