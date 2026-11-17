const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../db');
const { CATEGORY_CODE_BY_TYPE, ROLES } = require('../utils/constants');
const { createSeedState } = require('./seedData');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainStoreValid(parsed) {
  return Boolean(
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray(parsed.users) &&
    Array.isArray(parsed.items) &&
    Array.isArray(parsed.orders)
  );
}

/**
 * JSON-file backed repository with in-memory working copy and ACID snapshot rollback.
 */
class MemoryJsonRepository {
  /**
   * @param {{ dataFile?: string, memoryOnly?: boolean }} [options]
   */
  constructor(options = {}) {
    this.dataFile = options.dataFile || config.dataFile;
    this.memoryOnly = options.memoryOnly !== undefined ? options.memoryOnly : config.memoryOnly;
    this.activeTx = null;
    this.state = this._loadInitialState();
  }

  _loadInitialState() {
    if (!this.memoryOnly && this.dataFile && fs.existsSync(this.dataFile)) {
      try {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (isPlainStoreValid(parsed)) {
          return parsed;
        }
      } catch (_err) {
        // Fallback cleanly to fresh MineMarket seed data on corrupt store files.
      }
    }
    const seeded = createSeedState({ seed: true });
    this._persistState(seeded);
    return seeded;
  }

  _persistState(targetState = this.state) {
    if (this.memoryOnly || this.activeTx || !this.dataFile) return;
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dataFile, JSON.stringify(targetState, null, 2), 'utf8');
  }

  _current() {
    return this.activeTx || this.state;
  }

  async reset({ seed = true } = {}) {
    this.activeTx = null;
    this.state = createSeedState({ seed });
    this._persistState(this.state);
  }

  async runTransaction(callback) {
    const workingCopy = clone(this.state);
    this.activeTx = workingCopy;
    try {
      const result = await callback(this);
      this.state = workingCopy;
      this.activeTx = null;
      this._persistState(this.state);
      return result;
    } catch (err) {
      this.activeTx = null;
      throw err;
    }
  }

  async findUserById(id) {
    const user = this._current().users.find((u) => u.id_usuario === Number(id));
    return user ? clone(user) : null;
  }

  async findUserByEmail(email) {
    const clean = String(email || '')
      .trim()
      .toLowerCase();
    const user = this._current().users.find((u) => u.email.toLowerCase() === clean);
    return user ? clone(user) : null;
  }

  async findUserByGamertag(gamertag) {
    const clean = String(gamertag || '')
      .trim()
      .toLowerCase();
    const user = this._current().users.find((u) => u.gamertag_minecraft.toLowerCase() === clean);
    return user ? clone(user) : null;
  }

  async createUser({ nombre, email, password_hash, rol, gamertag_minecraft }) {
    const store = this._current();
    store.counters.users += 1;
    const user = {
      id_usuario: store.counters.users,
      nombre,
      email: email.toLowerCase(),
      password_hash,
      rol,
      gamertag_minecraft,
      created_at: new Date().toISOString(),
    };
    store.users.push(user);
    this._persistState();
    return clone(user);
  }

  async listCategories() {
    return clone(this._current().categories);
  }

  async listItems({ includeInactive = false } = {}) {
    const store = this._current();
    const items = includeInactive
      ? store.items
      : store.items.filter((item) => item.activo !== false);
    return items.map((item) => {
      const seller = store.users.find((u) => u.id_usuario === item.id_vendedor);
      return {
        ...clone(item),
        vendedor_nombre: seller ? seller.nombre : 'MineMarket',
        vendedor_gamertag: seller ? seller.gamertag_minecraft : 'MineMarket',
      };
    });
  }

  async findItemById(id) {
    const store = this._current();
    const item = store.items.find((entry) => entry.id_item === Number(id));
    if (!item) return null;
    const seller = store.users.find((u) => u.id_usuario === item.id_vendedor);
    return {
      ...clone(item),
      vendedor_nombre: seller ? seller.nombre : 'MineMarket',
      vendedor_gamertag: seller ? seller.gamertag_minecraft : 'MineMarket',
    };
  }

  async createItem(data) {
    const store = this._current();
    store.counters.items += 1;
    const item = {
      id_item: store.counters.items,
      id_categoria: CATEGORY_CODE_BY_TYPE[data.tipo] || 1,
      id_vendedor: data.id_vendedor,
      nombre: data.nombre,
      descripcion: data.descripcion,
      tipo: data.tipo,
      precio: data.precio,
      stock: data.stock,
      servidor: data.servidor,
      comando: data.comando,
      imagen_url: data.imagen_url || '',
      activo: true,
      created_at: new Date().toISOString(),
    };
    store.items.push(item);
    this._persistState();
    return this.findItemById(item.id_item);
  }

  async updateItem(id, patch) {
    const store = this._current();
    const idx = store.items.findIndex((entry) => entry.id_item === Number(id));
    if (idx === -1) return null;
    const updated = {
      ...store.items[idx],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    if (patch.tipo) {
      updated.id_categoria = CATEGORY_CODE_BY_TYPE[patch.tipo] || updated.id_categoria;
    }
    store.items[idx] = updated;
    this._persistState();
    return this.findItemById(id);
  }

  _ensureUserCart(userId) {
    const store = this._current();
    let cart = store.carts.find((c) => c.id_usuario === Number(userId));
    if (!cart) {
      store.counters.carts += 1;
      cart = {
        id_carrito: store.counters.carts,
        id_usuario: Number(userId),
        updated_at: new Date().toISOString(),
      };
      store.carts.push(cart);
    }
    return cart;
  }

  async getCartItemsByUserId(userId) {
    const store = this._current();
    const cart = store.carts.find((c) => c.id_usuario === Number(userId));
    if (!cart) return [];
    return store.cart_items
      .filter((ci) => ci.id_carrito === cart.id_carrito)
      .map((ci) => {
        const item = store.items.find((i) => i.id_item === ci.id_item);
        return {
          ...clone(ci),
          item: item ? clone(item) : null,
        };
      });
  }

  async addOrIncrementCartItem(userId, itemId, cantidad) {
    const store = this._current();
    const cart = this._ensureUserCart(userId);
    const existing = store.cart_items.find(
      (ci) => ci.id_carrito === cart.id_carrito && ci.id_item === Number(itemId)
    );
    if (existing) {
      existing.cantidad += cantidad;
      cart.updated_at = new Date().toISOString();
      this._persistState();
      return existing.cantidad;
    }
    store.counters.cart_items += 1;
    store.cart_items.push({
      id_item_carrito: store.counters.cart_items,
      id_carrito: cart.id_carrito,
      id_item: Number(itemId),
      cantidad,
      added_at: new Date().toISOString(),
    });
    cart.updated_at = new Date().toISOString();
    this._persistState();
    return cantidad;
  }

  async setCartItemQuantity(userId, itemId, cantidad) {
    const store = this._current();
    const cart = store.carts.find((c) => c.id_usuario === Number(userId));
    if (!cart) return null;
    const existing = store.cart_items.find(
      (ci) => ci.id_carrito === cart.id_carrito && ci.id_item === Number(itemId)
    );
    if (!existing) return null;
    existing.cantidad = cantidad;
    cart.updated_at = new Date().toISOString();
    this._persistState();
    return clone(existing);
  }

  async removeCartItem(userId, itemId) {
    const store = this._current();
    const cart = store.carts.find((c) => c.id_usuario === Number(userId));
    if (!cart) return false;
    const before = store.cart_items.length;
    store.cart_items = store.cart_items.filter(
      (ci) => !(ci.id_carrito === cart.id_carrito && ci.id_item === Number(itemId))
    );
    if (store.cart_items.length !== before) {
      cart.updated_at = new Date().toISOString();
      this._persistState();
      return true;
    }
    return false;
  }

  async clearCart(userId) {
    const store = this._current();
    const cart = store.carts.find((c) => c.id_usuario === Number(userId));
    if (!cart) return;
    store.cart_items = store.cart_items.filter((ci) => ci.id_carrito !== cart.id_carrito);
    cart.updated_at = new Date().toISOString();
    this._persistState();
  }

  async decrementItemStock(itemId, quantity) {
    const store = this._current();
    const item = store.items.find((i) => i.id_item === Number(itemId));
    if (!item || item.activo === false || item.stock < quantity) {
      return false;
    }
    item.stock -= quantity;
    item.updated_at = new Date().toISOString();
    this._persistState();
    return true;
  }

  async createOrder({ codigo_uuid, id_usuario, total, estado, metodo_pago, detalles }) {
    const store = this._current();
    store.counters.orders += 1;
    const order = {
      id_orden: store.counters.orders,
      codigo_uuid,
      id_usuario: Number(id_usuario),
      total,
      estado,
      metodo_pago,
      created_at: new Date().toISOString(),
    };
    store.orders.push(order);

    const createdDetails = detalles.map((d) => {
      store.counters.order_items += 1;
      const detail = {
        id_detalle: store.counters.order_items,
        id_orden: order.id_orden,
        id_item: d.id_item,
        nombre_snapshot: d.nombre_snapshot,
        precio_unitario: d.precio_unitario,
        cantidad: d.cantidad,
        subtotal: d.subtotal,
      };
      store.order_items.push(detail);
      return clone(detail);
    });

    this._persistState();
    return { order: clone(order), detalles: createdDetails };
  }

  async enqueueDelivery(entry) {
    const store = this._current();
    store.counters.deliveries += 1;
    const row = {
      id_entrega: store.counters.deliveries,
      id_orden: entry.id_orden,
      id_item: entry.id_item,
      gamertag_minecraft: entry.gamertag_minecraft,
      servidor: entry.servidor,
      comando_a_ejecutar: entry.comando_a_ejecutar,
      estado_entrega: entry.estado_entrega,
      created_at: new Date().toISOString(),
      dispatched_at: null,
    };
    store.delivery_queue.push(row);
    this._persistState();
    return clone(row);
  }

  async listOrdersWithDetails({ userId = null } = {}) {
    const store = this._current();
    const orders = userId
      ? store.orders.filter((o) => o.id_usuario === Number(userId))
      : store.orders;

    return [...orders]
      .sort((a, b) => b.id_orden - a.id_orden)
      .map((order) => {
        const buyer = store.users.find((u) => u.id_usuario === order.id_usuario);
        const detalles = store.order_items.filter((d) => d.id_orden === order.id_orden);
        const entregas = store.delivery_queue.filter((e) => e.id_orden === order.id_orden);
        return {
          ...clone(order),
          comprador_email: buyer ? buyer.email : '',
          comprador_gamertag: buyer ? buyer.gamertag_minecraft : '',
          detalles: clone(detalles),
          entregas: clone(entregas),
        };
      });
  }

  async findOrderById(orderId) {
    const orders = await this.listOrdersWithDetails();
    return orders.find((o) => o.id_orden === Number(orderId)) || null;
  }

  async findDeliveryById(deliveryId) {
    const row = this._current().delivery_queue.find((d) => d.id_entrega === Number(deliveryId));
    return row ? clone(row) : null;
  }

  async updateDeliveryStatus(deliveryId, estadoEntrega) {
    const store = this._current();
    const row = store.delivery_queue.find((d) => d.id_entrega === Number(deliveryId));
    if (!row) return null;
    row.estado_entrega = estadoEntrega;
    row.dispatched_at = new Date().toISOString();
    this._persistState();
    return clone(row);
  }

  async findIdempotencyRecord(userId, key) {
    const hit = this._current().idempotency_keys.find(
      (k) => k.id_usuario === Number(userId) && k.idempotency_key === key
    );
    return hit ? clone(hit) : null;
  }

  async saveIdempotencyRecord(userId, key, status, body) {
    const store = this._current();
    store.idempotency_keys.push({
      id_usuario: Number(userId),
      idempotency_key: key,
      response_status: status,
      response_body: clone(body),
      created_at: new Date().toISOString(),
    });
    this._persistState();
  }

  async createAuditLog({ id_usuario = null, accion, entidad, entidad_id = '', detalles = {} }) {
    const store = this._current();
    store.counters.audit_logs += 1;
    const entry = {
      id_log: store.counters.audit_logs,
      id_usuario,
      accion,
      entidad,
      entidad_id: String(entidad_id),
      detalles: clone(detalles),
      created_at: new Date().toISOString(),
    };
    store.audit_logs.unshift(entry);
    if (store.audit_logs.length > 500) {
      store.audit_logs.length = 500;
    }
    this._persistState();
    return clone(entry);
  }

  async listAuditLogs(limit = 50) {
    const store = this._current();
    return clone(store.audit_logs.slice(0, limit)).map((entry) => {
      const user = store.users.find((u) => u.id_usuario === entry.id_usuario);
      return {
        ...entry,
        usuario_email: user ? user.email : 'anonimo',
        usuario_gamertag: user ? user.gamertag_minecraft : null,
      };
    });
  }
}

