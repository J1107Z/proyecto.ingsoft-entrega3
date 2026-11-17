import { useState } from 'react';

const ITEM_TYPES = ['RANGO', 'KIT', 'LLAVE', 'COSMETICO', 'MONEDA'];

/**
 * Create/Edit catalog item form preserving clean numeric submission and server error feedback.
 */
export default function ItemForm({ initialItem = null, onSave, onCancel, loading = false }) {
  const isEditing = Boolean(initialItem);
  const [form, setForm] = useState({
    nombre: initialItem?.nombre || '',
    descripcion: initialItem?.descripcion || '',
    tipo: initialItem?.tipo || 'RANGO',
    servidor: initialItem?.servidor || '',
    precio: initialItem?.precio !== undefined ? String(initialItem.precio) : '',
    stock: initialItem?.stock !== undefined ? String(initialItem.stock) : '',
    comando: initialItem?.comando || '',
  });

  function updateField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      tipo: form.tipo,
      servidor: form.servidor,
      precio: Number(form.precio),
      stock: Number(form.stock),
    };
    if (form.comando.trim()) {
      payload.comando = form.comando.trim();
    }
    onSave(payload);
  }

  return (
    <section className="mm-panel" style={{ marginBottom: '1.25rem' }}>
      <h2 style={{ marginTop: 0 }}>{isEditing ? 'Editar ítem' : 'Publicar nuevo ítem'}</h2>

      <form aria-label="Formulario de ítem" onSubmit={handleSubmit} noValidate>
        <div className="mm-form-grid">
          <div className="mm-field">
            <label htmlFor="item-nombre">Nombre del ítem</label>
            <input
              id="item-nombre"
              className="mm-input"
              value={form.nombre}
              onChange={updateField('nombre')}
            />
          </div>

          <div className="mm-field">
            <label htmlFor="item-tipo">Tipo</label>
            <select
              id="item-tipo"
              className="mm-select"
              value={form.tipo}
              onChange={updateField('tipo')}
            >
              {ITEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="mm-field">
            <label htmlFor="item-servidor">Servidor</label>
            <input
              id="item-servidor"
              className="mm-input"
              value={form.servidor}
              onChange={updateField('servidor')}
            />
          </div>

          <div className="mm-field">
            <label htmlFor="item-precio">Precio (COP)</label>
            <input
              id="item-precio"
              type="number"
              className="mm-input"
              value={form.precio}
              onChange={updateField('precio')}
            />
          </div>

          <div className="mm-field">
            <label htmlFor="item-stock">Stock</label>
            <input
              id="item-stock"
              type="number"
              className="mm-input"
              value={form.stock}
              onChange={updateField('stock')}
            />
          </div>

          <div className="mm-field">
            <label htmlFor="item-comando">Comando Minecraft (opcional)</label>
            <input
              id="item-comando"
              className="mm-input"
              value={form.comando}
              onChange={updateField('comando')}
              placeholder="give {player} diamond 8"
            />
          </div>
        </div>

        <div className="mm-field">
          <label htmlFor="item-descripcion">Descripción</label>
          <textarea
            id="item-descripcion"
            rows="2"
            className="mm-textarea"
            value={form.descripcion}
            onChange={updateField('descripcion')}
          />
        </div>

        <div className="mm-card-actions">
          <button type="submit" className="mm-btn mm-btn-primary" disabled={loading}>
            {isEditing ? 'Guardar cambios' : 'Publicar ítem'}
          </button>
          <button type="button" className="mm-btn mm-btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}
