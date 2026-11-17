const crypto = require('crypto');
const {
  GAMERTAG_REGEX,
  EMAIL_REGEX,
  ITEM_TYPES,
  PUBLIC_REGISTER_ROLES,
  ROLE_ALIASES,
  ROLES,
  SIMULATED_RESULTS,
} = require('./constants');

const DANGEROUS_COMMAND_CHARS = /[;&|`$<>\\!\n\r\t]/;
const COMMAND_INJECTION_PATTERNS = [/\$\(/, /\$\{/, /\|\|/, /&&/, />>/, /<</];

/**
 * Validates and trims a Minecraft Java/Bedrock gamertag (3-16 chars, alphanumeric + underscore).
 * @param {unknown} gamertag - Raw gamertag input.
 * @returns {string|null} Sanitized gamertag or null when invalid.
 */
function sanitizeMinecraftGamertag(gamertag) {
  if (typeof gamertag !== 'string') return null;
  const clean = gamertag.trim();
  if (!GAMERTAG_REGEX.test(clean)) return null;
  return clean;
}

/**
 * Checks whether an email string follows basic RFC-like structure within safe length bounds.
 * @param {unknown} email - Email candidate.
 * @returns {boolean} True when valid.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const clean = email.trim();
  return clean.length > 3 && clean.length <= 150 && EMAIL_REGEX.test(clean);
}

/**
 * Evaluates password strength against OWASP-aligned MineMarket rules.
 * @param {unknown} password - Plaintext password candidate.
 * @param {{ requireSpecial?: boolean }} [options] - Complexity options.
 * @returns {{ valid: boolean, errors: string[] }} Validation result and error list.
 */
function validatePasswordPolicy(password, { requireSpecial = true } = {}) {
  const errors = [];
  if (typeof password !== 'string') {
    return { valid: false, errors: ['La contraseña debe ser una cadena de texto'] };
  }
  if (password.length < 8) {
    errors.push('Debe tener al menos 8 caracteres');
  }
  if (password.length > 72) {
    errors.push('No puede exceder los 72 caracteres (límite BCrypt)');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe incluir al menos una letra mayúscula');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Debe incluir al menos una letra minúscula');
  }
  if (!/\d/.test(password)) {
    errors.push('Debe incluir al menos un número');
  }
  if (requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Debe incluir al menos un carácter especial (!@#$%^&*...)');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates and sanitizes an in-game command template against shell/control injection.
 * @param {unknown} cmd - Command string template (may include `{player}`).
 * @param {number} [maxLen=250] - Maximum allowed characters.
 * @returns {{ isValid: boolean, sanitized?: string, error?: string }}
 */
function sanitizeConsoleCommand(cmd, maxLen = 250) {
  if (typeof cmd !== 'string') {
    return { isValid: false, error: 'El comando debe ser una cadena de texto' };
  }

  let clean = cmd.trim();
  while (clean.startsWith('/')) {
    clean = clean.slice(1).trimStart();
  }

  if (clean.length === 0) {
    return { isValid: false, error: 'El comando no puede estar vacío' };
  }
  if (clean.length > maxLen) {
    return { isValid: false, error: `Comando demasiado largo (máximo ${maxLen} caracteres)` };
  }
  if (
    DANGEROUS_COMMAND_CHARS.test(clean) ||
    COMMAND_INJECTION_PATTERNS.some((p) => p.test(clean))
  ) {
    return {
      isValid: false,
      error: 'Caracteres o operadores de shell no permitidos detectados en el comando',
    };
  }
  return { isValid: true, sanitized: clean };
}

/**
 * Constant-time string comparison helper to prevent timing side-channels.
 * @param {unknown} a - First string.
 * @param {unknown} b - Second string.
 * @returns {boolean} True when identical.
 */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Rejects dangerous URI schemes (e.g. javascript:, data:) on optional item asset URLs.
 * @param {unknown} url - URL candidate.
 * @returns {boolean} True when empty or safe HTTP/relative asset path.
 */
function isSafeAssetUrl(url) {
  if (url === undefined || url === null || url === '') return true;
  if (typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.startsWith('https://') ||
    clean.startsWith('http://') ||
    clean.startsWith('/assets/') ||
    clean.startsWith('sprite:')
  );
}

/**
 * Normalizes incoming registration role strings while rejecting privilege escalation to ADMIN.
 * @param {unknown} rawRole - Role sent by client.
 * @returns {{ role: string|null, error: string|null }}
 */
function normalizeRegistrationRole(rawRole) {
  if (rawRole === undefined || rawRole === null || rawRole === '') {
    return { role: ROLES.COMPRADOR, error: null };
  }
  const upper = String(rawRole).trim().toUpperCase();
  if (upper === ROLES.ADMIN) {
    return {
      role: null,
      error: 'El rol debe ser COMPRADOR o VENDEDOR; no está permitido registrarse como ADMIN',
    };
  }
  const mapped = ROLE_ALIASES[upper] || upper;
  if (!PUBLIC_REGISTER_ROLES.includes(mapped)) {
    return { role: null, error: 'El rol debe ser COMPRADOR o VENDEDOR' };
  }
  return { role: mapped, error: null };
}

/**
 * Validates registration request body supporting MineMarket Spanish fields and API aliases.
 * @param {Record<string, unknown>} body - Request body.
 * @returns {{ valid: boolean, errors: string[], data?: object }}
 */
function validateRegisterPayload(body = {}) {
  const errors = [];
  const rawNombre = body.nombre ?? body.displayName ?? '';
  const rawEmail = body.email ?? '';
  const rawPassword = body.password ?? '';
  const rawGamertag = body.gamertag_minecraft ?? body.minecraftUsername ?? '';
  const rawRole = body.rol ?? body.role;

  const nombre = String(rawNombre).trim();
  if (nombre.length < 2 || nombre.length > 80) {
    errors.push('El nombre debe tener entre 2 y 80 caracteres');
  }

  const email = String(rawEmail).trim().toLowerCase();
  if (!isValidEmail(email)) {
    errors.push('El formato del email es inválido');
  }

  const pwCheck = validatePasswordPolicy(rawPassword, { requireSpecial: false });
  if (!pwCheck.valid) {
    errors.push(...pwCheck.errors);
  }

  const gamertag = sanitizeMinecraftGamertag(rawGamertag);
  if (!gamertag) {
    errors.push('El gamertag_minecraft debe tener 3-16 caracteres alfanuméricos o guion bajo');
  }

  const roleResult = normalizeRegistrationRole(rawRole);
  if (roleResult.error) {
    errors.push(roleResult.error);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      nombre,
      email,
      password: String(rawPassword),
      gamertag_minecraft: gamertag,
      rol: roleResult.role,
    },
  };
}

/**
 * Validates create or partial update payloads for store catalog items.
 * @param {Record<string, unknown>} body - Request body.
 * @param {{ partial?: boolean }} [options] - Partial update mode.
 * @returns {{ valid: boolean, errors: string[], data?: object }}
 */
function validateItemPayload(body = {}, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!partial || body.nombre !== undefined) {
    const nombre = String(body.nombre ?? '').trim();
    if (nombre.length < 3 || nombre.length > 80) {
      errors.push('El nombre del ítem debe tener entre 3 y 80 caracteres');
    } else {
      data.nombre = nombre;
    }
  }

  if (!partial || body.descripcion !== undefined) {
    const descripcion = String(body.descripcion ?? '').trim();
    if (descripcion.length < 5 || descripcion.length > 500) {
      errors.push('La descripción debe tener entre 5 y 500 caracteres');
    } else {
      data.descripcion = descripcion;
    }
  }

  if (!partial || body.tipo !== undefined) {
    const tipo = String(body.tipo ?? '')
      .trim()
      .toUpperCase();
    if (!ITEM_TYPES.includes(tipo)) {
      errors.push(`El tipo debe ser uno de: ${ITEM_TYPES.join(', ')}`);
    } else {
      data.tipo = tipo;
    }
  }

  if (!partial || body.precio !== undefined) {
    const precio = Number(body.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      errors.push('El precio debe ser un número mayor a 0');
    } else {
      data.precio = Math.round(precio * 100) / 100;
    }
  }

  if (!partial || body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push('El stock debe ser un entero mayor o igual a 0');
    } else {
      data.stock = stock;
    }
  }

  if (!partial || body.servidor !== undefined) {
    const servidor = String(body.servidor ?? '').trim();
    if (servidor.length < 2 || servidor.length > 60) {
      errors.push('El servidor debe tener entre 2 y 60 caracteres');
    } else {
      data.servidor = servidor;
    }
  }

  if (body.comando !== undefined && body.comando !== '') {
    const cmdCheck = sanitizeConsoleCommand(body.comando);
    if (!cmdCheck.isValid) {
      errors.push(cmdCheck.error);
    } else {
      data.comando = cmdCheck.sanitized;
    }
  }

  if (body.imagen_url !== undefined) {
    if (!isSafeAssetUrl(body.imagen_url)) {
      errors.push('La imagen_url debe iniciar con https://, http://, /assets/ o sprite:');
    } else {
      data.imagen_url = String(body.imagen_url || '').trim();
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [], data };
}

/**
 * Validates cart mutation input (`id_item` and quantity).
 * @param {Record<string, unknown>} body - Request body.
 * @returns {{ valid: boolean, errors: string[], data?: { id_item: number, cantidad: number } }}
 */
function validateCartItemPayload(body = {}) {
  const errors = [];
  const idItem = Number(body.id_item);
  const cantidad = body.cantidad === undefined ? 1 : Number(body.cantidad);

  if (!Number.isInteger(idItem) || idItem <= 0) {
    errors.push('El id_item debe ser un entero positivo');
  }
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
    errors.push('La cantidad debe ser un entero entre 1 y 99');
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true, errors: [], data: { id_item: idItem, cantidad } };
}

/**
 * Validates checkout simulation payload.
 * @param {Record<string, unknown>} body - Request body.
 * @returns {{ valid: boolean, errors: string[], data?: { metodo_pago: string, resultado_simulado: string } }}
 */
function validateCheckoutPayload(body = {}) {
  const errors = [];
  const metodoPago = String(body.metodo_pago ?? 'TARJETA_SIMULADA').trim();
  const resultado = String(body.resultado_simulado ?? SIMULATED_RESULTS.APROBADO)
    .trim()
    .toUpperCase();

  if (metodoPago.length < 3 || metodoPago.length > 40) {
    errors.push('El metodo_pago debe tener entre 3 y 40 caracteres');
  }
  if (!Object.values(SIMULATED_RESULTS).includes(resultado)) {
    errors.push('El resultado_simulado debe ser APROBADO o RECHAZADO');
  }

  return errors.length > 0
    ? { valid: false, errors }
    : {
        valid: true,
        errors: [],
        data: { metodo_pago: metodoPago, resultado_simulado: resultado },
      };
}

module.exports = {
  sanitizeMinecraftGamertag,
  isValidEmail,
  validatePasswordPolicy,
  sanitizeConsoleCommand,
  timingSafeEqual,
  isSafeAssetUrl,
  normalizeRegistrationRole,
  validateRegisterPayload,
  validateItemPayload,
  validateCartItemPayload,
  validateCheckoutPayload,
};
