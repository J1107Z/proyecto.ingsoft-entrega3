import { useCallback, useEffect, useState } from 'react';
import { deliveriesApi, ordersApi } from '../services/api.js';
import { formatCOP, formatDateTime } from '../utils/format.js';

/**
 * Displays purchase history with UUID receipts and in-game delivery queue status.
 */
export default function OrdersView({ session, onAuthError }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const role = session?.usuario?.rol;
  const canDispatch = role === 'ADMIN' || role === 'VENDEDOR';

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await ordersApi.list(session.token);
      setOrders(list);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus órdenes');
      if (err.status === 401 && onAuthError) {
        onAuthError();
      }
    } finally {
      setLoading(false);
    }
  }, [session?.token, onAuthError]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleDispatch(deliveryId) {
    setError('');
    setStatus('');
    try {
      await deliveriesApi.dispatch(deliveryId, session.token);
      setStatus(`Entrega #${deliveryId} marcada como ENTREGADO`);
      await loadOrders();
    } catch (err) {
      setError(err.message || 'No se pudo despachar la entrega');
    }
  }

  return (
    <section className="mm-panel">
      <h1 style={{ marginTop: 0 }}>
        {role === 'ADMIN' ? 'Órdenes y Cola de Entregas' : 'Mis Compras y Entregas'}
      </h1>

      {status && (
        <div role="status" className="mm-status">
          {status}
        </div>
      )}
      {error && (
        <div role="alert" className="mm-alert">
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Cargando historial...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Aún no registras órdenes completadas.</p>
      ) : (
        <div className="mm-list">
          {orders.map((order) => (
            <article className="mm-panel" key={order.id_orden} data-testid="order-card">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <strong>{`Orden #${order.id_orden}`}</strong> ·{' '}
                  <span className="mm-badge mm-badge-stock">{order.estado}</span>
                  <div className="mm-mono" style={{ color: '#94a3b8', marginTop: '0.2rem' }}>
                    {`UUID: ${order.codigo_uuid} · ${formatDateTime(order.created_at)}`}
                  </div>
                </div>
                <div className="mm-price">{formatCOP(order.total)}</div>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                {order.detalles?.map((det) => (
                  <div key={det.id_detalle} style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>
                    {`• ${det.nombre_snapshot} x${det.cantidad} — ${formatCOP(det.subtotal)}`}
                  </div>
                ))}
              </div>

              {order.entregas?.length > 0 && (
                <div
                  style={{
                    marginTop: '0.8rem',
                    borderTop: '1px solid #2c3a5e',
                    paddingTop: '0.7rem',
                  }}
                >
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                    Cola de entrega in-game:
                  </div>
                  {order.entregas.map((ent) => (
                    <div
                      key={ent.id_entrega}
                      className="mm-cart-row"
                      style={{ marginBottom: '0.4rem', padding: '0.55rem 0.75rem' }}
                    >
                      <div>
                        <span className="mm-badge">{ent.estado_entrega}</span>{' '}
                        <strong style={{ marginLeft: '0.3rem' }}>{ent.gamertag_minecraft}</strong>{' '}
                        <span style={{ color: '#94a3b8' }}>{`(${ent.servidor})`}</span>
                        <div className="mm-mono" style={{ color: '#38bdf8', marginTop: '0.2rem' }}>
                          {`/${ent.comando_a_ejecutar}`}
                        </div>
                      </div>

                      {canDispatch && ent.estado_entrega === 'PENDIENTE' && (
                        <button
                          type="button"
                          className="mm-btn mm-btn-accent"
                          onClick={() => handleDispatch(ent.id_entrega)}
                        >
                          Despachar entrega
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
