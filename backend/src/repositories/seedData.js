const bcrypt = require('bcryptjs');
const { CATEGORY_CODE_BY_TYPE, ROLES } = require('../utils/constants');

let cachedHashes = null;

function getSeedHashes() {
  if (!cachedHashes) {
    cachedHashes = {
      admin: bcrypt.hashSync('Admin1234', 10),
      vendedor: bcrypt.hashSync('Vendedor1', 10),
      comprador: bcrypt.hashSync('Comprador1', 10),
    };
  }
  return cachedHashes;
}

/**
 * Creates a deterministic, fresh MineMarket database state for dev/test initialization.
 * @param {{ seed?: boolean }} [options]
 */
function createSeedState({ seed = true } = {}) {
  if (!seed) {
    return {
      counters: {
        users: 0,
        items: 0,
        carts: 0,
        cart_items: 0,
        orders: 0,
        order_items: 0,
        deliveries: 0,
        audit_logs: 0,
      },
      categories: [
        { id_categoria: 1, codigo: 'RANGO', nombre: 'Rangos VIP' },
        { id_categoria: 2, codigo: 'KIT', nombre: 'Kits de Supervivencia' },
        { id_categoria: 3, codigo: 'LLAVE', nombre: 'Llaves de Cofre' },
        { id_categoria: 4, codigo: 'COSMETICO', nombre: 'Cosméticos' },
        { id_categoria: 5, codigo: 'MONEDA', nombre: 'Moneda Virtual' },
      ],
      users: [],
      items: [],
      carts: [],
      cart_items: [],
      orders: [],
      order_items: [],
      delivery_queue: [],
      idempotency_keys: [],
      audit_logs: [],
    };
  }

  const hashes = getSeedHashes();
  const now = '2026-04-01T12:00:00.000Z';

  return {
    counters: {
      users: 3,
      items: 6,
      carts: 0,
      cart_items: 0,
      orders: 0,
      order_items: 0,
      deliveries: 0,
      audit_logs: 0,
    },
    categories: [
      { id_categoria: 1, codigo: 'RANGO', nombre: 'Rangos VIP' },
      { id_categoria: 2, codigo: 'KIT', nombre: 'Kits de Supervivencia' },
      { id_categoria: 3, codigo: 'LLAVE', nombre: 'Llaves de Cofre' },
      { id_categoria: 4, codigo: 'COSMETICO', nombre: 'Cosméticos' },
      { id_categoria: 5, codigo: 'MONEDA', nombre: 'Moneda Virtual' },
    ],
    users: [
      {
        id_usuario: 1,
        nombre: 'Admin MineMarket',
        email: 'admin@minemarket.com',
        password_hash: hashes.admin,
        rol: ROLES.ADMIN,
        gamertag_minecraft: 'AdminMarket',
        created_at: now,
      },
      {
        id_usuario: 2,
        nombre: 'Vendedor Oficial',
        email: 'vendedor@minemarket.com',
        password_hash: hashes.vendedor,
        rol: ROLES.VENDEDOR,
        gamertag_minecraft: 'VendedorPro',
        created_at: now,
      },
      {
        id_usuario: 3,
        nombre: 'Jugador Comprador',
        email: 'comprador@minemarket.com',
        password_hash: hashes.comprador,
        rol: ROLES.COMPRADOR,
        gamertag_minecraft: 'JugadorSteve',
        created_at: now,
      },
    ],
    items: [
      {
        id_item: 1,
        id_categoria: CATEGORY_CODE_BY_TYPE.RANGO,
        id_vendedor: 2,
        nombre: 'Rango VIP Diamante',
        descripcion: 'Prefijo Diamante global, /fly en Lobby, 5 parcelas y prioridad en colas.',
        tipo: 'RANGO',
        precio: 25000,
        stock: 50,
        servidor: 'Survival Tierra',
        comando: 'lp user {player} parent set vip_diamante',
        imagen_url: 'sprite:diamond',
        activo: true,
        created_at: now,
      },
      {
        id_item: 2,
        id_categoria: CATEGORY_CODE_BY_TYPE.KIT,
        id_vendedor: 2,
        nombre: 'Kit Guerrero Netherite',
        descripcion: 'Armadura completa de Netherite encantada con Protección IV y Espada Filo V.',
        tipo: 'KIT',
        precio: 18000,
        stock: 20,
        servidor: 'Survival Tierra',
        comando: 'kit give {player} guerrero_netherite',
        imagen_url: 'sprite:netherite_sword',
        activo: true,
        created_at: now,
      },
      {
        id_item: 3,
        id_categoria: CATEGORY_CODE_BY_TYPE.LLAVE,
        id_vendedor: 2,
        nombre: 'Llave Mítica x3',
        descripcion: 'Tres llaves para el cofre Mítico del Spawn con botín épico garantizado.',
        tipo: 'LLAVE',
        precio: 12000,
        stock: 100,
        servidor: 'Skyblock Aether',
        comando: 'crate key give {player} mitica 3',
        imagen_url: 'sprite:key',
        activo: true,
        created_at: now,
      },
      {
        id_item: 4,
        id_categoria: CATEGORY_CODE_BY_TYPE.COSMETICO,
        id_vendedor: 2,
        nombre: 'Aura Cósmica Ender',
        descripcion:
          'Efecto visual de partículas del End alrededor de tu personaje en todos los lobbies.',
        tipo: 'COSMETICO',
        precio: 15000,
        stock: 35,
        servidor: 'Lobby Global',
        comando: 'cosmetics unlock {player} aura_ender',
        imagen_url: 'sprite:ender_eye',
        activo: true,
        created_at: now,
      },
      {
        id_item: 5,
        id_categoria: CATEGORY_CODE_BY_TYPE.MONEDA,
        id_vendedor: 2,
        nombre: 'Bolsa 10.000 Esmeraldas',
        descripcion: 'Crédito inmediato de 10.000 monedas en la economía oficial de la red.',
        tipo: 'MONEDA',
        precio: 10000,
        stock: 200,
        servidor: 'Survival Tierra',
        comando: 'eco give {player} 10000',
        imagen_url: 'sprite:emerald',
        activo: true,
        created_at: now,
      },
      {
        id_item: 6,
        id_categoria: CATEGORY_CODE_BY_TYPE.KIT,
        id_vendedor: 2,
        nombre: 'Kit Ingeniero Redstone',
        descripcion:
          '64 pistones pegajosos, comparadores, tolvas y bloques de slime para automatización.',
        tipo: 'KIT',
        precio: 9000,
        stock: 15,
        servidor: 'Skyblock Aether',
        comando: 'kit give {player} redstone_pro',
        imagen_url: 'sprite:chest',
        activo: true,
        created_at: now,
      },
    ],
    carts: [],
    cart_items: [],
    orders: [],
    order_items: [],
    delivery_queue: [],
    idempotency_keys: [],
    audit_logs: [],
  };
}

module.exports = {
  createSeedState,
};
