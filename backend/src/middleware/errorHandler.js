const HttpError = require('../utils/httpError');

/**
 * Centralized Express error handler serializing HttpError or unexpected exceptions safely.
 */
function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.detalles && err.detalles.length > 0) {
      body.detalles = err.detalles;
      body.details = err.detalles;
    }
    return res.status(err.status).json(body);
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
  }

  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = errorHandler;
