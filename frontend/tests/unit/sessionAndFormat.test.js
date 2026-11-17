import { describe, expect, it } from 'vitest';
import {
  clearSession,
  isTokenExpired,
  loadSession,
  parseJwtPayload,
  saveSession,
  STORAGE_KEY,
} from '../../src/utils/session.js';
import { formatCOP, formatDateTime, getItemSpriteUrl } from '../../src/utils/format.js';
import { fakeJwt, futureExp, pastExp } from '../helpers.js';

describe('session utilities', () => {
  it('guarda y carga una sesión JWT válida con caracteres UTF-8', () => {
    const token = fakeJwt({ sub: 1, exp: futureExp(), nombre: 'José_MC' });
    const usuario = { id_usuario: 1, gamertag_minecraft: 'Steve_MC', rol: 'COMPRADOR' };

    saveSession(token, usuario);
    const loaded = loadSession();

    expect(loaded).toEqual({ token, usuario });
    expect(parseJwtPayload(token).nombre).toBe('José_MC');
  });

  it('limpia y retorna null cuando el token está expirado o el JSON es corrupto', () => {
    saveSession(fakeJwt({ sub: 1, exp: pastExp() }), { gamertag_minecraft: 'Old' });
    expect(loadSession()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    localStorage.setItem(STORAGE_KEY, '{corrupt');
    expect(loadSession()).toBeNull();

    expect(isTokenExpired('invalido')).toBe(true);
    clearSession();
  });
});

describe('format utilities', () => {
  it('formatea precios en COP, fechas y rutas de sprites Minecraft', () => {
    expect(formatCOP(25000)).toMatch(/25\.000/);
    expect(formatCOP(undefined)).toMatch(/0/);
    expect(formatDateTime('')).toBe('—');
    expect(formatDateTime('2026-04-01T12:00:00.000Z')).not.toBe('—');

    expect(getItemSpriteUrl({ imagen_url: 'sprite:diamond' })).toContain('diamond.png');
    expect(getItemSpriteUrl({ imagen_url: 'https://cdn.mm.com/img.png' })).toBe(
      'https://cdn.mm.com/img.png'
    );
    expect(getItemSpriteUrl({ tipo: 'MONEDA' })).toContain('emerald.png');
    expect(getItemSpriteUrl({ tipo: 'OTRO' })).toContain('enchanted_book.png');
  });
});
