const COP_FORMATTER = new Intl.NumberFormat('es-CO');

const SPRITE_BY_KEY = {
  'sprite:diamond': '/assets/minecraft/textures/item/diamond.png',
  'sprite:netherite_sword': '/assets/minecraft/textures/item/netherite_sword.png',
  'sprite:key': '/assets/minecraft/textures/item/trial_key.png',
  'sprite:ender_eye': '/assets/minecraft/textures/item/ender_eye.png',
  'sprite:emerald': '/assets/minecraft/textures/item/emerald.png',
  'sprite:enchanted_book': '/assets/minecraft/textures/item/enchanted_book.png',
};

const SPRITE_BY_TYPE = {
  RANGO: '/assets/minecraft/textures/item/diamond.png',
  KIT: '/assets/minecraft/textures/item/netherite_sword.png',
  LLAVE: '/assets/minecraft/textures/item/trial_key.png',
  COSMETICO: '/assets/minecraft/textures/item/ender_eye.png',
  MONEDA: '/assets/minecraft/textures/item/emerald.png',
};

/**
 * Formats a numeric amount into Colombian Pesos (`$ 25.000 COP`).
 * @param {number|string} value
 * @returns {string}
 */
export function formatCOP(value) {
  const num = Number(value) || 0;
  return `$ ${COP_FORMATTER.format(num)} COP`;
}

/**
 * Resolves a verified local Minecraft texture path or external safe URL for an item.
 * @param {{ imagen_url?: string, tipo?: string }} item
 * @returns {string}
 */
export function getItemSpriteUrl(item) {
  const raw = item?.imagen_url || '';
  if (SPRITE_BY_KEY[raw]) {
    return SPRITE_BY_KEY[raw];
  }
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('/assets/')) {
    return raw;
  }
  return SPRITE_BY_TYPE[item?.tipo] || '/assets/minecraft/textures/item/enchanted_book.png';
}

/**
 * Formats an ISO timestamp for UI display in Spanish locale.
 * @param {string} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
