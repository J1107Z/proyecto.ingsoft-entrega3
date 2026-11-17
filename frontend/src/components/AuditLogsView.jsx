import { useEffect, useState } from 'react';
import { auditApi } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';

/**
 * Administrative audit log panel inspecting security and transactional events.
 */
export default function AuditLogsView({ session, onAuthError }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    auditApi
      .list(session.token)
      .then((entries) => {
        if (active) setLogs(entries);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'No se pudo cargar la bitácora de auditoría');
        if (err.status === 401 && onAuthError) {
          onAuthError();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.token, onAuthError]);

  return (
    <section className="mm-panel">
      <h1 style={{ marginTop: 0 }}>Auditoría de Seguridad y Transacciones</h1>
      {error && (
        <div role="alert" className="mm-alert">
          {error}
        </div>
      )}
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Cargando registros...</p>
      ) : logs.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>No hay eventos registrados aún.</p>
      ) : (
        <div className="mm-list">
          {logs.map((entry) => (
            <div key={entry.id_log} className="mm-cart-row" data-testid="audit-row">
              <div>
                <span className="mm-badge">{entry.accion}</span>{' '}
                <strong style={{ marginLeft: '0.4rem' }}>{entry.usuario_email}</strong>
                {entry.usuario_gamertag && (
                  <span style={{ color: '#94a3b8' }}>{` (${entry.usuario_gamertag})`}</span>
                )}
                <div className="mm-mono" style={{ color: '#94a3b8', marginTop: '0.2rem' }}>
                  {`${entry.entidad} #${entry.entidad_id || '-'} · ${JSON.stringify(entry.detalles)}`}
                </div>
              </div>
              <div className="mm-mono" style={{ color: '#94a3b8' }}>
                {formatDateTime(entry.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