/**
 * PostgreSQL parameterized repository enforcing ACID SQL transactions (`BEGIN/COMMIT/ROLLBACK`).
 */
class PgRepository {
  /**
   * @param {{ query: Function, withTransaction: Function }} pgClient
   */
  constructor(pgClient = db) {
    this.pg = pgClient;
    this.txClient = null;
  }

  _runner() {
    return this.txClient || this.pg;
  }

  async reset() {
    // Only memory/JSON store supports automated test wipe.
  }

  async runTransaction(callback) {
    return this.pg.withTransaction(async (client) => {
      const scoped = new PgRepository(this.pg);
      scoped.txClient = client;
      return callback(scoped);
    });
  }

  async _ensureLookupId(table, code, extraCol = null, extraVal = null) {
    const cols = extraCol ? `(code, ${extraCol})` : '(code)';
    const vals = extraCol ? '($1, $2)' : '($1)';
    const params = extraCol ? [code, extraVal] : [code];
    await this._runner().query(
      `INSERT INTO ${table} ${cols} VALUES ${vals} ON CONFLICT (code) DO NOTHING`,
      params
    );
    const { rows } = await this._runner().query(`SELECT id FROM ${table} WHERE code = $1`, [code]);
    return rows[0].id;
  }

  async findUserById(id) {
    const { rows } = await this._runner().query(
      `SELECT u.id AS id_usuario, u.nombre, u.email, u.password_hash, r.code AS rol,
              p.gamertag_minecraft, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN user_minecraft_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [Number(id)]
    );
    return rows[0] || null;
  }

  async findUserByEmail(email) {
    const clean = String(email || '')
      .trim()
      .toLowerCase();
    const { rows } = await this._runner().query(
      `SELECT u.id AS id_usuario, u.nombre, u.email, u.password_hash, r.code AS rol,
              p.gamertag_minecraft, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN user_minecraft_profiles p ON p.user_id = u.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [clean]
    );
    return rows[0] || null;
  }

