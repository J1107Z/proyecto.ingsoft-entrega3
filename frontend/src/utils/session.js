export const STORAGE_KEY = 'minemarket_session';

/**
 * Decodes a base64url JWT payload safely in UTF-8 without verifying cryptographic signature.
 * @param {string} token
 * @returns {Record<string, unknown>|null}
 */
export function parseJwtPayload(token) {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (_err) {
    return null;
  }
}

/**
 * Returns true if the token lacks a valid `exp` claim or has already expired.
 * @param {string} token
 */
export function isTokenExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  return payload.exp * 1000 <= Date.now();
}

/**
 * Persists JWT token and public user profile in localStorage.
 * @param {string} token
 * @param {object} usuario
 */
export function saveSession(token, usuario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, usuario }));
}

/**
 * Removes stored authentication session.
 */
export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Restores a valid non-expired session from localStorage, clearing stale entries.
 * @returns {{ token: string, usuario: object }|null}
 */
export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.usuario || isTokenExpired(parsed.token)) {
      clearSession();
      return null;
    }
    return parsed;
  } catch (_err) {
    clearSession();
    return null;
  }
}
