-- ============================================================================
-- MineMarket PostgreSQL 3NF Schema (Normalized Database Architecture)
-- Entities: roles, users, user_minecraft_profiles, store_categories,
-- store_items, carts, cart_items, orders, order_items, delivery_queue,
-- idempotency_keys, audit_action_types, audit_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  description VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_minecraft_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gamertag_minecraft VARCHAR(16) UNIQUE NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(60) NOT NULL
);

CREATE TABLE IF NOT EXISTS store_items (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES store_categories(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  nombre VARCHAR(80) NOT NULL,
  descripcion TEXT NOT NULL,
  precio NUMERIC(12, 2) NOT NULL CHECK (precio > 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  servidor VARCHAR(60) NOT NULL,
  comando VARCHAR(250) NOT NULL,
  imagen_url VARCHAR(255) NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES store_items(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, item_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  codigo_uuid VARCHAR(64) UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total NUMERIC(12, 2) NOT NULL CHECK (total >= 0),
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('PENDIENTE', 'PAGADO', 'RECHAZADO', 'CANCELADO')),
  metodo_pago VARCHAR(40) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES store_items(id),
  nombre_snapshot VARCHAR(80) NOT NULL,
  precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario > 0),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal > 0)
);

CREATE TABLE IF NOT EXISTS delivery_queue (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES store_items(id),
  gamertag_minecraft VARCHAR(16) NOT NULL,
  servidor VARCHAR(60) NOT NULL,
  comando_a_ejecutar VARCHAR(250) NOT NULL,
  estado_entrega VARCHAR(20) NOT NULL CHECK (estado_entrega IN ('PENDIENTE', 'ENTREGADO', 'FALLIDO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(120) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS audit_action_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(60) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  action_type_id INTEGER NOT NULL REFERENCES audit_action_types(id),
  target_type VARCHAR(40) NOT NULL,
  target_id VARCHAR(64) NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_category ON store_items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_activo ON store_items(activo);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON delivery_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
