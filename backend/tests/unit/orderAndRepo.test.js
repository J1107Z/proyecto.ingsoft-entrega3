const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../../src/db');
const { MemoryJsonRepository, PgRepository } = require('../../src/repositories/storeRepository');
const { createSeedState } = require('../../src/repositories/seedData');
const cartService = require('../../src/services/cartService');
const orderService = require('../../src/services/orderService');
const itemService = require('../../src/services/itemService');
const { listAuditLogs } = require('../../src/services/auditService');

describe('orderService, itemService, cartService & Repository coverage', () => {
  it('createSeedState soporta inicialización vacía cuando seed=false', () => {
    const empty = createSeedState({ seed: false });
    expect(empty.users).toHaveLength(0);
    expect(empty.items).toHaveLength(0);
    expect(empty.categories).toHaveLength(5);
  });

  it('MemoryJsonRepository hace rollback completo cuando falla una transacción ACID', async () => {
    const repo = new MemoryJsonRepository({ memoryOnly: true });
    await repo.reset({ seed: true });
    const itemBefore = await repo.findItemById(1);

    await expect(
      repo.runTransaction(async (txRepo) => {
        await txRepo.decrementItemStock(1, 5);
        throw new Error('Fallo simulado mitad de transacción');
      })
    ).rejects.toThrow('Fallo simulado');

    const itemAfter = await repo.findItemById(1);
    expect(itemAfter.stock).toBe(itemBefore.stock);
    expect((await repo.listCategories()).length).toBe(5);
  });

  it('MemoryJsonRepository persiste y recarga en archivo JSON real cuando memoryOnly es false', async () => {
    const tmpFile = path.join(os.tmpdir(), `mm_test_store_${Date.now()}.json`);
    try {
      const repo1 = new MemoryJsonRepository({ dataFile: tmpFile, memoryOnly: false });
      await repo1.addOrIncrementCartItem(3, 1, 2);

      const repo2 = new MemoryJsonRepository({ dataFile: tmpFile, memoryOnly: false });
      const cart = await repo2.getCartItemsByUserId(3);
      expect(cart).toHaveLength(1);
      expect(cart[0].cantidad).toBe(2);

      fs.writeFileSync(tmpFile, '{corrupt json', 'utf8');
      const repo3 = new MemoryJsonRepository({ dataFile: tmpFile, memoryOnly: false });
      expect((await repo3.listItems()).length).toBeGreaterThan(0);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('cubre ramas negativas de cartService, itemService y orderService', async () => {
    const repo = new MemoryJsonRepository({ memoryOnly: true });
    await repo.reset({ seed: true });
    const buyer = await repo.findUserById(3);
    const seller = await repo.findUserById(2);

    await expect(
      cartService.addItemToCart(3, { id_item: 0, cantidad: 1 }, repo)
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      cartService.addItemToCart(3, { id_item: 999, cantidad: 1 }, repo)
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      cartService.updateCartItemQuantity(3, 'abc', { cantidad: 1 }, repo)
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      cartService.updateCartItemQuantity(3, 1, { cantidad: 0 }, repo)
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      cartService.updateCartItemQuantity(3, 999, { cantidad: 1 }, repo)
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      cartService.updateCartItemQuantity(3, 6, { cantidad: 50 }, repo)
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      cartService.updateCartItemQuantity(3, 1, { cantidad: 1 }, repo)
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(cartService.removeItemFromCart(3, 0, repo)).rejects.toMatchObject({ status: 400 });
    await expect(cartService.removeItemFromCart(3, 99, repo)).rejects.toMatchObject({
      status: 404,
    });

    // Compra directa sobre ítem agotado y auditoría
    await itemService.updateItem(6, { stock: 0 }, seller, repo);
    await expect(itemService.deliverDirectItem(6, buyer, repo)).rejects.toMatchObject({
      status: 409,
    });
    await expect(itemService.deliverDirectItem(999, buyer, repo)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      itemService.listItems({ disponible: 'true', vendedorId: 2, servidor: 'Survival' }, repo)
    ).resolves.toMatchObject({ page: 1 });

    await expect(
      orderService.checkoutCart(buyer, { metodo_pago: 'x' }, null, repo)
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(orderService.checkoutCart(buyer, {}, null, repo)).rejects.toMatchObject({
      status: 400,
    });
    await expect(orderService.getOrderById(999, buyer, repo)).rejects.toMatchObject({
      status: 404,
    });
    await expect(orderService.dispatchDelivery(999, buyer, repo)).rejects.toMatchObject({
      status: 404,
    });
    expect(Array.isArray(await listAuditLogs(20, repo))).toBe(true);
  });

  it('PgRepository ejecuta SQL parametrizado y withTransaction maneja COMMIT y ROLLBACK', async () => {
    const executed = [];
    const fakeClient = {
      async query(sql, params) {
        executed.push({ sql: sql.trim(), params });
        if (sql.includes('audit_action_types')) return { rows: [{ id: 1 }] };
        if (sql.includes('RETURNING id') && sql.includes('users')) return { rows: [{ id: 10 }] };
        if (sql.includes('RETURNING id') && sql.includes('store_items'))
          return { rows: [{ id: 22 }] };
        if (sql.includes('FROM roles')) return { rows: [{ id: 1 }] };
        if (sql.includes('FROM store_categories')) return { rows: [{ id: 2 }] };
        if (sql.includes('FROM carts')) return { rows: [{ id: 5 }] };
        if (sql.includes('INSERT INTO cart_items')) return { rows: [{ cantidad: 3 }] };
        if (sql.includes('UPDATE cart_items'))
          return { rows: [{ id_item_carrito: 1, id_item: 22, cantidad: 4 }] };
        if (sql.includes('UPDATE store_items')) return { rowCount: 1, rows: [] };
        if (sql.includes('DELETE FROM cart_items')) return { rowCount: 1, rows: [] };
        if (sql.includes('INSERT INTO orders')) return { rows: [{ id_orden: 99, total: 1000 }] };
        if (sql.includes('INSERT INTO order_items')) return { rows: [{ id_detalle: 1 }] };
        if (sql.includes('INSERT INTO delivery_queue')) return { rows: [{ id_entrega: 7 }] };
        if (sql.includes('UPDATE delivery_queue'))
          return { rows: [{ id_entrega: 7, estado_entrega: 'ENTREGADO' }] };
        if (sql.includes('INSERT INTO audit_logs')) return { rows: [{ id_log: 3 }] };
        if (sql.includes('FROM users')) return { rows: [{ id_usuario: 10, email: 'a@b.co' }] };
        if (sql.includes('FROM store_items'))
          return { rows: [{ id_item: 22, nombre: 'Test', tipo: 'KIT', activo: true }] };
        if (sql.includes('FROM cart_items'))
          return { rows: [{ id_item_carrito: 1, id_item: 22, cantidad: 2 }] };
        if (sql.includes('FROM orders')) return { rows: [{ id_orden: 99, id_usuario: 10 }] };
        if (sql.includes('FROM delivery_queue')) return { rows: [{ id_entrega: 7, id_orden: 99 }] };
        if (sql.includes('FROM idempotency_keys'))
          return { rows: [{ response_status: 201, response_body: {} }] };
        return { rows: [], rowCount: 0 };
      },
      release: jest.fn(),
    };

    const fakePg = {
      query: fakeClient.query,
      async withTransaction(fn) {
        await fakeClient.query('BEGIN');
        try {
          const out = await fn(fakeClient);
          await fakeClient.query('COMMIT');
          return out;
        } catch (err) {
          await fakeClient.query('ROLLBACK');
          throw err;
        }
      },
    };

    const pgRepo = new PgRepository(fakePg);
    await pgRepo.runTransaction(async (tx) => {
      await tx.createUser({
        nombre: 'PG User',
        email: 'pg@mm.com',
        password_hash: 'h',
        rol: 'COMPRADOR',
        gamertag_minecraft: 'PgPlayer',
      });
      await tx.findUserByEmail('pg@mm.com');
      await tx.findUserByGamertag('PgPlayer');
      await tx.listCategories();
      await tx.listItems();
      await tx.createItem({
        tipo: 'KIT',
        id_vendedor: 10,
        nombre: 'Kit PG',
        descripcion: 'Test',
        precio: 1000,
        stock: 5,
        servidor: 'Survival',
        comando: 'give {player} stone 1',
      });
      await tx.updateItem(22, { stock: 4 });
      await tx.addOrIncrementCartItem(10, 22, 1);
      await tx.getCartItemsByUserId(10);
      await tx.setCartItemQuantity(10, 22, 4);
      await tx.removeCartItem(10, 22);
      await tx.clearCart(10);
      await tx.decrementItemStock(22, 1);
      await tx.createOrder({
        codigo_uuid: 'u-1',
        id_usuario: 10,
        total: 1000,
        estado: 'PAGADO',
        metodo_pago: 'SIM',
        detalles: [
          {
            id_item: 22,
            nombre_snapshot: 'Kit PG',
            precio_unitario: 1000,
            cantidad: 1,
            subtotal: 1000,
          },
        ],
      });
      await tx.enqueueDelivery({
        id_orden: 99,
        id_item: 22,
        gamertag_minecraft: 'PgPlayer',
        servidor: 'Survival',
        comando_a_ejecutar: 'give PgPlayer stone 1',
        estado_entrega: 'PENDIENTE',
      });
      await tx.findOrderById(99);
      await tx.findDeliveryById(7);
      await tx.updateDeliveryStatus(7, 'ENTREGADO');
      await tx.saveIdempotencyRecord(10, 'key-1', 201, {});
      await tx.findIdempotencyRecord(10, 'key-1');
      await tx.createAuditLog({ id_usuario: 10, accion: 'TEST', entidad: 'orden' });
      await tx.listAuditLogs(10);
    });

    await expect(
      pgRepo.runTransaction(async () => {
        throw new Error('PG Rollback Test');
      })
    ).rejects.toThrow('PG Rollback Test');

    expect(executed.some((q) => q.sql === 'BEGIN')).toBe(true);
    expect(executed.some((q) => q.sql === 'COMMIT')).toBe(true);
    expect(executed.some((q) => q.sql === 'ROLLBACK')).toBe(true);
    await expect(db.query('SELECT 1')).rejects.toThrow('DATABASE_URL no configurado');
    await expect(db.withTransaction(async () => {})).rejects.toThrow('DATABASE_URL no configurado');
    await db.closePool();
  });
});
