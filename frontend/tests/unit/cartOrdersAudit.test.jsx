import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartView from '../../src/components/CartView.jsx';
import OrdersView from '../../src/components/OrdersView.jsx';
import AuditLogsView from '../../src/components/AuditLogsView.jsx';
import { McPlayerFace } from '../../src/components/ui/MinecraftSprites.jsx';
import { jsonResponse, mockFetch } from '../helpers.js';

const buyerSession = {
  token: 'tok-buyer',
  usuario: { id_usuario: 3, gamertag_minecraft: 'JugadorSteve', rol: 'COMPRADOR' },
};

const adminSession = {
  token: 'tok-admin',
  usuario: { id_usuario: 1, gamertag_minecraft: 'AdminMarket', rol: 'ADMIN' },
};

const populatedCart = {
  items: [
    {
      id_item: 1,
      nombre: 'Rango VIP Diamante',
      tipo: 'RANGO',
      servidor: 'Survival Tierra',
      imagen_url: 'sprite:diamond',
      precio_unitario: 25000,
      cantidad: 2,
      stock_disponible: 10,
      subtotal: 50000,
    },
  ],
  total_items: 1,
  total_unidades: 2,
  total: 50000,
};

describe('CartView & CheckoutModal', () => {
  it('renderiza carrito vacío y permite volver al catálogo', async () => {
    const onBack = vi.fn();
    render(
      <CartView
        session={buyerSession}
        cart={{ items: [], total: 0 }}
        onCartUpdated={vi.fn()}
        onOrderSuccess={vi.fn()}
        onBackToCatalog={onBack}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ir al catálogo' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('permite incrementar cantidad, vaciar carrito y procesar checkout aprobado con recibo UUID', async () => {
    const onCartUpdated = vi.fn();
    const onOrderSuccess = vi.fn();
    const onGoToOrders = vi.fn();

    mockFetch(
      jsonResponse(200, { carrito: { ...populatedCart, total: 75000 } }),
      jsonResponse(201, {
        orden: { id_orden: 10, codigo_uuid: 'uuid-abc-123', estado: 'PAGADO', total: 50000 },
        entregas: [{ id_entrega: 1 }],
      })
    );

    render(
      <CartView
        session={buyerSession}
        cart={populatedCart}
        onCartUpdated={onCartUpdated}
        onOrderSuccess={onOrderSuccess}
        onGoToOrders={onGoToOrders}
        onBackToCatalog={vi.fn()}
      />
    );

    await userEvent.click(screen.getByLabelText('Aumentar cantidad de Rango VIP Diamante'));
    expect(onCartUpdated).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Finalizar compra' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y pagar' }));

    const receipt = await screen.findByTestId('order-receipt');
    expect(receipt).toHaveTextContent('uuid-abc-123');
    expect(onOrderSuccess).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Ver mis compras' }));
    expect(onGoToOrders).toHaveBeenCalled();
  });

  it('muestra error en modal cuando la pasarela simulada rechaza el pago', async () => {
    mockFetch(jsonResponse(402, { error: 'Pago rechazado por la pasarela simulada' }));

    render(
      <CartView
        session={buyerSession}
        cart={populatedCart}
        onCartUpdated={vi.fn()}
        onOrderSuccess={vi.fn()}
        onBackToCatalog={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Finalizar compra' }));
    await userEvent.selectOptions(screen.getByLabelText('Resultado simulado'), 'RECHAZADO');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar y pagar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pago rechazado');
  });
});

