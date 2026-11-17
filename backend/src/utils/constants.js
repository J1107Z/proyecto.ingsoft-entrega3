const ROLES = Object.freeze({
  COMPRADOR: 'COMPRADOR',
  VENDEDOR: 'VENDEDOR',
  ADMIN: 'ADMIN',
});

const PUBLIC_REGISTER_ROLES = Object.freeze([ROLES.COMPRADOR, ROLES.VENDEDOR]);

const ROLE_ALIASES = Object.freeze({
  USER: ROLES.COMPRADOR,
  CLIENTE: ROLES.COMPRADOR,
  JUGADOR: ROLES.COMPRADOR,
});

const ITEM_TYPES = Object.freeze(['RANGO', 'KIT', 'LLAVE', 'COSMETICO', 'MONEDA']);

const CATEGORY_CODE_BY_TYPE = Object.freeze({
  RANGO: 1,
  KIT: 2,
  LLAVE: 3,
  COSMETICO: 4,
  MONEDA: 5,
});

const DEFAULT_COMMAND_BY_TYPE = Object.freeze({
  RANGO: 'lp user {player} parent set vip',
  KIT: 'give {player} diamond 8',
  LLAVE: 'crate key give {player} mythic 1',
  COSMETICO: 'cosmetics unlock {player} aura',
  MONEDA: 'eco give {player} 1000',
});

const ORDER_STATUS = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  PAGADO: 'PAGADO',
  RECHAZADO: 'RECHAZADO',
  CANCELADO: 'CANCELADO',
});

const DELIVERY_STATUS = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  ENTREGADO: 'ENTREGADO',
  FALLIDO: 'FALLIDO',
});

const SIMULATED_RESULTS = Object.freeze({
  APROBADO: 'APROBADO',
  RECHAZADO: 'RECHAZADO',
});

const GAMERTAG_REGEX = /^[a-zA-Z0-9_]{3,16}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Valid 60-char BCrypt hash (cost 10) used to equalize response time on missing accounts.
const DUMMY_BCRYPT_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

module.exports = {
  ROLES,
  PUBLIC_REGISTER_ROLES,
  ROLE_ALIASES,
  ITEM_TYPES,
  CATEGORY_CODE_BY_TYPE,
  DEFAULT_COMMAND_BY_TYPE,
  ORDER_STATUS,
  DELIVERY_STATUS,
  SIMULATED_RESULTS,
  GAMERTAG_REGEX,
  EMAIL_REGEX,
  DUMMY_BCRYPT_HASH,
};
