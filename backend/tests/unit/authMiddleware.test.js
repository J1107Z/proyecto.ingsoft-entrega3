const jwt = require('jsonwebtoken');
const config = require('../../src/config');
const { authenticateToken, authorize } = require('../../src/middleware/auth');
const errorHandler = require('../../src/middleware/errorHandler');
const HttpError = require('../../src/utils/httpError');
const authService = require('../../src/services/authService');

function buildMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    removeHeader() {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  return res;
}

describe('middleware authenticateToken & authorize', () => {
  it('adjunta req.user cuando el token Bearer es válido', () => {
    const token = authService.issueToken({
      id_usuario: 3,
      email: 'v@mm.com',
      rol: 'VENDEDOR',
      gamertag_minecraft: 'Vendedor1',
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = buildMockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      id_usuario: 3,
      email: 'v@mm.com',
      rol: 'VENDEDOR',
      gamertag_minecraft: 'Vendedor1',
    });
  });

  it.each([
    ['sin header', undefined],
    ['esquema Basic', 'Basic abc'],
    ['Bearer vacío', 'Bearer'],
  ])('responde 401 %s', (_caso, authorization) => {
    const req = { headers: authorization ? { authorization } : {} };
    const res = buildMockRes();
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('rechaza tokens manipulados o expirados con 401', () => {
    const forged = jwt.sign({ sub: 1 }, 'secreto-invalido');
    const expired = jwt.sign({ sub: 1, exp: Math.floor(Date.now() / 1000) - 30 }, config.jwtSecret);

    [forged, expired, 'no.es.jwt'].forEach((tok) => {
      const res = buildMockRes();
      authenticateToken({ headers: { authorization: `Bearer ${tok}` } }, res, jest.fn());
      expect(res.statusCode).toBe(401);
    });
  });

  it('authorize permite roles autorizados y bloquea 401/403 adecuadamente', () => {
    const mw = authorize('VENDEDOR', 'ADMIN');

    const resUnauth = buildMockRes();
    mw({}, resUnauth, jest.fn());
    expect(resUnauth.statusCode).toBe(401);

    const resForbidden = buildMockRes();
    mw({ user: { id_usuario: 1, rol: 'COMPRADOR' } }, resForbidden, jest.fn());
    expect(resForbidden.statusCode).toBe(403);

    const next = jest.fn();
    mw({ user: { id_usuario: 1, rol: 'VENDEDOR' } }, buildMockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('errorHandler serializa HttpError, SyntaxError JSON y fallos 500 inesperados', () => {
    const res1 = buildMockRes();
    errorHandler(new HttpError(400, 'Dato inválido', ['detalle 1']), {}, res1, jest.fn());
    expect(res1.statusCode).toBe(400);
    expect(res1.body).toEqual({
      error: 'Dato inválido',
      detalles: ['detalle 1'],
      details: ['detalle 1'],
    });

    const res2 = buildMockRes();
    errorHandler({ type: 'entity.parse.failed' }, {}, res2, jest.fn());
    expect(res2.statusCode).toBe(400);

    const res3 = buildMockRes();
    errorHandler(new Error('Falla inesperada'), {}, res3, jest.fn());
    expect(res3.statusCode).toBe(500);
  });
});
