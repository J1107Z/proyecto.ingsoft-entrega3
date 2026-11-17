# Modelo de Base de Datos Relacional 3NF — MineMarket

El esquema DDL canónico reside en [`backend/src/db/schema.sql`](../backend/src/db/schema.sql) y está normalizado hasta **Tercera Forma Normal (3NF)** para eliminar redundancias transitivas y garantizar integridad referencial ACID en PostgreSQL.

## Entidades Normalizadas

1. **`roles`**: Catálogo normalizado de roles (`COMPRADOR`, `VENDEDOR`, `ADMIN`).
2. **`users`**: Identidad y autenticación (`id`, `nombre`, `email` único, `password_hash` BCrypt, `role_id` FK).
3. **`user_minecraft_profiles`**: Vinculación 1:1 desacoplada del jugador Minecraft (`user_id` FK único, `gamertag_minecraft` único).
4. **`store_categories`**: Catálogo maestro de categorías (`RANGO`, `KIT`, `LLAVE`, `COSMETICO`, `MONEDA`).
5. **`store_items`**: Ítems digitales publicados por vendedores (`category_id` FK, `seller_id` FK, `precio > 0`, `stock >= 0`, `comando`, `activo`).
6. **`carts` y `cart_items`**: Carrito persistente 1:1 por usuario con restricción `UNIQUE (cart_id, item_id)` y `cantidad > 0`.
7. **`orders` y `order_items`**: Comprobantes transaccionales con `codigo_uuid` único y snapshot histórico de `nombre_snapshot` y `precio_unitario` (inmutable ante cambios futuros del catálogo).
8. **`delivery_queue`**: Cola de comandos listos para ejecución segura in-game (`PENDIENTE`, `ENTREGADO`, `FALLIDO`) enlazados a la orden y servidor destino.
9. **`idempotency_keys`**: Protección contra reintentos/doble cobro indexada por `UNIQUE (user_id, idempotency_key)`.
10. **`audit_action_types` y `audit_logs`**: Trazabilidad administrativa y de seguridad con `JSONB` estructurado.

## Reglas de Integridad Implementadas

- **Checks físicos SQL**: `precio > 0`, `stock >= 0`, `cantidad > 0`, estados restringidos por `CHECK (...)`.
- **Borrado lógico de catálogo (`activo = FALSE`)**: Preserva la consistencia histórica de `order_items` y `delivery_queue`.
- **Dualidad Local/Nube**: Cuando `DATABASE_URL` está vacío, [`MemoryJsonRepository`](../backend/src/repositories/storeRepository.js) replica estas relaciones, unicidades y rollback ACID usando copia transaccional en memoria respaldada por `backend/data/store.json`.
