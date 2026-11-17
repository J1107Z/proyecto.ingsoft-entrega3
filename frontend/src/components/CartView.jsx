import { useState } from 'react';
import { cartApi } from '../services/api.js';
import { formatCOP, getItemSpriteUrl } from '../utils/format.js';
import CheckoutModal from './CheckoutModal.jsx';

/**
 * Persistent shopping cart view allowing quantity updates, item removal, and ACID checkout.
 */
export default function CartView({
  session,
  cart,
  onCartUpdated,
  onOrderSuccess,
  onGoToOrders,
  onBackToCatalog,
  onAuthError,
}) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const items = cart?.items || [];

  async function runCartMutation(action) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const updated = await action();
      onCartUpdated(updated);
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el carrito');
      if (err.status === 401 && onAuthError) {
        onAuthError();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mm-panel">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Mi Carrito</h1>
          <p style={{ margin: '0.2rem 0 0', color: '#94a3b8' }}>
            Entrega vinculada a tu gamertag:{' '}
            <strong style={{ color: '#34d399' }}>{session?.usuario?.gamertag_minecraft}</strong>
          </p>
        </div>

        <button type="button" className="mm-btn mm-btn-secondary" onClick={onBackToCatalog}>
          Seguir explorando
        </button>
      </div>

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

      {items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          <p>Tu carrito está vacío.</p>
          <button type="button" className="mm-btn mm-btn-primary" onClick={onBackToCatalog}>
            Ir al catálogo
          </button>
        </div>
      ) : (
        <>
          <div className="mm-list">
            {items.map((line) => (
              <div className="mm-cart-row" key={line.id_item} data-testid="cart-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1 }}>
                  <div className="mm-sprite-box">
                    <img className="mm-sprite-img" src={getItemSpriteUrl(line)} alt={line.nombre} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{line.nombre}</div>
                    <div style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                      {`${line.tipo} · ${line.servidor} · Unitario: ${formatCOP(line.precio_unitario)}`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    aria-label={`Disminuir cantidad de ${line.nombre}`}
                    className="mm-btn mm-btn-secondary"
                    disabled={busy || line.cantidad <= 1}
                    onClick={() =>
                      runCartMutation(() =>
                        cartApi.updateQuantity(line.id_item, line.cantidad - 1, session.token)
                      )
                    }
                  >
                    -
                  </button>
                  <span className="mm-mono" data-testid={`qty-${line.id_item}`}>
                    {line.cantidad}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aumentar cantidad de ${line.nombre}`}
                    className="mm-btn mm-btn-secondary"
                    disabled={busy || line.cantidad >= line.stock_disponible}
                    onClick={() =>
                      runCartMutation(() =>
                        cartApi.updateQuantity(line.id_item, line.cantidad + 1, session.token)
                      )
                    }
                  >
                    +
                  </button>
                </div>

                <div className="mm-price">{formatCOP(line.subtotal)}</div>

                <button
                  type="button"
                  className="mm-btn mm-btn-danger"
                  disabled={busy}
                  onClick={() =>
                    runCartMutation(() => cartApi.removeItem(line.id_item, session.token))
                  }
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '1rem',
              borderTop: '2px solid #2c3a5e',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Total calculado</div>
              <div className="mm-price" data-testid="cart-total">
                {formatCOP(cart.total)}
              </div>
            </div>

            <div className="mm-card-actions">
              <button
                type="button"
                className="mm-btn mm-btn-secondary"
                disabled={busy}
                onClick={() => runCartMutation(() => cartApi.clear(session.token))}
              >
                Vaciar carrito
              </button>
              <button
                type="button"
                className="mm-btn mm-btn-primary"
                disabled={busy}
                onClick={() => setShowCheckout(true)}
              >
                Finalizar compra
              </button>
            </div>
          </div>
        </>
      )}

      {showCheckout && (
        <CheckoutModal
          session={session}
          cart={cart}
          onClose={() => setShowCheckout(false)}
          onGoToOrders={() => {
            setShowCheckout(false);
            if (onGoToOrders) onGoToOrders();
          }}
          onSuccess={(orderResult) => {
            onOrderSuccess(orderResult);
          }}
        />
      )}
    </section>
  );
}
