# Wilotech — Comparador Inteligente de Precios de Repuestos de Celulares

Plataforma web integral de recolección de datos, comparación de precios en tiempo real y gestión de stock de repuestos de telefonía móvil (pantallas/módulos, baterías, pines de carga, flex, vidrios y tapas) en múltiples portales B2B de distribuidoras mayoristas con acceso autenticado y planillas Excel/CSV.

---

## Características Principales

- **Motor Semántico y Filtrado Inteligente**: Discrimina con precisión entre tipos de repuestos (módulos, baterías, pines, etc.) y compatibilidad de modelos, evitando confusiones y falsos positivos.
- **Búsqueda Concurrente en Tiempo Real**: Consulta en paralelo Smart Supply, SoulFix, Grupo Armar y catálogos locales mediante llamadas asíncronas (`asyncio` + `httpx` / `playwright`).
- **Conversión Automática con Dólar Blue**: Sincroniza en tiempo real con la cotización del Dólar Blue para homologar listas en USD y ARS de forma transparente.
- **Importador de Listas Excel / CSV**: Carga planillas de mayoristas con autodetección de columnas e integración inmediata a las búsquedas.
- **Detección Automática de la Mejor Opción**: Identifica y destaca visualmente la distribuidora con el precio más bajo que tenga stock disponible.
- **Gestión Segura de Credenciales Locales**: Tus contraseñas se almacenan de forma local en una base de datos SQLite cifrada con el algoritmo **Fernet (AES-128)**. **Nunca** se transmiten a terceros ni a la nube.
- **Persistencia de Sesiones y Cookies**: Almacena las cookies y tokens de acceso válidos en disco para no tener que iniciar sesión en cada consulta.
- **Exportación en 1 Clic**: Genera cotizaciones formateadas en **Microsoft Excel (.xlsx)** con estilos y resaltado del mejor precio, o archivos planos **CSV**.
- **Interfaz Web Moderna y Reactiva**: Dashboard en modo oscuro con métricas de mercado, barra de afinamiento, filtros por distribuidora y ordenamiento dinámico.
- **Inicio Rápido en Windows**: Incluye el lanzador `iniciar_comparador.bat` para iniciar el servidor y abrir el navegador automáticamente con un doble clic.

---

## Estructura del Proyecto

```
comparador-repuestos/
│
├── backend/
│   ├── app.py                     # Servidor FastAPI y endpoints REST
│   ├── config.py                  # Configuración, rutas y cifrado Fernet
│   ├── database/
│   │   ├── db.py                  # Base de datos SQLite y persistencia
│   │   └── models.py              # Modelos Pydantic para datos normalizados
│   ├── scrapers/
│   │   ├── base.py                # Clase base abstracta para scrapers
│   │   ├── manager.py             # Coordinador de búsquedas concurrentes y login
│   │   ├── session_store.py       # Almacén de cookies y tokens de sesión
│   │   ├── mock_distributor.py    # Scrapers simulados de alta fidelidad para demo
│   │   └── generic_portal.py      # Scraper genérico para portales web reales
│   └── exporters/
│       └── excel_exporter.py      # Generador de reportes Excel (.xlsx) y CSV
│
├── frontend/
│   └── static/
│       ├── index.html             # Interfaz de usuario con Tailwind CSS
│       ├── app.js                 # Lógica interactiva de búsquedas y modal
│       └── styles.css             # Estilos y efectos de ofertas
│
├── data/                          # Almacén local de base de datos SQLite y sesiones
├── tests/
│   └── test_core.py               # Suite de pruebas unitarias e integración
├── run.py                         # Ejecutor principal en Python
├── iniciar_comparador.bat         # Acceso directo para Windows
└── README.md
```

---

## Puesta en Marcha Rápida

### Opción A (Recomendada para Windows):
Simplemente haz **doble clic en `iniciar_comparador.bat`**.
El script detectará tu entorno de Python 3.11, iniciará el servidor local y abrirá tu navegador web automáticamente en:
```
http://127.0.0.1:8000
```

### Opción B (Desde la terminal):
```powershell
# En la carpeta del proyecto
python run.py
```

---

## ¿Cómo conectar una distribuidora real?

1. En la barra superior de la página web, haz clic en el botón **"⚙️ Cuentas y Distribuidoras"**.
2. En el panel lateral, ingresa:
   - **Nombre de la Distribuidora**: Ej. *Distribuidora Repuestos San Martín*.
   - **URL Base**: Ej. `https://portal.distribuidora.com`.
   - **URL de Login**: Ej. `https://portal.distribuidora.com/login`.
   - **Usuario / Contraseña**: Las credenciales de tu cuenta de cliente mayorista.
   - **Tipo de Scraper**: Elige `HTTP Web / API Directo` o `Navegador Automático`.
3. Haz clic en **"Guardar Distribuidora"**.
4. Haz clic en **"Probar Conexión"**: El sistema intentará autenticarse contra el portal, guardará las cookies de sesión y te confirmará si el acceso fue correcto.

---

## Ejecución de Pruebas

Para verificar el correcto funcionamiento del cifrado, base de datos y scrapers:
```powershell
python tests/test_core.py
```
