# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Evitar escritura de archivos .pyc y forzar salida sin buffer
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Instalar dependencias del sistema mínimas
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar paquetes de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del proyecto
COPY . .

# Crear directorio de datos persistentes y backups
RUN mkdir -p /app/data/backups /app/data/sessions

# Exponer el puerto del servidor
EXPOSE 8000

# Healthcheck para Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Comando de ejecución por defecto
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
