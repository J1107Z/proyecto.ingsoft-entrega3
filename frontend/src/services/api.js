const BASE_URL = '/api';

/**
 * Structured API error retaining HTTP status and validation details.
 */
export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {string[]} [detalles=[]]
   */
  constructor(status, message, detalles = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles;
  }
}

async function request(path, { method = 'GET', body, token, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_err) {
    if (!res.ok) {
      throw new ApiError(res.status, 'Error de comunicación con el servidor');
    }
    return null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, data?.error || 'Error inesperado', data?.detalles || []);
  }

  return data;
}

export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  me: (token) => request('/auth/me', { token }),
};

export const itemsApi = {
  async list(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.set(key, String(val));
      }
    });
    const qs = params.toString();
    const data = await request(qs ? `/items?${qs}` : '/items');
    return Array.isArray(data) ? data : data?.items || [];
  },
  async create(payload, token) {
    const data = await request('/items', { method: 'POST', body: payload, token });
    return data?.item ?? data;
  },
  async update(id, payload, token) {
    const data = await request(`/items/${id}`, { method: 'PUT', body: payload, token });
    return data?.item ?? data;
  },
  remove: (id, token) => request(`/items/${id}`, { method: 'DELETE', token }),
};

export const cartApi = {
  async getCart(token) {
    const data = await request('/cart', { token });
    return data?.carrito ?? data;
  },
  async addItem(id_item, cantidad = 1, token) {
    const data = await request('/cart/items', {
      method: 'POST',
      body: { id_item, cantidad },
      token,
    });
    return data?.carrito ?? data;
  },
  async updateQuantity(id_item, cantidad, token) {
    const data = await request(`/cart/items/${id_item}`, {
      method: 'PUT',
      body: { cantidad },
      token,
    });
    return data?.carrito ?? data;
  },
  async removeItem(id_item, token) {
    const data = await request(`/cart/items/${id_item}`, { method: 'DELETE', token });
    return data?.carrito ?? data;
  },
  async clear(token) {
    const data = await request('/cart', { method: 'DELETE', token });
    return data?.carrito ?? data;
  },
};

export const ordersApi = {
  checkout: (payload, token, idempotencyKey) =>
    request('/orders/checkout', {
      method: 'POST',
      body: payload,
      token,
      extraHeaders: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    }),
  async list(token) {
    const data = await request('/orders', { token });
    return Array.isArray(data) ? data : data?.ordenes || [];
  },
  async getById(id, token) {
    const data = await request(`/orders/${id}`, { token });
    return data?.orden ?? data;
  },
};

export const deliveriesApi = {
  async dispatch(id, token) {
    const data = await request(`/deliveries/${id}/dispatch`, { method: 'PATCH', token });
    return data?.entrega ?? data;
  },
};

export const auditApi = {
  async list(token) {
    const data = await request('/audit', { token });
    return Array.isArray(data) ? data : data?.logs || [];
  },
};
