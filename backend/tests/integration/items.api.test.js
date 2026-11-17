const request = require('supertest');
const app = require('../../src/index');
const { storeRepository } = require('../../src/repositories/storeRepository');

const itemNuevo = {
  nombre: 'Kit Minero',
  descripcion: 'Pico de diamante Eficiencia V y antorchas',
  tipo: 'KIT',
  precio: 4500,
  stock: 30,
  servidor: 'CraftLand',
};

async function registrarYLogin(datos) {
  await request(app).post('/api/auth/register').send(datos);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: datos.email, password: datos.password });
  return res.body.token;
}

const vendedorA = {
  nombre: 'Vendedor Uno',
  email: 'a@mm.com',
  password: 'Vendedor1',
  gamertag_minecraft: 'VendedorA',
  rol: 'VENDEDOR',
};
const vendedorB = {
  nombre: 'Vendedor Dos',
  email: 'b@mm.com',
  password: 'Vendedor2',
  gamertag_minecraft: 'VendedorB',
  rol: 'VENDEDOR',
};
const comprador = {
  nombre: 'Comprador Tres',
  email: 'c@mm.com',
  password: 'Comprador1',
  gamertag_minecraft: 'CompradorC',
  rol: 'COMPRADOR',
};

let tokenA;
let tokenB;
let tokenComprador;
let tokenAdmin;

beforeEach(async () => {
  await storeRepository.reset({ seed: true });
  [tokenA, tokenB, tokenComprador] = await Promise.all([
    registrarYLogin(vendedorA),
    registrarYLogin(vendedorB),
    registrarYLogin(comprador),
  ]);
  const admin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@minemarket.com', password: 'Admin1234' });
  tokenAdmin = admin.body.token;
});

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('GET /api/items (catálogo público)', () => {
  it('lista los ítems semilla sin autenticación', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(6);
    expect(res.body.total).toBe(6);
  });

  it('filtra por tipo, texto, rango de precio y servidor', async () => {
    const porTipo = await request(app).get('/api/items?tipo=LLAVE');
    expect(porTipo.body.items.map((i) => i.tipo)).toEqual(['LLAVE']);

    const porTexto = await request(app).get('/api/items?q=skyblock');
    expect(porTexto.body.items.length).toBeGreaterThanOrEqual(2);

    const porPrecio = await request(app).get('/api/items?minPrice=18000&maxPrice=26000');
    expect(porPrecio.body.items.every((i) => i.precio >= 18000 && i.precio <= 26000)).toBe(true);
  });

  it('obtiene un ítem por id y responde 404 si no existe', async () => {
    const found = await request(app).get('/api/items/1');
    expect(found.status).toBe(200);
    expect(found.body.item.nombre).toBe('Rango VIP Diamante');
    expect((await request(app).get('/api/items/999')).status).toBe(404);
  });
});

describe('POST /api/items', () => {
  it('un VENDEDOR crea un ítem asociado a su id', async () => {
    const res = await request(app).post('/api/items').set(auth(tokenA)).send(itemNuevo);
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ ...itemNuevo, id_item: 7 });
    expect(res.body.item.id_vendedor).toBeDefined();
  });

  it('responde 401 sin token', async () => {
    expect((await request(app).post('/api/items').send(itemNuevo)).status).toBe(401);
  });

  it('responde 403 a un COMPRADOR (RBAC)', async () => {
    expect(
      (await request(app).post('/api/items').set(auth(tokenComprador)).send(itemNuevo)).status
    ).toBe(403);
  });

  it('responde 400 con datos inválidos o intento de inyección de comandos', async () => {
    const badPrice = await request(app)
      .post('/api/items')
      .set(auth(tokenA))
      .send({ ...itemNuevo, precio: 0 });
    expect(badPrice.status).toBe(400);

    const badCmd = await request(app)
      .post('/api/items')
      .set(auth(tokenA))
      .send({ ...itemNuevo, comando: 'give {player} diamond; rm -rf /' });
    expect(badCmd.status).toBe(400);
  });
});

describe('PUT /api/items/:id', () => {
  let idItem;
  beforeEach(async () => {
    idItem = (await request(app).post('/api/items').set(auth(tokenA)).send(itemNuevo)).body.item
      .id_item;
  });

  it('el propietario actualiza precio y stock', async () => {
    const res = await request(app)
      .put(`/api/items/${idItem}`)
      .set(auth(tokenA))
      .send({ precio: 3900, stock: 25 });
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ precio: 3900, stock: 25, nombre: 'Kit Minero' });
  });

  it('ignora campos no editables como id_vendedor', async () => {
    const original = (await request(app).get(`/api/items/${idItem}`)).body.item;
    const res = await request(app)
      .put(`/api/items/${idItem}`)
      .set(auth(tokenA))
      .send({ id_vendedor: 999, stock: 1 });
    expect(res.body.item.id_vendedor).toBe(original.id_vendedor);
  });

  it('responde 403 si otro vendedor intenta editarlo', async () => {
    expect(
      (await request(app).put(`/api/items/${idItem}`).set(auth(tokenB)).send({ precio: 1 })).status
    ).toBe(403);
  });

  it('un ADMIN puede editar cualquier ítem', async () => {
    expect(
      (await request(app).put(`/api/items/${idItem}`).set(auth(tokenAdmin)).send({ stock: 0 }))
        .status
    ).toBe(200);
  });

  it('responde 400 con datos inválidos o cuerpo vacío y 404 si no existe', async () => {
    expect(
      (await request(app).put(`/api/items/${idItem}`).set(auth(tokenA)).send({ tipo: 'X' })).status
    ).toBe(400);
    expect((await request(app).put(`/api/items/${idItem}`).set(auth(tokenA)).send({})).status).toBe(
      400
    );
    expect(
      (await request(app).put('/api/items/999').set(auth(tokenA)).send({ stock: 1 })).status
    ).toBe(404);
  });
});

describe('DELETE /api/items/:id y POST /api/items/:id/deliver', () => {
  let idItem;
  beforeEach(async () => {
    idItem = (await request(app).post('/api/items').set(auth(tokenA)).send(itemNuevo)).body.item
      .id_item;
  });

  it('responde 403 si intenta eliminar otro vendedor', async () => {
    expect((await request(app).delete(`/api/items/${idItem}`).set(auth(tokenB))).status).toBe(403);
  });

  it('el propietario realiza borrado lógico y deja de aparecer en GET público', async () => {
    expect((await request(app).delete(`/api/items/${idItem}`).set(auth(tokenA))).status).toBe(200);
    expect((await request(app).get(`/api/items/${idItem}`)).status).toBe(404);
  });

  it('POST /:id/deliver fuerza la entrega al gamertag del JWT del usuario', async () => {
    const res = await request(app)
      .post('/api/items/1/deliver')
      .set(auth(tokenComprador))
      .send({ playerGamertag: 'OtroHacker' });
    expect(res.status).toBe(200);
    expect(res.body.deliveredTo).toBe('CompradorC');
    expect(res.body.entrega.estado_entrega).toBe('PENDIENTE');
  });
});

describe('Aplicación general', () => {
  it('GET /api/health responde ok y maneja 404 / JSON mal formado', async () => {
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');

    expect((await request(app).get('/api/no-existe')).status).toBe(404);

    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(malformed.status).toBe(400);
  });
});
