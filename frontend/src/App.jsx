import { useCallback, useEffect, useState } from 'react';
import { cartApi } from './services/api.js';
import { clearSession, loadSession, saveSession } from './utils/session.js';
import Header from './components/Header.jsx';
import Catalog from './components/Catalog.jsx';
import LoginForm from './components/LoginForm.jsx';
import RegisterForm from './components/RegisterForm.jsx';
import CartView from './components/CartView.jsx';
import OrdersView from './components/OrdersView.jsx';
import AuditLogsView from './components/AuditLogsView.jsx';

/**
 * Root MineMarket application managing session state, persistent cart count, and active views.
 */
export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [view, setView] = useState('catalog');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [cart, setCart] = useState({ items: [], total_items: 0, total_unidades: 0, total: 0 });

  const syncCart = useCallback(async (token) => {
    if (!token) {
      setCart({ items: [], total_items: 0, total_unidades: 0, total: 0 });
      return;
    }
    try {
      const current = await cartApi.getCart(token);
      if (current && Array.isArray(current.items)) {
        setCart(current);
      }
    } catch (_err) {
      // Keep non-blocking fallback cart summary on transient/test stubbed requests.
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      syncCart(session.token);
    }
  }, [session?.token, syncCart]);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setCart({ items: [], total_items: 0, total_unidades: 0, total: 0 });
    setLoginNotice('');
    setView('login');
  }, []);

  function handleLoginSuccess(token, usuario) {
    saveSession(token, usuario);
    setSession({ token, usuario });
    setLoginNotice('');
    setView('catalog');
  }

  function handleRegistered(email) {
    setLoginEmail(email);
    setLoginNotice('Cuenta creada con éxito. Ahora inicia sesión con tus credenciales.');
    setView('login');
  }

  function handleRequireLogin(noticeMessage) {
    setLoginNotice(noticeMessage);
    setView('login');
  }

  return (
    <div className="mm-app">
      <Header
        session={session}
        view={view}
        cartCount={cart.total_unidades || 0}
        onNavigate={(nextView) => {
          setLoginNotice('');
          setView(nextView);
        }}
        onLogout={handleLogout}
      />

      <main className="mm-main">
        {view === 'login' && (
          <LoginForm
            initialEmail={loginEmail}
            notice={loginNotice}
            onLogin={handleLoginSuccess}
            onGoToRegister={() => setView('register')}
          />
        )}

        {view === 'register' && (
          <RegisterForm onRegistered={handleRegistered} onGoToLogin={() => setView('login')} />
        )}

        {view === 'catalog' && (
          <Catalog
            session={session}
            onAuthError={handleLogout}
            onCartUpdated={(updated) => setCart(updated)}
            onRequireLogin={handleRequireLogin}
          />
        )}

        {view === 'cart' && session && (
          <CartView
            session={session}
            cart={cart}
            onCartUpdated={(updated) => setCart(updated)}
            onOrderSuccess={() => {
              setCart({ items: [], total_items: 0, total_unidades: 0, total: 0 });
            }}
            onGoToOrders={() => setView('orders')}
            onBackToCatalog={() => setView('catalog')}
            onAuthError={handleLogout}
          />
        )}

        {view === 'orders' && session && (
          <OrdersView session={session} onAuthError={handleLogout} />
        )}

        {view === 'audit' && session?.usuario?.rol === 'ADMIN' && (
          <AuditLogsView session={session} onAuthError={handleLogout} />
        )}
      </main>
    </div>
  );
}
