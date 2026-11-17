import { expect, test } from '@playwright/test';

const uniqueSuffix = () => `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90)}`;

test.describe('HU05 — Catálogo Público, Búsqueda, CRUD Vendedor y RBAC', () => {
  test('visitante explora catálogo público y filtra por tipo y búsqueda sin autenticarse', async ({
    page,
  }) => {
    await page.goto('/');

    const allCards = page.getByTestId('item-card');
    await expect(allCards.first()).toBeVisible();
    const initialCount = await allCards.count();
    expect(initialCount).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole('button', { name: /\+ Publicar ítem/i })).toHaveCount(0);

    await page.getByLabel('Filtrar por tipo').selectOption('LLAVE');
    await expect(page.getByTestId('item-card').first()).toContainText('LLAVE');

    await page.getByLabel('Filtrar por tipo').selectOption('');
    await page.getByLabel('Buscar en catálogo').fill('Diamante');
    await expect(page.getByTestId('item-card').first()).toContainText('Diamante');
  });

  test('negativo RBAC: COMPRADOR no puede ver botones de publicar, editar o eliminar ítems', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.getByLabel('Email').fill('comprador@minemarket.com');
    await page.getByLabel('Contraseña').fill('Comprador1');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByTestId('user-chip')).toContainText('COMPRADOR');
    await expect(page.getByRole('button', { name: '+ Publicar ítem' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);
  });

  test('vendedor crea, edita y elimina su propio ítem sin poder editar ítems ajenos', async ({
    page,
  }) => {
    const uid = uniqueSuffix();
    const sellerEmail = `vend_${uid}@minemarket.com`;
    const sellerTag = `Vend_${uid}`;
    const itemName = `Pico Esmeralda ${uid}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await page.getByLabel('Nombre').fill('Vendedor E2E');
    await page.getByLabel('Email').fill(sellerEmail);
    await page.getByLabel('Contraseña').fill('Diamante123');
    await page.getByLabel('Gamertag de Minecraft').fill(sellerTag);
    await page.getByLabel('Tipo de cuenta').selectOption('VENDEDOR');
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.getByRole('form', { name: 'Formulario de inicio de sesión' })).toBeVisible();

    await page.getByLabel('Email').fill(sellerEmail);
    await page.getByLabel('Contraseña').fill('Diamante123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    // Ítems sembrados de otro vendedor no tienen botón Editar
    const seededCard = page.getByRole('article', { name: 'Rango VIP Diamante' });
    await expect(seededCard).toBeVisible();
    await expect(seededCard.getByRole('button', { name: 'Editar' })).toHaveCount(0);

    // Publicar nuevo ítem
    await page.getByRole('button', { name: '+ Publicar ítem' }).click();
    await page.getByLabel('Nombre del ítem').fill(itemName);
    await page.getByLabel('Descripción').fill('Pico encantado con Fortuna III');
    await page.getByLabel('Tipo', { exact: true }).selectOption('KIT');
    await page.getByLabel('Servidor').fill('Survival Tierra');
    await page.getByLabel('Precio (COP)').fill('14000');
    await page.getByLabel('Stock').fill('12');
    await page.getByRole('button', { name: 'Publicar ítem' }).click();

    await expect(page.getByRole('status')).toContainText('Ítem publicado exitosamente');
    const createdCard = page.getByRole('article', { name: itemName });
    await expect(createdCard).toContainText(/14\.000/);

    // Editar precio
    await createdCard.getByRole('button', { name: 'Editar' }).click();
    await page.getByLabel('Precio (COP)').fill('19500');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByRole('status')).toContainText('Ítem actualizado exitosamente');
    await expect(createdCard).toContainText(/19\.500/);

    // Eliminar con confirmación
    page.once('dialog', (dialog) => dialog.accept());
    await createdCard.getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByRole('status')).toContainText('Ítem eliminado');
    await expect(page.getByRole('article', { name: itemName })).toHaveCount(0);
  });
});
