const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Verifies the Bearer JWT (HS256) and attaches normalized user claims to `req.user`.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = {
      id_usuario: payload.id_usuario ?? payload.sub ?? payload.userId,
      email: payload.email,
      rol: payload.rol || payload.role,
      gamertag_minecraft: payload.gamertag_minecraft || payload.gamertag || '',
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * RBAC middleware factory restricting access to the allowed role list.
 * @param {...string} allowedRoles - Permitted roles (COMPRADOR, VENDEDOR, ADMIN).
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
    }
    return next();
  };
}

module.exports = {
  authenticateToken,
  authorize,
  requireAuth: authenticateToken,
  requireRole: (...roles) => authorize(...roles),
};
