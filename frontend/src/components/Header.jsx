import { ShoppingCart, PackageCheck, ShieldAlert, LogOut, Store } from 'lucide-react';
import { McPlayerFace } from './ui/MinecraftSprites.jsx';

/**
 * Top navigation header displaying branding, role-aware tabs, cart counter, and session controls.
 */
export default function Header({ session, view, cartCount = 0, onNavigate, onLogout }) {
  const user = session?.usuario;

  return (
    <header className="mm-header">
      <div className="mm-header-inner">
        <button type="button" className="mm-brand" onClick={() => onNavigate('catalog')}>
          <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
            <rect width="36" height="36" rx="8" fill="#064e3b" stroke="#34d399" strokeWidth="2" />
            <polygon points="18,6 28,13 24,29 12,29 8,13" fill="#10b981" />
            <polygon points="18,9 24,14 21,25 15,25 12,14" fill="#6ee7b7" />
          </svg>
          <div>
            <span className="mm-brand-title">MineMarket</span>
            <span className="mm-brand-sub">Tienda Digital para Servidores Minecraft</span>
          </div>
        </button>

        <nav className="mm-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`mm-btn ${view === 'catalog' ? 'mm-btn-primary' : 'mm-btn-secondary'}`}
            onClick={() => onNavigate('catalog')}
          >
            <Store size={16} />
            Catálogo
          </button>

          {user && (
            <>
              <button
                type="button"
                className={`mm-btn ${view === 'cart' ? 'mm-btn-primary' : 'mm-btn-secondary'}`}
                onClick={() => onNavigate('cart')}
              >
                <ShoppingCart size={16} />
                {`Mi Carrito (${cartCount})`}
              </button>

              <button
                type="button"
                className={`mm-btn ${view === 'orders' ? 'mm-btn-primary' : 'mm-btn-secondary'}`}
                onClick={() => onNavigate('orders')}
              >
                <PackageCheck size={16} />
                Mis Compras
              </button>
            </>
          )}

          {user?.rol === 'ADMIN' && (
            <button
              type="button"
              className={`mm-btn ${view === 'audit' ? 'mm-btn-primary' : 'mm-btn-secondary'}`}
              onClick={() => onNavigate('audit')}
            >
              <ShieldAlert size={16} />
              Auditoría
            </button>
          )}

          {user ? (
            <>
              <span className="mm-user-chip" data-testid="user-chip">
                <McPlayerFace username={user.gamertag_minecraft} size={22} />
                <span>{`${user.gamertag_minecraft} · ${user.rol}`}</span>
              </span>
              <button type="button" className="mm-btn mm-btn-danger" onClick={onLogout}>
                <LogOut size={16} />
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`mm-btn ${view === 'login' ? 'mm-btn-primary' : 'mm-btn-secondary'}`}
                onClick={() => onNavigate('login')}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={`mm-btn ${view === 'register' ? 'mm-btn-primary' : 'mm-btn-accent'}`}
                onClick={() => onNavigate('register')}
              >
                Registrarse
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
