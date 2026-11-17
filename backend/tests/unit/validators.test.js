const {
  sanitizeMinecraftGamertag,
  isValidEmail,
  validatePasswordPolicy,
  sanitizeConsoleCommand,
  timingSafeEqual,
  isSafeAssetUrl,
  normalizeRegistrationRole,
  validateRegisterPayload,
  validateItemPayload,
  validateCartItemPayload,
  validateCheckoutPayload,
} = require('../../src/utils/validators');
const { sanitizePlainText, DUMMY_BCRYPT_HASH } = require('../../src/middleware/security');

describe('validators & security helpers', () => {
  describe('sanitizeMinecraftGamertag', () => {
    it('acepta gamertags válidos entre 3 y 16 caracteres', () => {
      expect(sanitizeMinecraftGamertag('  Steve  ')).toBe('Steve');
      expect(sanitizeMinecraftGamertag('Alex_2024')).toBe('Alex_2024');
    });

    it('rechaza entradas no string o fuera de formato/longitud', () => {
      expect(sanitizeMinecraftGamertag(null)).toBeNull();
      expect(sanitizeMinecraftGamertag('ab')).toBeNull();
      expect(sanitizeMinecraftGamertag('Steve-MC!')).toBeNull();
      expect(sanitizeMinecraftGamertag('a'.repeat(17))).toBeNull();
    });
  });

  describe('isValidEmail', () => {
    it('valida correos bien formados y rechaza valores corruptos', () => {
      expect(isValidEmail('steve@minemarket.com')).toBe(true);
      expect(isValidEmail('no-es-correo')).toBe(false);
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail(`${'a'.repeat(150)}@x.co`)).toBe(false);
    });
  });

  describe('validatePasswordPolicy', () => {
    it('valida longitud, mayúscula, minúscula, dígito y carácter especial opcional', () => {
      expect(validatePasswordPolicy('Diamante123', { requireSpecial: false }).valid).toBe(true);
      expect(validatePasswordPolicy('Minecraft2024', { requireSpecial: true }).valid).toBe(false);
      expect(validatePasswordPolicy('Minecraft2024!', { requireSpecial: true }).valid).toBe(true);
      expect(validatePasswordPolicy('corta1').valid).toBe(false);
      expect(validatePasswordPolicy('A'.repeat(73) + 'a1!').valid).toBe(false);
      expect(validatePasswordPolicy(12345).valid).toBe(false);
    });
  });

  describe('sanitizeConsoleCommand', () => {
    it('limpia slashes iniciales y bloquea operadores shell/control', () => {
      expect(sanitizeConsoleCommand('///give {player} diamond 1')).toEqual({
        isValid: true,
        sanitized: 'give {player} diamond 1',
      });
      expect(sanitizeConsoleCommand('')).toMatchObject({ isValid: false });
      expect(sanitizeConsoleCommand(null)).toMatchObject({ isValid: false });
      expect(sanitizeConsoleCommand('say hola; rm -rf /')).toMatchObject({ isValid: false });
      expect(sanitizeConsoleCommand('say $(whoami)')).toMatchObject({ isValid: false });
      expect(sanitizeConsoleCommand('a'.repeat(251))).toMatchObject({ isValid: false });
    });
  });

  describe('timingSafeEqual y utilidades criptográficas', () => {
    it('compara en tiempo constante y conserva DUMMY_BCRYPT_HASH válido', () => {
      expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
      expect(timingSafeEqual('abc123', 'xyz987')).toBe(false);
      expect(timingSafeEqual('corta', 'mas_larga')).toBe(false);
      expect(timingSafeEqual(123, '123')).toBe(false);
      expect(DUMMY_BCRYPT_HASH.startsWith('$2a$10$')).toBe(true);
    });

    it('sanitiza texto plano y valida URLs seguras de imagen', () => {
      expect(sanitizePlainText('  Hola\x00Mundo\x1f  ')).toBe('HolaMundo');
      expect(sanitizePlainText(123)).toBe('');
      expect(isSafeAssetUrl('')).toBe(true);
      expect(isSafeAssetUrl('https://cdn.example.com/item.png')).toBe(true);
      expect(isSafeAssetUrl('sprite:diamond')).toBe(true);
      expect(isSafeAssetUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeAssetUrl(999)).toBe(false);
    });
  });

  describe('validateRegisterPayload & normalizeRegistrationRole', () => {
    const valido = {
      nombre: 'Steve',
      email: 'steve@minemarket.com',
      password: 'Diamante123',
      gamertag_minecraft: 'Steve_MC',
      rol: 'VENDEDOR',
    };

    it('acepta datos válidos y asigna COMPRADOR si no se envía rol', () => {
      expect(validateRegisterPayload(valido).valid).toBe(true);
      const { rol: _r, ...sinRol } = valido;
      const res = validateRegisterPayload(sinRol);
      expect(res.valid).toBe(true);
      expect(res.data.rol).toBe('COMPRADOR');
    });

    it('normaliza alias CLIENTE -> COMPRADOR y bloquea ADMIN o roles inválidos', () => {
      expect(normalizeRegistrationRole('CLIENTE').role).toBe('COMPRADOR');
      expect(normalizeRegistrationRole('ADMIN').error).toMatch(/ADMIN/);
      expect(normalizeRegistrationRole('SUPERUSER').error).toMatch(/COMPRADOR o VENDEDOR/);
      expect(validateRegisterPayload({})).toMatchObject({ valid: false });
    });
  });

  describe('validateItemPayload, validateCartItemPayload y validateCheckoutPayload', () => {
    const item = {
      nombre: 'Rango MVP',
      descripcion: 'Rango con beneficios globales',
      tipo: 'RANGO',
      precio: 20000,
      stock: 10,
      servidor: 'CraftLand',
      comando: 'lp user {player} parent set mvp',
      imagen_url: 'sprite:diamond',
    };

    it('valida creación y actualización parcial de ítems', () => {
      expect(validateItemPayload(item).valid).toBe(true);
      expect(validateItemPayload({ ...item, tipo: 'ESPADA', precio: -5, stock: 1.5 }).valid).toBe(
        false
      );
      expect(validateItemPayload({ precio: 9999 }, { partial: true }).valid).toBe(true);
      expect(
        validateItemPayload(
          { imagen_url: 'javascript:xss()', comando: 'bad;cmd', servidor: 'x' },
          { partial: true }
        ).errors
      ).toHaveLength(3);
    });

    it('valida payloads de carrito y checkout', () => {
      expect(validateCartItemPayload({ id_item: 1, cantidad: 2 }).valid).toBe(true);
      expect(validateCartItemPayload({ id_item: 0, cantidad: 100 }).errors).toHaveLength(2);
      expect(
        validateCheckoutPayload({ metodo_pago: 'PSE_SIM', resultado_simulado: 'RECHAZADO' }).valid
      ).toBe(true);
      expect(
        validateCheckoutPayload({ metodo_pago: 'x', resultado_simulado: 'MAGICO' }).errors
      ).toHaveLength(2);
    });
  });
});
