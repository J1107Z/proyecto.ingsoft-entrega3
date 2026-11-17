import { describe, expect, it } from 'vitest';
import {
  ApiError,
  auditApi,
  authApi,
  cartApi,
  deliveriesApi,
  itemsApi,
  ordersApi,
} from '../../src/services/api.js';
import { jsonResponse, mockFetch } from '../helpers.js';

describe('authApi', () => {
  it('login envía email y password por POST y retorna el token', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { token: 'abc', usuario: { id_usuario: 1 } }));

    const res = await authApi.login('steve@mm.com', 'Clave1234');

    expect(res.token).toBe('abc');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ email: 'steve@mm.com', password: 'Clave1234' });
  });

  it('me consulta el perfil autenticado', async () => {
    const fetchMock = mockFetch(jsonResponse(200, { usuario: { id_usuario: 2 } }));
    const res = await authApi.me('tok-me');
    expect(res.usuario.id_usuario).toBe(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-me');
  });

  it('lanza ApiError con status, mensaje y detalles cuando el backend responde error', async () => {
    mockFetch(
      jsonResponse(400, {
        error: 'Datos de registro inválidos',
        detalles: ['El email no es válido'],
      })
    );

    const promise = authApi.register({ email: 'x' });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      detalles: ['El email no es válido'],
    });
  });

  it('usa un mensaje genérico si la respuesta de error no es JSON', async () => {
    mockFetch(jsonResponse(500));
    await expect(authApi.login('a', 'b')).rejects.toThrow('Error de comunicación con el servidor');
  });
});

describe('itemsApi', () => {
  it('list construye la query string con los filtros', async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, []),
      jsonResponse(200, { items: [{ id_item: 1 }] })
    );
    await itemsApi.list({ tipo: 'KIT', q: 'sky block' });
    const list = await itemsApi.list();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/items?tipo=KIT&q=sky+block');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/items');
    expect(list).toHaveLength(1);
  });

  it('create, update y remove envían el token Bearer', async () => {
    const fetchMock = mockFetch(
      jsonResponse(201, { item: { id_item: 9 } }),
      jsonResponse(200, {}),
      {
        ok: true,
        status: 204,
      }
    );

    const created = await itemsApi.create({ nombre: 'X' }, 'tok');
    await itemsApi.update(3, { precio: 10 }, 'tok');
    const removed = await itemsApi.remove(3, 'tok');

    expect(created.id_item).toBe(9);
    expect(removed).toBeNull();
    expect(fetchMock.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
      'POST /api/items',
      'PUT /api/items/3',
      'DELETE /api/items/3',
    ]);
    fetchMock.mock.calls.forEach(([, o]) => expect(o.headers.Authorization).toBe('Bearer tok'));
    expect(fetchMock.mock.calls[2][1].headers['Content-Type']).toBeUndefined();
  });
});

describe('cartApi, ordersApi, deliveriesApi y auditApi', () => {
  it('invoca endpoints transaccionales con JWT e Idempotency-Key', async () => {
    const fetchMock = mockFetch(
      jsonResponse(200, { carrito: { items: [], total: 0 } }),
      jsonResponse(200, { carrito: { items: [{ id_item: 1 }], total: 1000 } }),
      jsonResponse(200, { carrito: { items: [{ id_item: 1 }], total: 2000 } }),
      jsonResponse(200, { carrito: { items: [], total: 0 } }),
      jsonResponse(200, { carrito: { items: [], total: 0 } }),
      jsonResponse(201, { orden: { id_orden: 1 } }),
      jsonResponse(200, { ordenes: [{ id_orden: 1 }] }),
      jsonResponse(200, { orden: { id_orden: 1 } }),
      jsonResponse(200, { entrega: { id_entrega: 5, estado_entrega: 'ENTREGADO' } }),
      jsonResponse(200, { logs: [{ id_log: 1 }] })
    );

    await cartApi.getCart('t');
    await cartApi.addItem(1, 1, 't');
    await cartApi.updateQuantity(1, 2, 't');
    await cartApi.removeItem(1, 't');
    await cartApi.clear('t');
    await ordersApi.checkout({ metodo_pago: 'TARJETA_SIMULADA' }, 't', 'idem-123');
    const list = await ordersApi.list('t');
    const one = await ordersApi.getById(1, 't');
    const del = await deliveriesApi.dispatch(5, 't');
    const logs = await auditApi.list('t');

    expect(fetchMock.mock.calls[5][1].headers['Idempotency-Key']).toBe('idem-123');
    expect(list).toHaveLength(1);
    expect(one.id_orden).toBe(1);
    expect(del.estado_entrega).toBe('ENTREGADO');
    expect(logs).toHaveLength(1);
  });
});
