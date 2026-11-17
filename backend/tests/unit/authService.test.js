const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const authService = require('../../src/services/authService');
const { storeRepository } = require('../../src/repositories/storeRepository');

describe('authService - unit', () => {
  beforeEach(async () => {
    await storeRepository.reset({ seed: true });
  });

  it('toPublicUser elimina campos sensibles y issueToken firma JWT HS256 con expiración <= 2h', () => {
    const token = authService.issueToken({
      id_usuario: 7,
      email: 'alex@minemarket.com',
      rol: 'VENDEDOR',
      gamertag_minecraft: 'AlexCrafter',
      password_hash: 'secreto',
    });

    expect(token.split('.')).toHaveLength(3);
    const decoded = jwt.verify(token, config.jwtSecret);
    expect(decoded).toMatchObject({
      sub: 7,
      id_usuario: 7,
      email: 'alex@minemarket.com',
      rol: 'VENDEDOR',
      gamertag_minecraft: 'AlexCrafter',
    });
    expect(decoded).not.toHaveProperty('password_hash');
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(7200);
  });

  it('registerUser hashea la contraseña con BCrypt y crea el perfil sin exponer password_hash', async () => {
    const result = await authService.registerUser({
      nombre: 'Alex',
      email: 'alex@minemarket.com',
      password: 'Esmeralda99',
      gamertag_minecraft: 'AlexCrafter',
      rol: 'VENDEDOR',
    });

    expect(result.usuario.rol).toBe('VENDEDOR');
    expect(result.usuario).not.toHaveProperty('password_hash');
    const saved = await storeRepository.findUserByEmail('alex@minemarket.com');
    expect(saved.password_hash).toMatch(/^\$2[aby]\$10\$/);
  });

  it('loginUser rechaza credenciales vacías, usuario inexistente y contraseña errónea', async () => {
    await expect(authService.loginUser({})).rejects.toMatchObject({ status: 400 });
    await expect(
      authService.loginUser({ email: 'nadie@mm.com', password: 'Admin1234' })
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      authService.loginUser({ email: 'admin@minemarket.com', password: 'WrongPassword1' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('getProfile retorna perfil existente o lanza 404 si no existe', async () => {
    const profile = await authService.getProfile(1);
    expect(profile.email).toBe('admin@minemarket.com');
    await expect(authService.getProfile(9999)).rejects.toMatchObject({ status: 404 });
  });
});
