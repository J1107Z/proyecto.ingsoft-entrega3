import { useCallback, useEffect, useState } from 'react';
import { cartApi, itemsApi } from '../services/api.js';
import ItemCard from './ItemCard.jsx';
import ItemForm from './ItemForm.jsx';

const ITEM_TYPES = ['', 'RANGO', 'KIT', 'LLAVE', 'COSMETICO', 'MONEDA'];

/**
 * Public and role-aware store catalog with search, filtering, seller CRUD, and add-to-cart actions.
 */
export default function Catalog({ session, onAuthError, onCartUpdated, onRequireLogin }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const user = session?.usuario || null;
  const canPublish = Boolean(user && (user.rol === 'VENDEDOR' || user.rol === 'ADMIN'));

  const loadItems = useCallback(async (searchTerm, typeFilter) => {
    setLoading(true);
    setErrorMessage('');
    try {
      const list = await itemsApi.list({ q: searchTerm, tipo: typeFilter });
      setItems(list);
    } catch (err) {
      setErrorMessage(err.message || 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems(query, tipo);
  }, [query, tipo, loadItems]);

  function handleApiFailure(err) {
    const details = err.detalles && err.detalles.length > 0 ? err.detalles.join('. ') : err.message;
    setErrorMessage(details || 'Error inesperado');
    if (err.status === 401 && onAuthError) {
      onAuthError();
    }
  }

  async function handleSaveItem(payload) {
    setSaving(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      if (editingItem) {
        await itemsApi.update(editingItem.id_item, payload, session.token);
        setStatusMessage('Ítem actualizado exitosamente');
      } else {
        await itemsApi.create(payload, session.token);
        setStatusMessage('Ítem publicado exitosamente');
      }
      setShowForm(false);
      setEditingItem(null);
      await loadItems(query, tipo);
    } catch (err) {
      handleApiFailure(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(item) {
    if (!window.confirm(`¿Eliminar "${item.nombre}" del catálogo?`)) {
      return;
    }
    setErrorMessage('');
    setStatusMessage('');
    try {
      await itemsApi.remove(item.id_item, session.token);
      setStatusMessage('Ítem eliminado');
      await loadItems(query, tipo);
    } catch (err) {
      handleApiFailure(err);
    }
  }

  async function handleAddToCart(item) {
    if (!session?.token) {
      if (onRequireLogin) {
        onRequireLogin('Inicia sesión para agregar ítems al carrito');
      } else {
        setErrorMessage('Inicia sesión para agregar ítems al carrito');
      }
      return;
    }
    setErrorMessage('');
    setStatusMessage('');
    try {
      const updatedCart = await cartApi.addItem(item.id_item, 1, session.token);
      setStatusMessage(`"${item.nombre}" agregado al carrito`);
      if (onCartUpdated) {
        onCartUpdated(updatedCart);
      }
    } catch (err) {
      handleApiFailure(err);
    }
  }

  return (
    <section>
      <div className="mm-hero">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem' }}>Catálogo MineMarket</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#cbd5e1' }}>
            Rangos, kits, llaves, cosméticos y moneda con entrega verificada a tu gamertag.
          </p>
        </div>

        {canPublish && !showForm && (
          <button
            type="button"
            className="mm-btn mm-btn-primary"
            onClick={() => {
              setEditingItem(null);
              setShowForm(true);
              setErrorMessage('');
            }}
          >
            + Publicar ítem
          </button>
        )}
      </div>

      {statusMessage && (
        <div role="status" className="mm-status">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="mm-alert">
          {errorMessage}
        </div>
      )}

      {showForm && (
        <ItemForm
          initialItem={editingItem}
          loading={saving}
          onSave={handleSaveItem}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
          }}
        />
      )}

      <div className="mm-toolbar">
        <input
          type="search"
          aria-label="Buscar en catálogo"
          className="mm-input"
          placeholder="Buscar por nombre, descripción o servidor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select
          aria-label="Filtrar por tipo"
          className="mm-select"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {ITEM_TYPES.filter(Boolean).map((itemType) => (
            <option key={itemType} value={itemType}>
              {itemType}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Cargando catálogo...</p>
      ) : items.length === 0 ? (
        <div className="mm-panel" style={{ textAlign: 'center', color: '#94a3b8' }}>
          No se encontraron ítems para los filtros seleccionados.
        </div>
      ) : (
        <div className="mm-grid">
          {items.map((item) => {
            const canManage = Boolean(
              user &&
              (user.rol === 'ADMIN' ||
                (user.rol === 'VENDEDOR' && Number(item.id_vendedor) === Number(user.id_usuario)))
            );
            return (
              <ItemCard
                key={item.id_item}
                item={item}
                canManage={canManage}
                onAddToCart={handleAddToCart}
                onEdit={(selected) => {
                  setEditingItem(selected);
                  setShowForm(true);
                  setErrorMessage('');
                }}
                onDelete={handleDeleteItem}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
