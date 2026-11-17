const { DUMMY_BCRYPT_HASH } = require('../utils/constants');
const {
  validatePasswordPolicy,
  sanitizeMinecraftGamertag,
  sanitizeConsoleCommand,
  timingSafeEqual,
  isSafeAssetUrl,
} = require('../utils/validators');

/**
 * Strips potentially dangerous control characters and caps length on error strings.
 * @param {unknown} input - Arbitrary text.
 * @param {number} [maxLen=200] - Maximum length.
 * @returns {string} Sanitized plain string.
 */
function sanitizePlainText(input, maxLen = 200) {
  if (typeof input !== 'string') return '';
  return input
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, maxLen);
}

/**
 * Express middleware removing X-Powered-By and enforcing strict defensive headers.
 */
function securityHeaders(_req, res, next) {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

module.exports = {
  validatePasswordPolicy,
  sanitizeMinecraftGamertag,
  sanitizeConsoleCommand,
  timingSafeEqual,
  isSafeAssetUrl,
  sanitizePlainText,
  securityHeaders,
  DUMMY_BCRYPT_HASH,
};
