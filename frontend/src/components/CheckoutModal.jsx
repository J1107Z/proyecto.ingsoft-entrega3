import { useState } from 'react';
import { ordersApi } from '../services/api.js';
import { formatCOP } from '../utils/format.js';

/**
 * Simulated payment checkout modal sending an Idempotency-Key and displaying order UUID receipts.
 */
export default function CheckoutModal({ session, cart, onClose, onGoToOrders, onSuccess }) {
  const [metodoPago, setMetodoPago] = useState('TARJETA_SIMULADA');
  const [resultadoSimulado, setResultadoSimulado] = useState('APROBADO');
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mm-${Date.now()}`
  );
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCheckout(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await ordersApi.checkout(
        {
          metodo_pago: metodoPago,
          resultado_simulado: resultadoSimulado,
        },
        session.token,
        idempotencyKey
      );
      setReceipt(result);
      onSuccess(result);
    } catch (err) {
      setError(err.message || 'No se pudo procesar el pago');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="mm-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Pasarela de pago"
    >
      <div className="mm-panel mm-modal-card">
        {receipt ? (
          <div data-testid="order-receipt">
            <h2 style={{ marginTop: 0, color: '#34d399' }}>Compra confirmada</h2>
            <div className="mm-status">
              {`Orden #${receipt.orden.id_orden} (${receipt.orden.estado})`}
            </div>
            <p>
              <strong>Código UUID:</strong>{' '}
              <span className="mm-mono">{receipt.orden.codigo_uuid}</span>
            </p>
            <p>
              <strong>Total pagado:</strong>{' '}
              <span className="mm-price">{formatCOP(receipt.orden.total)}</span>
            </p>
            <p>
              <strong>Jugador destino:</strong> <span>{session?.usuario?.gamertag_minecraft}</span>
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              {`Se encolaron ${receipt.entregas?.length || 0} entregas en estado PENDIENTE.`}
            </p>
            <button
              type="button"
              className="mm-btn mm-btn-primary"
              onClick={() => (onGoToOrders ? onGoToOrders() : onClose())}
            >
              Ver mis compras
            </button>
          </div>
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Confirmar compra</h2>
            <p style={{ color: '#cbd5e1' }}>
              Se entregarán los ítems a <strong>{session?.usuario?.gamertag_minecraft}</strong> por{' '}
              <span className="mm-price">{formatCOP(cart.total)}</span>.
            </p>

            {error && (
              <div role="alert" className="mm-alert">
                {error}
              </div>
            )}

            <form aria-label="Formulario de pago simulado" onSubmit={handleCheckout}>
              <div className="mm-field">
                <label htmlFor="pay-method">Método de pago</label>
                <select
                  id="pay-method"
                  className="mm-select"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option value="TARJETA_SIMULADA">Tarjeta Simulada</option>
                  <option value="PSE_SIMULADO">PSE Simulado</option>
                  <option value="NEQUI_SIMULADO">Nequi Simulado</option>
                </select>
              </div>

              <div className="mm-field">
                <label htmlFor="pay-sim-result">Resultado simulado</label>
                <select
                  id="pay-sim-result"
                  className="mm-select"
                  value={resultadoSimulado}
                  onChange={(e) => setResultadoSimulado(e.target.value)}
                >
                  <option value="APROBADO">APROBADO</option>
                  <option value="RECHAZADO">RECHAZADO</option>
                </select>
              </div>

              <div className="mm-card-actions">
                <button type="submit" className="mm-btn mm-btn-primary" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Confirmar y pagar'}
                </button>
                <button
                  type="button"
                  className="mm-btn mm-btn-secondary"
                  disabled={submitting}
                  onClick={onClose}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
