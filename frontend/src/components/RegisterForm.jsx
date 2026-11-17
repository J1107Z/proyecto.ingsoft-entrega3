import { useState } from 'react';
import { authApi } from '../services/api.js';

/**
 * User registration form linking a verified Minecraft gamertag and role (COMPRADOR/VENDEDOR).
 */
export default function RegisterForm({ onRegistered, onGoToLogin }) {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    gamertag_minecraft: '',
    rol: 'COMPRADOR',
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors([]);
    setLoading(true);
    try {
      await authApi.register(form);
      onRegistered(form.email);
    } catch (err) {
      const list = err.detalles && err.detalles.length > 0 ? err.detalles : [err.message];
      setErrors(list);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mm-panel mm-auth-box">
      <h1 style={{ marginTop: 0 }}>Crear cuenta</h1>
      {errors.length > 0 && (
        <div role="alert" className="mm-alert">
          {errors.map((msg) => (
            <div key={msg}>{msg}</div>
          ))}
        </div>
      )}

      <form aria-label="Formulario de registro" onSubmit={handleSubmit} noValidate>
        <div className="mm-field">
          <label htmlFor="reg-nombre">Nombre</label>
          <input
            id="reg-nombre"
            className="mm-input"
            value={form.nombre}
            onChange={updateField('nombre')}
            placeholder="Steve Rodríguez"
          />
        </div>

        <div className="mm-field">
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            type="email"
            className="mm-input"
            value={form.email}
            onChange={updateField('email')}
            placeholder="steve@minemarket.com"
          />
        </div>

        <div className="mm-field">
          <label htmlFor="reg-password">Contraseña</label>
          <input
            id="reg-password"
            type="password"
            className="mm-input"
            value={form.password}
            onChange={updateField('password')}
            placeholder="Mín. 8 chars, mayúscula y número"
          />
        </div>

        <div className="mm-field">
          <label htmlFor="reg-gamertag">Gamertag de Minecraft</label>
          <input
            id="reg-gamertag"
            className="mm-input"
            value={form.gamertag_minecraft}
            onChange={updateField('gamertag_minecraft')}
            placeholder="Steve_MC"
          />
        </div>

        <div className="mm-field">
          <label htmlFor="reg-rol">Tipo de cuenta</label>
          <select id="reg-rol" className="mm-select" value={form.rol} onChange={updateField('rol')}>
            <option value="COMPRADOR">Comprador</option>
            <option value="VENDEDOR">Vendedor</option>
          </select>
        </div>

        <button
          type="submit"
          className="mm-btn mm-btn-primary"
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? 'Registrando...' : 'Registrarme'}
        </button>
      </form>

      <p style={{ marginTop: '1rem', textAlign: 'center', color: '#94a3b8' }}>
        ¿Ya tienes cuenta?{' '}
        <button type="button" className="mm-btn-link" onClick={onGoToLogin}>
          Inicia sesión
        </button>
      </p>
    </section>
  );
}
