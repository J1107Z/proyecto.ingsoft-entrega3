import { expect, test } from '@playwright/test';

const uniqueSuffix = () => `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90)}`;

async function registerAndLoginBuyer(page) {
  const uid = uniqueSuffix();
  const email = `buyer_${uid}@minemarket.com`;
  const gamertag = `Buyer_${uid}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Registrarse' }).click();
  await page.getByLabel('Nombre').fill('Comprador E2E');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('Diamante123');
  await page.getByLabel('Gamertag de Minecraft').fill(gamertag);
  await page.getByLabel('Tipo de cuenta').selectOption('COMPRADOR');
  await page.getByRole('button', { name: 'Registrarme' }).click();
  await expect(page.getByRole('form', { name: 'Formulario de inicio de sesión' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('Diamante123');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByTestId('user-chip')).toContainText(`${gamertag} · COMPRADOR`);
  return { email, gamertag };
}

test.describe('HU03, HU04 & HU06 — Carrito Persistente, Checkout ACID, Entregas y Auditoría', () => {
  test('HU03: carrito persiste cantidades entre cierre e inicio de sesión', async ({ page }) => {
    const { email } = await registerAndLoginBuyer(page);

    const card = page.getByRole('article', { name: 'Rango VIP Diamante' });
    await card.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(page.getByRole('button', { name: /Mi Carrito \(1\)/ })).toBeVisible();

    await page.getByRole('button', { name: /Mi Carrito/ }).click();
    await page.getByLabel('Aumentar cantidad de Rango VIP Diamante').click();
    await expect(page.getByTestId('cart-total')).toContainText(/50\.000/);

    // Cerrar sesión y volver a entrar: el carrito debe conservar las 2 unidades
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('form', { name: 'Formulario de inicio de sesión' })).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill('Diamante123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByRole('button', { name: /Mi Carrito \(2\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Mi Carrito/ }).click();
    await expect(page.getByTestId('cart-total')).toContainText(/50\.000/);
  });

  test('HU04: checkout APROBADO descuenta stock, genera UUID y encola entrega al gamertag del usuario', async ({
    page,
  }) => {
    const { gamertag } = await registerAndLoginBuyer(page);

    const kitCard = page.getByRole('article', { name: 'Kit Ingeniero Redstone' });
    const stockBadge = await kitCard.textContent();
    const matchBefore = stockBadge.match(/(\d+)\s+disponibles/);
    const stockBefore = Number(matchBefore[1]);

    await kitCard.getByRole('button', { name: 'Agregar al carrito' }).click();
    await page.getByRole('button', { name: /Mi Carrito \(1\)/ }).click();
    await page.getByRole('button', { name: 'Finalizar compra' }).click();

    await page.getByLabel('Método de pago').selectOption('PSE_SIMULADO');
    await page.getByLabel('Resultado simulado').selectOption('APROBADO');
    await page.getByRole('button', { name: 'Confirmar y pagar' }).click();

    const receipt = page.getByTestId('order-receipt');
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText('PAGADO');
    await expect(receipt).toContainText(gamertag);

    await page.getByRole('button', { name: 'Ver mis compras' }).click();
    const orderCard = page.getByTestId('order-card').first();
    await expect(orderCard).toContainText('PENDIENTE');
    await expect(orderCard).toContainText(gamertag);

    await page.getByRole('button', { name: 'Catálogo' }).click();
    await expect(page.getByRole('article', { name: 'Kit Ingeniero Redstone' })).toContainText(
      `${stockBefore - 1} disponibles`
    );
  });

  test('negativo HU04: pago RECHAZADO mantiene carrito intacto y no descuenta stock', async ({
    page,
  }) => {
    await registerAndLoginBuyer(page);

    const keyCard = page.getByRole('article', { name: 'Llave Mítica x3' });
    const stockBeforeText = await keyCard.textContent();
    const stockBefore = Number(stockBeforeText.match(/(\d+)\s+disponibles/)[1]);

    await keyCard.getByRole('button', { name: 'Agregar al carrito' }).click();
    await page.getByRole('button', { name: /Mi Carrito \(1\)/ }).click();
    await page.getByRole('button', { name: 'Finalizar compra' }).click();

    await page.getByLabel('Resultado simulado').selectOption('RECHAZADO');
    await page.getByRole('button', { name: 'Confirmar y pagar' }).click();

    await expect(page.getByRole('alert')).toContainText('Pago rechazado');
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByTestId('cart-item')).toHaveCount(1);

    await page.getByRole('button', { name: 'Catálogo' }).click();
    await expect(page.getByRole('article', { name: 'Llave Mítica x3' })).toContainText(
      `${stockBefore} disponibles`
    );
  });

  test('HU06 Admin: despacha entrega PENDIENTE a ENTREGADO y consulta bitácora de auditoría', async ({
    page,
  }) => {
    // 1. Comprador crea una orden con entrega pendiente
    await registerAndLoginBuyer(page);
    await page
      .getByRole('article', { name: 'Bolsa 10.000 Esmeraldas' })
      .getByRole('button', { name: 'Agregar al carrito' })
      .click();
    await page.getByRole('button', { name: /Mi Carrito \(1\)/ }).click();
    await page.getByRole('button', { name: 'Finalizar compra' }).click();
    await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
    await expect(page.getByTestId('order-receipt')).toBeVisible();
    await page.getByRole('button', { name: 'Ver mis compras' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    // 2. Administrador inicia sesión, despacha entrega y revisa Auditoría
    await page.getByRole('button', { name: 'Demo Admin' }).click();
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByTestId('user-chip')).toContainText('AdminMarket · ADMIN');

    await page.getByRole('button', { name: 'Mis Compras' }).click();
    const dispatchBtn = page.getByRole('button', { name: 'Despachar entrega' }).first();
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();
    await expect(page.getByRole('status')).toContainText('ENTREGADO');

    await page.getByRole('button', { name: 'Auditoría' }).click();
    await expect(page.getByTestId('audit-row').first()).toBeVisible();
    await expect(page.getByTestId('audit-row').first()).toContainText('DELIVERY_DISPATCHED');
  });
});
