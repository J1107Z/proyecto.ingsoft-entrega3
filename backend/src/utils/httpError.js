/**
 * Typed HTTP error used by services and controllers to emit deterministic status codes.
 */
class HttpError extends Error {
  /**
   * @param {number} status - HTTP status code.
   * @param {string} message - Human-readable error message.
   * @param {string[]|null} [detalles=null] - Optional field validation messages.
   */
  constructor(status, message, detalles = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.detalles = detalles;
  }
}

module.exports = HttpError;
