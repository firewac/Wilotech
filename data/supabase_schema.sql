-- ====================================================================
-- ESQUEMA DE BASE DE DATOS WILOTECH EN SUPABASE (PostgreSQL)
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase.
-- ====================================================================

-- 1. Tabla de Usuarios de Gremios / Clientes
CREATE TABLE IF NOT EXISTS gremio_users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de Lista de Precios Gremios / Tarifario
CREATE TABLE IF NOT EXISTS gremio_price_list (
    id BIGSERIAL PRIMARY KEY,
    code TEXT DEFAULT '',
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    brand TEXT DEFAULT '',
    price_gremio NUMERIC NOT NULL DEFAULT 0.0,
    price_retail NUMERIC DEFAULT 0.0,
    price_gremio_usd NUMERIC DEFAULT 0.0,
    price_retail_usd NUMERIC DEFAULT 0.0,
    price_type TEXT DEFAULT 'usd_to_ars',
    stock TEXT DEFAULT 'Disponible',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gremio_price_title ON gremio_price_list(title);
CREATE INDEX IF NOT EXISTS idx_gremio_price_cat ON gremio_price_list(category);

-- 3. Tabla de Historial de Cambios de Precios
CREATE TABLE IF NOT EXISTS gremio_price_history (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT REFERENCES gremio_price_list(id) ON DELETE CASCADE,
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by TEXT DEFAULT 'Sistema',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Órdenes de Servicio / Equipos de Taller (Tickets)
CREATE TABLE IF NOT EXISTS repair_tickets (
    id TEXT PRIMARY KEY,
    client_name TEXT,
    client_type TEXT,
    client_dni TEXT,
    client_phone TEXT,
    client_address TEXT,
    device_type TEXT,
    device_brand TEXT,
    device_model TEXT,
    device_color TEXT,
    device_storage TEXT,
    serial_or_imei TEXT,
    device_lock_type TEXT,
    device_lock_code TEXT,
    device_checklist JSONB DEFAULT '{}'::jsonb,
    device_condition_notes TEXT,
    issue_description TEXT,
    status TEXT,
    status_step INTEGER DEFAULT 1,
    date_received TIMESTAMPTZ DEFAULT NOW(),
    technician TEXT,
    technician_notes TEXT,
    parts_used TEXT,
    parts_used_json TEXT,
    final_cost NUMERIC DEFAULT 0.0,
    warranty TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_phone ON repair_tickets(client_phone);
CREATE INDEX IF NOT EXISTS idx_tickets_dni ON repair_tickets(client_dni);
CREATE INDEX IF NOT EXISTS idx_tickets_imei ON repair_tickets(serial_or_imei);

-- 5. Tabla de Distribuidores Conectados
CREATE TABLE IF NOT EXISTS distributors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    login_url TEXT,
    username TEXT,
    password_encrypted TEXT,
    is_active INTEGER DEFAULT 1,
    scraper_type TEXT DEFAULT 'mock',
    last_login_status TEXT DEFAULT 'UNTESTED',
    last_login_msg TEXT DEFAULT '',
    custom_config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) opcional o deshabilitar restricción pública para API Anon
ALTER TABLE gremio_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gremio_price_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tickets ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso Público Lectura / Escritura para Integración Rápida
CREATE POLICY "Permitir acceso público a usuarios gremio" ON gremio_users FOR ALL USING (true);
CREATE POLICY "Permitir acceso público a lista de precios" ON gremio_price_list FOR ALL USING (true);
CREATE POLICY "Permitir acceso público a órdenes de reparación" ON repair_tickets FOR ALL USING (true);

-- Habilitar Publicación en Tiempo Real (Supabase Realtime WebSockets)
ALTER PUBLICATION supabase_realtime ADD TABLE gremio_users;
ALTER PUBLICATION supabase_realtime ADD TABLE gremio_price_list;
ALTER PUBLICATION supabase_realtime ADD TABLE repair_tickets;
CREATE POLICY "Permitir acceso público a órdenes de reparación" ON repair_tickets FOR ALL USING (true);
