const request = require('supertest');
const app = require('../../src/index');
const { storeRepository } = require('../../src/repositories/storeRepository');

const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Carrito Persistente, Checkout ACID, Entregas y Auditoría API', () => {
  let buyerToken;
  let sellerToken;
  let adminToken;

  beforeEach(async () => {
    await storeRepository.reset({ seed: true });
    const [bRes, sRes, aRes] = await Promise.all([
      request(app)
        .post('/api/auth/login')
        .send({ email: 'comprador@minemarket.com', password: 'Comprador1' }),
      request(app)
        .post('/api/auth/login')
        .send({ email: 'vendedor@minemarket.com', password: 'Vendedor1' }),
      request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@minemarket.com', password: 'Admin1234' }),
    ]);
    buyerToken = bRes.body.token;
    sellerToken = sRes.body.token;
    adminToken = aRes.body.token;
  });

  it('persiste el carrito por usuario y calcula totales en el backend', async () => {
    const add1 = await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 1, cantidad: 2 });
    expect(add1.status).toBe(200);
    expect(add1.body.carrito.total).toBe(50000);
    expect(add1.body.carrito.total_unidades).toBe(2);

    const updated = await request(app)
      .put('/api/cart/items/1')
      .set(auth(buyerToken))
      .send({ cantidad: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body.carrito.total).toBe(75000);

    // Al volver a iniciar sesión, el carrito persiste intacto.
    const reLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'comprador@minemarket.com', password: 'Comprador1' });
    const getAfterLogin = await request(app).get('/api/cart').set(auth(reLogin.body.token));
    expect(getAfterLogin.body.carrito.items[0].cantidad).toBe(3);

    const afterRemoval = await request(app).delete('/api/cart/items/1').set(auth(buyerToken));
    expect(afterRemoval.status).toBe(200);
    expect(afterRemoval.body.carrito.items).toHaveLength(0);

    const cleared = await request(app).delete('/api/cart').set(auth(buyerToken));
    expect(cleared.body.carrito.items).toHaveLength(0);
  });

  it('rechaza con 409 agregar más unidades que el stock disponible', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 6, cantidad: 99 });
    expect(res.status).toBe(409);
  });

  it('ejecuta checkout ACID completo: descuenta stock, crea orden UUID, encola entrega y limpia carrito', async () => {
    const stockBefore = (await request(app).get('/api/items/2')).body.item.stock;
    await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 2, cantidad: 2 });

    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set({ ...auth(buyerToken), 'idempotency-key': 'idem-key-100' })
      .send({ metodo_pago: 'TARJETA_SIMULADA', resultado_simulado: 'APROBADO' });

    expect(checkout.status).toBe(201);
    expect(checkout.body.orden.codigo_uuid).toBeDefined();
    expect(checkout.body.orden.estado).toBe('PAGADO');
    expect(checkout.body.orden.total).toBe(36000);
    expect(checkout.body.entregas[0].gamertag_minecraft).toBe('JugadorSteve');
    expect(checkout.body.entregas[0].estado_entrega).toBe('PENDIENTE');

    const stockAfter = (await request(app).get('/api/items/2')).body.item.stock;
    expect(stockAfter).toBe(stockBefore - 2);

    const cartAfter = (await request(app).get('/api/cart').set(auth(buyerToken))).body.carrito;
    expect(cartAfter.items).toHaveLength(0);

    // Reintento con la misma Idempotency-Key no cobra ni descuenta stock dos veces.
    const replay = await request(app)
      .post('/api/orders/checkout')
      .set({ ...auth(buyerToken), 'idempotency-key': 'idem-key-100' })
      .send({ metodo_pago: 'TARJETA_SIMULADA', resultado_simulado: 'APROBADO' });
    expect(replay.status).toBe(201);
    expect(replay.headers['x-idempotent-replay']).toBe('true');
    expect(replay.body.orden.codigo_uuid).toBe(checkout.body.orden.codigo_uuid);
    expect((await request(app).get('/api/items/2')).body.item.stock).toBe(stockBefore - 2);
  });

  it('hace ROLLBACK completo con 409 si otro comprador agota el stock antes del checkout', async () => {
    // Producto #6 tiene stock 15. Agregamos 10 unidades del producto #6 y 1 unidad del #1.
    await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 1, cantidad: 1 });
    await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 6, cantidad: 10 });

    const stock1Before = (await request(app).get('/api/items/1')).body.item.stock;
    // El vendedor reduce stock del ítem #6 a 5 mientras el comprador tenía 10 en carrito.
    await request(app).put('/api/items/6').set(auth(sellerToken)).send({ stock: 5 });

    const failedCheckout = await request(app)
      .post('/api/orders/checkout')
      .set(auth(buyerToken))
      .send({ metodo_pago: 'TARJETA_SIMULADA', resultado_simulado: 'APROBADO' });

    expect(failedCheckout.status).toBe(409);
    // ROLLBACK verificado: el ítem #1 tampoco perdió stock y el carrito sigue intacto.
    expect((await request(app).get('/api/items/1')).body.item.stock).toBe(stock1Before);
    expect(
      (await request(app).get('/api/cart').set(auth(buyerToken))).body.carrito.items
    ).toHaveLength(2);
  });

  it('maneja pasarela RECHAZADO (402) sin crear orden ni descontar stock', async () => {
    const stockBefore = (await request(app).get('/api/items/3')).body.item.stock;
    await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 3, cantidad: 1 });

    const res = await request(app)
      .post('/api/orders/checkout')
      .set(auth(buyerToken))
      .send({ metodo_pago: 'PSE_SIMULADO', resultado_simulado: 'RECHAZADO' });

    expect(res.status).toBe(402);
    expect((await request(app).get('/api/items/3')).body.item.stock).toBe(stockBefore);
    expect((await request(app).get('/api/orders').set(auth(buyerToken))).body.ordenes).toHaveLength(
      0
    );
  });

  it('permite consultar ordenes propias, despachar entregas por VENDEDOR/ADMIN y consultar auditoría ADMIN', async () => {
    await request(app)
      .post('/api/cart/items')
      .set(auth(buyerToken))
      .send({ id_item: 1, cantidad: 1 });
    const checkout = await request(app)
      .post('/api/orders/checkout')
      .set(auth(buyerToken))
      .send({ metodo_pago: 'TARJETA_SIMULADA' });

    const orderId = checkout.body.orden.id_orden;
    const deliveryId = checkout.body.entregas[0].id_entrega;

    // Otro comprador/vendedor no propietario recibe 403 al consultar la orden directamente
    const forbiddenOrder = await request(app).get(`/api/orders/${orderId}`).set(auth(sellerToken));
    expect(forbiddenOrder.status).toBe(403);

    // Comprador sí puede consultar su orden y no puede despachar entregas
    expect((await request(app).get(`/api/orders/${orderId}`).set(auth(buyerToken))).status).toBe(
      200
    );
    expect(
      (await request(app).patch(`/api/deliveries/${deliveryId}/dispatch`).set(auth(buyerToken)))
        .status
    ).toBe(403);

    // Vendedor del ítem despacha entrega y previene doble despacho (409)
    const dispatch = await request(app)
      .patch(`/api/deliveries/${deliveryId}/dispatch`)
      .set(auth(sellerToken));
    expect(dispatch.status).toBe(200);
    expect(dispatch.body.entrega.estado_entrega).toBe('ENTREGADO');

    expect(
      (await request(app).patch(`/api/deliveries/${deliveryId}/dispatch`).set(auth(adminToken)))
        .status
    ).toBe(409);

    // Auditoría solo accesible por ADMIN
    expect((await request(app).get('/api/audit').set(auth(buyerToken))).status).toBe(403);
    const audit = await request(app).get('/api/audit').set(auth(adminToken));
    expect(audit.status).toBe(200);
    expect(audit.body.logs.length).toBeGreaterThan(0);
  });
});
