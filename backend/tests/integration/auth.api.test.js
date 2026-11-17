const request = require('supertest');
const app = require('../../src/index');
const { storeRepository } = require('../../src/repositories/storeRepository');

const nuevoUsuario = {
  nombre: 'Alex',
  email: 'alex@minemarket.com',
  password: 'Esmeralda99',
  gamertag_minecraft: 'AlexCrafter',
  rol: 'VENDEDOR',
};

beforeEach(async () => {
  await storeRepository.reset({ seed: true });
});

describe('POST /api/auth/register', () => {
  it('registra un usuario y no expone el hash de la contraseña', async () => {
    const res = await request(app).post('/api/auth/register').send(nuevoUsuario);

    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({
      email: 'alex@minemarket.com',
      gamertag_minecraft: 'AlexCrafter',
      rol: 'VENDEDOR',
    });
    expect(res.body.usuario).not.toHaveProperty('password_hash');
    expect(res.body.usuario).not.toHaveProperty('password');
  });

  it('asigna rol COMPRADOR por defecto', async () => {
    const { rol: _rol, ...sinRol } = nuevoUsuario;
    const res = await request(app).post('/api/auth/register').send(sinRol);
    expect(res.status).toBe(201);
    expect(res.body.usuario.rol).toBe('COMPRADOR');
  });

  it('prohíbe auto-asignarse el rol ADMIN en el registro público', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nuevoUsuario, rol: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ADMIN/);
  });

  it('responde 409 si el email ya existe', async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nuevoUsuario, gamertag_minecraft: 'OtroTag' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/);
  });

  it('responde 409 si el gamertag ya existe (sin distinguir mayúsculas)', async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nuevoUsuario, email: 'otro@mm.com', gamertag_minecraft: 'alexcrafter' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/gamertag/);
  });

  it('responde 400 con detalles si los datos son inválidos', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'no-es-email' });
    expect(res.status).toBe(400);
    expect(res.body.detalles.length).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(nuevoUsuario);
  });

  it('retorna un JWT con credenciales válidas e incluye cabeceras de seguridad', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ALEX@minemarket.com', password: 'Esmeralda99' });

    expect(res.status).toBe(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.usuario.gamertag_minecraft).toBe('AlexCrafter');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('responde 401 con contraseña incorrecta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex@minemarket.com', password: 'Incorrecta1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciales inválidas');
  });

  it('responde 401 con email inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@minemarket.com', password: 'Esmeralda99' });
    expect(res.status).toBe(401);
  });

  it('responde 400 si faltan campos', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('retorna el usuario autenticado y rechaza peticiones sin token', async () => {
    const unauth = await request(app).get('/api/auth/me');
    expect(unauth.status).toBe(401);

    const reg = await request(app).post('/api/auth/register').send(nuevoUsuario);
    const res = await request(app)
      .get('/api/auth/me')
      .set({ Authorization: `Bearer ${reg.body.token}` });

    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe('alex@minemarket.com');
  });
});
