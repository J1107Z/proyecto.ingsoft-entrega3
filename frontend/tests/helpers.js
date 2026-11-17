import { vi } from 'vitest';

/** Builds an unsigned test JWT encoded in base64url UTF-8. */
export function fakeJwt(payload) {
  const encode = (obj) => {
    const utf8 = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)));
    return btoa(utf8).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.firma`;
}

export const futureExp = () => Math.floor(Date.now() / 1000) + 3600;
export const pastExp = () => Math.floor(Date.now() / 1000) - 3600;

/** Creates a mock Fetch JSON response. */
export function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined ? Promise.reject(new Error('sin cuerpo')) : Promise.resolve(body),
  };
}

export function mockFetch(...responses) {
  const fn = vi.fn();
  responses.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal('fetch', fn);
  return fn;
}
