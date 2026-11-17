import { formatCOP, getItemSpriteUrl } from '../utils/format.js';

/**
 * Displays a single catalog digital item with COP price, stock badge, cart CTA, and owner/admin controls.
 */
export default function ItemCard({ item, canManage, onEdit, onDelete, onAddToCart }) {
  const hasStock = Number(item.stock) > 0;

  return (
    <article className="mm-card" data-testid="item-card" aria-label={item.nombre}>
      <div>
        <div className="mm-card-head">
          <div className="mm-sprite-box">
            <img
              className="mm-sprite-img"
              src={getItemSpriteUrl(item)}
              alt={item.nombre}
              onError={(e) => {
                e.currentTarget.src = '/assets/minecraft/textures/item/enchanted_book.png';
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div className="mm-badges">
              <span className="mm-badge">{item.tipo}</span>
              <span className="mm-badge">{item.servidor}</span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.08rem' }}>{item.nombre}</h2>
          </div>
        </div>

        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0.75rem 0' }}>
          {item.descripcion}
        </p>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.65rem',
          }}
        >
          <span className="mm-price">{formatCOP(item.precio)}</span>
          <span className={`mm-badge ${hasStock ? 'mm-badge-stock' : 'mm-badge-empty'}`}>
            {hasStock ? `${item.stock} disponibles` : 'Agotado'}
          </span>
        </div>

        <div className="mm-card-actions">
          {onAddToCart && (
            <button
              type="button"
              className="mm-btn mm-btn-primary"
              disabled={!hasStock}
              onClick={() => onAddToCart(item)}
            >
              Agregar al carrito
            </button>
          )}

          {canManage && (
            <>
              <button
                type="button"
                className="mm-btn mm-btn-secondary"
                onClick={() => onEdit(item)}
              >
                Editar
              </button>
              <button type="button" className="mm-btn mm-btn-danger" onClick={() => onDelete(item)}>
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