  async findUserByGamertag(gamertag) {
    const clean = String(gamertag || '')
      .trim()
      .toLowerCase();
    const { rows } = await this._runner().query(
      `SELECT u.id AS id_usuario, u.nombre, u.email, u.password_hash, r.code AS rol,
              p.gamertag_minecraft, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN user_minecraft_profiles p ON p.user_id = u.id
       WHERE LOWER(p.gamertag_minecraft) = LOWER($1)`,
      [clean]
    );
    return rows[0] || null;
  }

  async createUser({ nombre, email, password_hash, rol, gamertag_minecraft }) {
    const roleId = await this._ensureLookupId('roles', rol, 'description', `Rol ${rol}`);
    const { rows } = await this._runner().query(
      `INSERT INTO users (nombre, email, password_hash, role_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [nombre, email.toLowerCase(), password_hash, roleId]
    );
    const userId = rows[0].id;
    await this._runner().query(
      `INSERT INTO user_minecraft_profiles (user_id, gamertag_minecraft) VALUES ($1, $2)`,
      [userId, gamertag_minecraft]
    );
    return this.findUserById(userId);
  }

  async listCategories() {
    const { rows } = await this._runner().query(
      'SELECT id AS id_categoria, code AS codigo, display_name AS nombre FROM store_categories ORDER BY id'
    );
    return rows;
  }

  async listItems({ includeInactive = false } = {}) {
    const whereClause = includeInactive ? '' : 'WHERE i.activo = TRUE';
    const { rows } = await this._runner().query(
      `SELECT i.id AS id_item, i.category_id AS id_categoria, c.code AS tipo,
              i.seller_id AS id_vendedor, u.nombre AS vendedor_nombre,
              p.gamertag_minecraft AS vendedor_gamertag,
              i.nombre, i.descripcion, CAST(i.precio AS FLOAT) AS precio,
              i.stock, i.servidor, i.comando, i.imagen_url, i.activo, i.created_at
       FROM store_items i
       JOIN store_categories c ON c.id = i.category_id
       JOIN users u ON u.id = i.seller_id
       JOIN user_minecraft_profiles p ON p.user_id = u.id
       ${whereClause}
       ORDER BY i.id ASC`
    );
    return rows;
  }

  async findItemById(id) {
    const { rows } = await this._runner().query(
      `SELECT i.id AS id_item, i.category_id AS id_categoria, c.code AS tipo,
              i.seller_id AS id_vendedor, u.nombre AS vendedor_nombre,
              p.gamertag_minecraft AS vendedor_gamertag,
              i.nombre, i.descripcion, CAST(i.precio AS FLOAT) AS precio,
              i.stock, i.servidor, i.comando, i.imagen_url, i.activo, i.created_at
       FROM store_items i
       JOIN store_categories c ON c.id = i.category_id
       JOIN users u ON u.id = i.seller_id
       JOIN user_minecraft_profiles p ON p.user_id = u.id
       WHERE i.id = $1`,
      [Number(id)]
    );
    return rows[0] || null;
  }

  async createItem(data) {
    const categoryId = await this._ensureLookupId(
      'store_categories',
      data.tipo,
      'display_name',
      data.tipo
    );
    const { rows } = await this._runner().query(
      `INSERT INTO store_items
         (category_id, seller_id, nombre, descripcion, precio, stock, servidor, comando, imagen_url, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
       RETURNING id`,
      [
        categoryId,
        data.id_vendedor,
        data.nombre,
        data.descripcion,
        data.precio,
        data.stock,
        data.servidor,
        data.comando,
        data.imagen_url || '',
      ]
    );
    return this.findItemById(rows[0].id);
  }

  async updateItem(id, patch) {
    const existing = await this.findItemById(id);
    if (!existing) return null;
    const nextTipo = patch.tipo || existing.tipo;
    const categoryId = await this._ensureLookupId(
      'store_categories',
      nextTipo,
      'display_name',
      nextTipo
    );
    await this._runner().query(
      `UPDATE store_items
       SET category_id = $1,
           nombre = $2,
           descripcion = $3,
           precio = $4,
           stock = $5,
           servidor = $6,
           comando = $7,
           imagen_url = $8,
           activo = $9,
           updated_at = NOW()
       WHERE id = $10`,
      [
        categoryId,
        patch.nombre ?? existing.nombre,
        patch.descripcion ?? existing.descripcion,
        patch.precio ?? existing.precio,
        patch.stock ?? existing.stock,
        patch.servidor ?? existing.servidor,
        patch.comando ?? existing.comando,
        patch.imagen_url ?? existing.imagen_url,
        patch.activo !== undefined ? patch.activo : existing.activo,
        Number(id),
      ]
    );
    return this.findItemById(id);
  }

  async _ensurePgCart(userId) {
    await this._runner().query(
      `INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [Number(userId)]
    );
    const { rows } = await this._runner().query(`SELECT id FROM carts WHERE user_id = $1`, [
      Number(userId),
    ]);
    return rows[0].id;
  }

  async getCartItemsByUserId(userId) {
    const { rows } = await this._runner().query(
      `SELECT ci.id AS id_item_carrito, ci.cart_id AS id_carrito, ci.item_id AS id_item,
              ci.cantidad, ci.added_at
       FROM cart_items ci
       JOIN carts c ON c.id = ci.cart_id
       WHERE c.user_id = $1
       ORDER BY ci.id ASC`,
      [Number(userId)]
    );
    const hydrated = [];
    for (const row of rows) {
      hydrated.push({
        ...row,
        item: await this.findItemById(row.id_item),
      });
    }
    return hydrated;
  }

  async addOrIncrementCartItem(userId, itemId, cantidad) {
    const cartId = await this._ensurePgCart(userId);
    const { rows } = await this._runner().query(
      `INSERT INTO cart_items (cart_id, item_id, cantidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, item_id)
       DO UPDATE SET cantidad = cart_items.cantidad + EXCLUDED.cantidad
       RETURNING cantidad`,
      [cartId, Number(itemId), cantidad]
    );
    return rows[0].cantidad;
  }

  async setCartItemQuantity(userId, itemId, cantidad) {
    const cartId = await this._ensurePgCart(userId);
    const { rows } = await this._runner().query(
      `UPDATE cart_items SET cantidad = $1
       WHERE cart_id = $2 AND item_id = $3
       RETURNING id AS id_item_carrito, item_id AS id_item, cantidad`,
      [cantidad, cartId, Number(itemId)]
    );
    return rows[0] || null;
  }

  async removeCartItem(userId, itemId) {
    const { rowCount } = await this._runner().query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE ci.cart_id = c.id AND c.user_id = $1 AND ci.item_id = $2`,
      [Number(userId), Number(itemId)]
    );
    return rowCount > 0;
  }

  async clearCart(userId) {
    await this._runner().query(
      `DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1`,
      [Number(userId)]
    );
  }

  async decrementItemStock(itemId, quantity) {
    const { rowCount } = await this._runner().query(
      `UPDATE store_items
       SET stock = stock - $1, updated_at = NOW()
       WHERE id = $2 AND activo = TRUE AND stock >= $1`,
      [quantity, Number(itemId)]
    );
    return rowCount > 0;
  }

  async createOrder({ codigo_uuid, id_usuario, total, estado, metodo_pago, detalles }) {
    const { rows } = await this._runner().query(
      `INSERT INTO orders (codigo_uuid, user_id, total, estado, metodo_pago)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id AS id_orden, codigo_uuid, user_id AS id_usuario,
                 CAST(total AS FLOAT) AS total, estado, metodo_pago, created_at`,
      [codigo_uuid, Number(id_usuario), total, estado, metodo_pago]
    );
    const order = rows[0];
    const createdDetails = [];
    for (const d of detalles) {
      const detailRes = await this._runner().query(
        `INSERT INTO order_items (order_id, item_id, nombre_snapshot, precio_unitario, cantidad, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id AS id_detalle, order_id AS id_orden, item_id AS id_item, nombre_snapshot,
                   CAST(precio_unitario AS FLOAT) AS precio_unitario, cantidad,
                   CAST(subtotal AS FLOAT) AS subtotal`,
        [order.id_orden, d.id_item, d.nombre_snapshot, d.precio_unitario, d.cantidad, d.subtotal]
      );
      createdDetails.push(detailRes.rows[0]);
    }
    return { order, detalles: createdDetails };
  }

  async enqueueDelivery(entry) {
    const { rows } = await this._runner().query(
      `INSERT INTO delivery_queue
         (order_id, item_id, gamertag_minecraft, servidor, comando_a_ejecutar, estado_entrega)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id AS id_entrega, order_id AS id_orden, item_id AS id_item, gamertag_minecraft,
                 servidor, comando_a_ejecutar, estado_entrega, created_at, dispatched_at`,
      [
        entry.id_orden,
        entry.id_item,
        entry.gamertag_minecraft,
        entry.servidor,
        entry.comando_a_ejecutar,
        entry.estado_entrega,
      ]
    );
    return rows[0];
  }

  async listOrdersWithDetails({ userId = null } = {}) {
    const params = userId ? [Number(userId)] : [];
    const whereClause = userId ? 'WHERE o.user_id = $1' : '';
    const { rows: orders } = await this._runner().query(
      `SELECT o.id AS id_orden, o.codigo_uuid, o.user_id AS id_usuario,
              CAST(o.total AS FLOAT) AS total, o.estado, o.metodo_pago, o.created_at,
              u.email AS comprador_email, p.gamertag_minecraft AS comprador_gamertag
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN user_minecraft_profiles p ON p.user_id = u.id
       ${whereClause}
       ORDER BY o.id DESC`,
      params
    );
    for (const order of orders) {
      const detRes = await this._runner().query(
        `SELECT id AS id_detalle, order_id AS id_orden, item_id AS id_item, nombre_snapshot,
                CAST(precio_unitario AS FLOAT) AS precio_unitario, cantidad,
                CAST(subtotal AS FLOAT) AS subtotal
         FROM order_items WHERE order_id = $1`,
        [order.id_orden]
      );
      const delRes = await this._runner().query(
        `SELECT id AS id_entrega, order_id AS id_orden, item_id AS id_item, gamertag_minecraft,
                servidor, comando_a_ejecutar, estado_entrega, created_at, dispatched_at
         FROM delivery_queue WHERE order_id = $1`,
        [order.id_orden]
      );
      order.detalles = detRes.rows;
      order.entregas = delRes.rows;
    }
    return orders;
  }

  async findOrderById(orderId) {
    const all = await this.listOrdersWithDetails();
    return all.find((o) => o.id_orden === Number(orderId)) || null;
  }

  async findDeliveryById(deliveryId) {
    const { rows } = await this._runner().query(
      `SELECT id AS id_entrega, order_id AS id_orden, item_id AS id_item, gamertag_minecraft,
              servidor, comando_a_ejecutar, estado_entrega, created_at, dispatched_at
       FROM delivery_queue WHERE id = $1`,
      [Number(deliveryId)]
    );
    return rows[0] || null;
  }

  async updateDeliveryStatus(deliveryId, estadoEntrega) {
    const { rows } = await this._runner().query(
      `UPDATE delivery_queue
       SET estado_entrega = $1, dispatched_at = NOW()
       WHERE id = $2
       RETURNING id AS id_entrega, order_id AS id_orden, item_id AS id_item, gamertag_minecraft,
                 servidor, comando_a_ejecutar, estado_entrega, created_at, dispatched_at`,
      [estadoEntrega, Number(deliveryId)]
    );
    return rows[0] || null;
  }

  async findIdempotencyRecord(userId, key) {
    const { rows } = await this._runner().query(
      `SELECT response_status, response_body
       FROM idempotency_keys WHERE user_id = $1 AND idempotency_key = $2`,
      [Number(userId), key]
    );
    return rows[0] || null;
  }

  async saveIdempotencyRecord(userId, key, status, body) {
    await this._runner().query(
      `INSERT INTO idempotency_keys (user_id, idempotency_key, response_status, response_body)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
      [Number(userId), key, status, JSON.stringify(body)]
    );
  }

  async createAuditLog({ id_usuario = null, accion, entidad, entidad_id = '', detalles = {} }) {
    const actionTypeId = await this._ensureLookupId('audit_action_types', accion);
    const { rows } = await this._runner().query(
      `INSERT INTO audit_logs (user_id, action_type_id, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id AS id_log, created_at`,
      [id_usuario, actionTypeId, entidad, String(entidad_id), JSON.stringify(detalles)]
    );
    return { id_log: rows[0].id_log, id_usuario, accion, entidad, entidad_id, detalles };
  }

  async listAuditLogs(limit = 50) {
    const { rows } = await this._runner().query(
      `SELECT l.id AS id_log, l.user_id AS id_usuario, t.code AS accion,
              l.target_type AS entidad, l.target_id AS entidad_id,
              l.details AS detalles, l.created_at,
              COALESCE(u.email, 'anonimo') AS usuario_email,
              p.gamertag_minecraft AS usuario_gamertag
       FROM audit_logs l
       JOIN audit_action_types t ON t.id = l.action_type_id
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN user_minecraft_profiles p ON p.user_id = u.id
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }
}

/**
 * Selects PostgreSQL repository when DATABASE_URL is configured; otherwise MemoryJsonRepository.
 */
function createStoreRepository(customConfig = config) {
  if (customConfig.databaseUrl) {
    return new PgRepository(db);
  }
  return new MemoryJsonRepository({
    dataFile: customConfig.dataFile,
    memoryOnly: customConfig.memoryOnly,
  });
}

const defaultRepository = createStoreRepository();

module.exports = {
  MemoryJsonRepository,
  PgRepository,
  createStoreRepository,
  storeRepository: defaultRepository,
  ROLES,
};
