import { useState } from 'react';
import { authApi } from '../services/api.js';

/**
 * Login form authenticating via email and password against `/api/auth/login`.
 */
export default function LoginForm({ onLogin, onGoToRegister, initialEmail = '', notice = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      onLogin(res.token, res.usuario);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mm-panel mm-auth-box">
      <h1 style={{ marginTop: 0 }}>Iniciar sesión</h1>
      {notice && (
        <div role="status" className="mm-status">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="mm-alert">
          {error}
        </div>
      )}

      <form aria-label="Formulario de inicio de sesión" onSubmit={handleSubmit} noValidate>
        <div className="mm-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="mm-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="steve@minemarket.com"
          />
        </div>

        <div className="mm-field">
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            className="mm-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          className="mm-btn mm-btn-primary"
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>

      <div className="mm-demo-bar">
        <button
          type="button"
          className="mm-btn mm-btn-secondary"
          onClick={() => {
            setEmail('comprador@minemarket.com');
            setPassword('Comprador1');
          }}
        >
          Demo Comprador
        </button>
        <button
          type="button"
          className="mm-btn mm-btn-secondary"
          onClick={() => {
            setEmail('vendedor@minemarket.com');
            setPassword('Vendedor1');
          }}
        >
          Demo Vendedor
        </button>
        <button
          type="button"
          className="mm-btn mm-btn-secondary"
          onClick={() => {
            setEmail('admin@minemarket.com');
            setPassword('Admin1234');
          }}
        >
          Demo Admin
        </button>
      </div>

      <p style={{ marginTop: '1rem', textAlign: 'center', color: '#94a3b8' }}>
        ¿No tienes cuenta?{' '}
        <button type="button" className="mm-btn-link" onClick={onGoToRegister}>
          Regístrate
        </button>
      </p>
    </section>
  );
}