describe('OrdersView, AuditLogsView y McPlayerFace', () => {
  it('permite a ADMIN despachar entregas pendientes y visualizar registros de auditoría', async () => {
    const order = {
      id_orden: 1,
      codigo_uuid: 'uuid-999',
      estado: 'PAGADO',
      total: 25000,
      created_at: '2026-04-01T12:00:00.000Z',
      detalles: [{ id_detalle: 1, nombre_snapshot: 'Rango VIP', cantidad: 1, subtotal: 25000 }],
      entregas: [
        {
          id_entrega: 7,
          estado_entrega: 'PENDIENTE',
          gamertag_minecraft: 'JugadorSteve',
          servidor: 'Survival',
          comando_a_ejecutar: 'lp user JugadorSteve parent set vip',
        },
      ],
    };

    mockFetch(
      jsonResponse(200, { ordenes: [order] }),
      jsonResponse(200, { entrega: { id_entrega: 7, estado_entrega: 'ENTREGADO' } }),
      jsonResponse(200, {
        ordenes: [{ ...order, entregas: [{ ...order.entregas[0], estado_entrega: 'ENTREGADO' }] }],
      })
    );

    render(<OrdersView session={adminSession} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Despachar entrega' }));
    expect(await screen.findByRole('status')).toHaveTextContent('ENTREGADO');
  });

  it('muestra la bitácora de auditoría para ADMIN y maneja errores en McPlayerFace', async () => {
    mockFetch(
      jsonResponse(200, {
        logs: [
          {
            id_log: 1,
            accion: 'ORDER_CHECKOUT_PAID',
            usuario_email: 'comprador@minemarket.com',
            usuario_gamertag: 'JugadorSteve',
            entidad: 'orden',
            entidad_id: '1',
            detalles: { total: 25000 },
            created_at: '2026-04-01T12:00:00.000Z',
          },
        ],
      })
    );

    render(
      <div>
        <AuditLogsView session={adminSession} />
        <McPlayerFace username="Steve" />
      </div>
    );

    expect(await screen.findByTestId('audit-row')).toHaveTextContent('ORDER_CHECKOUT_PAID');
    const img = screen.getByAltText('Steve');
    fireEvent.error(img);
    fireEvent.error(img);
    expect(screen.getByText('ST')).toBeInTheDocument();
  });

  it('App permite navegar entre Registro, Login, Carrito, Compras y Auditoría como ADMIN', async () => {
    const App = (await import('../../src/App.jsx')).default;
    const { saveSession } = await import('../../src/utils/session.js');
    const { fakeJwt, futureExp } = await import('../helpers.js');

    mockFetch(
      jsonResponse(200, []),
      jsonResponse(200, { carrito: { items: [], total_unidades: 0, total: 0 } }),
      jsonResponse(200, { ordenes: [] }),
      jsonResponse(200, { logs: [] }),
      jsonResponse(200, [])
    );
    saveSession(fakeJwt({ exp: futureExp() }), adminSession.usuario);
    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /Mi Carrito/ }));
    expect(screen.getByText('Tu carrito está vacío.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mis Compras' }));
    expect(await screen.findByText(/Aún no registras órdenes/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Auditoría' }));
    expect(await screen.findByText(/No hay eventos registrados/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await userEvent.click(screen.getByRole('button', { name: 'Registrarse' }));
    expect(screen.getByRole('form', { name: 'Formulario de registro' })).toBeInTheDocument();
  });

  it('cubre ramas de error 401/alert en CartView, OrdersView, AuditLogsView y navegación invitado en App', async () => {
    const { cleanup } = await import('@testing-library/react');
    const onAuthError = vi.fn();
    mockFetch(
      jsonResponse(200, {
        carrito: {
          ...populatedCart,
          items: [{ ...populatedCart.items[0], cantidad: 1 }],
          total: 25000,
        },
      }),
      jsonResponse(401, { error: 'Sesión expirada' }),
      jsonResponse(401, { error: 'Sesión expirada' }),
      jsonResponse(401, { error: 'Sesión expirada' })
    );

    render(
      <CartView
        session={buyerSession}
        cart={populatedCart}
        onCartUpdated={vi.fn()}
        onOrderSuccess={vi.fn()}
        onBackToCatalog={vi.fn()}
        onAuthError={onAuthError}
      />
    );
    await userEvent.click(screen.getByLabelText('Disminuir cantidad de Rango VIP Diamante'));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(onAuthError).toHaveBeenCalledTimes(1);
    cleanup();

    render(<OrdersView session={adminSession} onAuthError={onAuthError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesión expirada');
    cleanup();

    render(<AuditLogsView session={adminSession} onAuthError={onAuthError} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Sesión expirada');
    expect(onAuthError).toHaveBeenCalledTimes(3);
    cleanup();

    const App = (await import('../../src/App.jsx')).default;
    mockFetch(
      jsonResponse(200, [
        {
          id_item: 1,
          nombre: 'Rango VIP',
          descripcion: 'Desc',
          tipo: 'RANGO',
          precio: 25000,
          stock: 5,
          servidor: 'Lobby',
        },
      ])
    );
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar al carrito' }));
    expect(
      screen.getByRole('form', { name: 'Formulario de inicio de sesión' })
    ).toBeInTheDocument();
  });
});
