const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { storeRepository } = require('../repositories/storeRepository');
const { DUMMY_BCRYPT_HASH } = require('../utils/constants');
const HttpError = require('../utils/httpError');
const { validateRegisterPayload } = require('../utils/validators');
const { logAudit } = require('./auditService');

/**
 * Projects a stored user entity to its public, secret-free DTO.
 * @param {object} user - Internal user record.
 * @returns {object} Public user object without password hashes.
 */
function toPublicUser(user) {
  return {
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    gamertag_minecraft: user.gamertag_minecraft,
    created_at: user.created_at,
  };
}

/**
 * Signs an HS256 JWT token carrying user identity and linked Minecraft gamertag.
 * @param {object} user - Stored user entity.
 * @returns {string} Signed JWT string.
 */
function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id_usuario,
      id_usuario: user.id_usuario,
      email: user.email,
      rol: user.rol,
      gamertag_minecraft: user.gamertag_minecraft,
    },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    }
  );
}

/**
 * Registers a new COMPRADOR or VENDEDOR account with BCrypt hashing and gamertag uniqueness.
 * @param {object} payload - Raw request body.
 * @param {object} [repo=storeRepository] - Repository dependency.
 */
async function registerUser(payload, repo = storeRepository) {
  const validation = validateRegisterPayload(payload);
  if (!validation.valid) {
    throw new HttpError(400, validation.errors[0], validation.errors);
  }

  const { nombre, email, password, gamertag_minecraft, rol } = validation.data;

  const existingEmail = await repo.findUserByEmail(email);
  if (existingEmail) {
    throw new HttpError(409, 'Ya existe una cuenta registrada con ese email');
  }

  const existingGamertag = await repo.findUserByGamertag(gamertag_minecraft);
  if (existingGamertag) {
    throw new HttpError(409, 'El gamertag de Minecraft ya está vinculado a otra cuenta');
  }

  const password_hash = await bcrypt.hash(password, 10);
  const created = await repo.createUser({
    nombre,
    email,
    password_hash,
    rol,
    gamertag_minecraft,
  });

  await logAudit(
    {
      id_usuario: created.id_usuario,
      accion: 'USER_REGISTER',
      entidad: 'usuario',
      entidad_id: created.id_usuario,
      detalles: { rol: created.rol, gamertag: created.gamertag_minecraft },
    },
    repo
  );

  return {
    usuario: toPublicUser(created),
    token: issueToken(created),
  };
}

/**
 * Authenticates an existing user using constant-time hashing protection against timing attacks.
 * @param {{ email?: string, password?: string }} payload - Login credentials.
 * @param {object} [repo=storeRepository] - Repository dependency.
 */
async function loginUser(payload = {}, repo = storeRepository) {
  const email = String(payload.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(payload.password ?? '');

  if (!email || !password) {
    throw new HttpError(400, 'Debes proporcionar email y contraseña');
  }

  const user = await repo.findUserByEmail(email);
  if (!user) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    throw new HttpError(401, 'Credenciales inválidas');
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    await logAudit(
      {
        id_usuario: user.id_usuario,
        accion: 'LOGIN_FAILED',
        entidad: 'usuario',
        entidad_id: user.id_usuario,
        detalles: { email },
      },
      repo
    );
    throw new HttpError(401, 'Credenciales inválidas');
  }

  await logAudit(
    {
      id_usuario: user.id_usuario,
      accion: 'LOGIN_SUCCESS',
      entidad: 'usuario',
      entidad_id: user.id_usuario,
      detalles: { rol: user.rol },
    },
    repo
  );

  return {
    usuario: toPublicUser(user),
    token: issueToken(user),
  };
}

/**
 * Loads the authenticated user's public profile.
 * @param {number} userId - User ID from JWT claims.
 * @param {object} [repo=storeRepository] - Repository dependency.
 */
async function getProfile(userId, repo = storeRepository) {
  const user = await repo.findUserById(userId);
  if (!user) {
    throw new HttpError(404, 'Usuario no encontrado');
  }
  return toPublicUser(user);
}

module.exports = {
  toPublicUser,
  issueToken,
  registerUser,
  loginUser,
  getProfile,
};
