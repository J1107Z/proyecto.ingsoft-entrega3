import { expect, test } from '@playwright/test';

const uniqueSuffix = () => `${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 90)}`;

test.describe('HU01 & HU02 — Registro, Autenticación y Sesión', () => {
  test('flujo completo: registro de comprador, inicio de sesión, persistencia F5 y logout', async ({
    page,
  }) => {
    const uid = uniqueSuffix();
    const email = `steve_${uid}@minemarket.com`;
    const gamertag = `Steve_${uid}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Registrarse' }).click();

    await page.getByLabel('Nombre').fill('Steve E2E');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill('Diamante123');
    await page.getByLabel('Gamertag de Minecraft').fill(gamertag);
    await page.getByLabel('Tipo de cuenta').selectOption('COMPRADOR');
    await page.getByRole('button', { name: 'Registrarme' }).click();

    await expect(page.getByRole('form', { name: 'Formulario de inicio de sesión' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Cuenta creada con éxito');

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Contraseña').fill('Diamante123');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByTestId('user-chip')).toContainText(`${gamertag} · COMPRADOR`);

    await page.reload();
    await expect(page.getByTestId('user-chip')).toContainText(`${gamertag} · COMPRADOR`);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('form', { name: 'Formulario de inicio de sesión' })).toBeVisible();
  });

  test('negativo HU01: rechaza registro con contraseña débil y gamertag inválido', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Registrarse' }).click();

    await page.getByLabel('Nombre').fill('Bad User');
    await page.getByLabel('Email').fill(`bad_${uniqueSuffix()}@minemarket.com`);
    await page.getByLabel('Contraseña').fill('123');
    await page.getByLabel('Gamertag de Minecraft').fill('ab');
    await page.getByRole('button', { name: 'Registrarme' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('8 caracteres');
    await expect(page.getByRole('form', { name: 'Formulario de registro' })).toBeVisible();
  });

  test('negativo HU02: muestra error al ingresar contraseña incorrecta', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await page.getByLabel('Email').fill('comprador@minemarket.com');
    await page.getByLabel('Contraseña').fill('Incorrecta999');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByRole('alert')).toContainText('Credenciales inválidas');
  });
});
