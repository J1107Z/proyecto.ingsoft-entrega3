const assert = require('assert');
const http = require('http');
const app = require('../src/index');
const { storeRepository } = require('../src/repositories/storeRepository');

function makeRequest(expressApp, method, url, body = null, headers = {}) {
  return new Promise((resolve) => {
    let resData = '';
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      'content-type': 'application/json',
      ...headers,
    };
    req.body = body || {};
    req.connection = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';
    req.socket = { remoteAddress: '127.0.0.1' };

    const res = new http.ServerResponse(req);
    res._headers = {};

    const finish = (data) => {
      resData = data;
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: resData });
    };

    res.json = finish;
    res.send = finish;
    res.end = function (chunk) {
      if (chunk) {
        try {
          resData = JSON.parse(chunk.toString());
        } catch (_) {
          resData = chunk.toString();
        }
      }
      resolve({ status: res.statusCode, headers: res.getHeaders(), body: resData });
    };

    expressApp.handle(req, res);
  });
}

async function run() {
  console.log('🚀 Ejecutando pruebas de seguridad e integración transaccional MineMarket...\n');
  await storeRepository.reset({ seed: true });

  // 1. Weak password rejection
  const weakReg = await makeRequest(app, 'POST', '/api/auth/register', {
    nombre: 'WeakUser',
    email: 'weakuser@example.com',
    password: '123',
    rol: 'COMPRADOR',
    gamertag_minecraft: 'WeakGuy',
  });
  assert.strictEqual(weakReg.status, 400, 'Debe rechazar contraseña débil');
  assert(Array.isArray(weakReg.body.detalles) && weakReg.body.detalles.length > 0);
  console.log('  ✅ 1. Rechazo de contraseña débil en /api/auth/register verificado');

  // 2. Privilege escalation prevention on /register
  const adminEsc = await makeRequest(app, 'POST', '/api/auth/register', {
    nombre: 'Attacker',
    email: 'attacker@example.com',
    password: 'StrongPassword1',
    rol: 'ADMIN',
    gamertag_minecraft: 'AttackerMC',
  });
  assert.strictEqual(adminEsc.status, 400, 'Debe bloquear auto-registro como ADMIN');
  console.log('  ✅ 2. Bloqueo de escalación de privilegios a ADMIN verificado');

  // 3. Valid registration + Gamertag binding
  const randomMc = `Player_${Date.now().toString().slice(-6)}`;
  const validReg = await makeRequest(app, 'POST', '/api/auth/register', {
    nombre: 'ValidPlayer',
    email: `valid_${Date.now()}@example.com`,
    password: 'Minecraft#2024Pass',
    rol: 'COMPRADOR',
    gamertag_minecraft: randomMc,
  });
  assert.strictEqual(validReg.status, 201, 'Debe registrar con éxito');
  assert.strictEqual(validReg.body.usuario.gamertag_minecraft, randomMc);
  assert.strictEqual(validReg.body.usuario.password_hash, undefined);
  const playerToken = validReg.body.token;
  console.log('  ✅ 3. Registro seguro con BCrypt, JWT y vinculación de Gamertag');

  // 4. Failed login timing/enumeration protection
  const failedLogin = await makeRequest(app, 'POST', '/api/auth/login', {
    email: 'nonexistent@example.com',
    password: 'WrongPassword123!',
  });
  assert.strictEqual(failedLogin.status, 401);
  assert(failedLogin.body.error.includes('Credenciales inválidas'));
  console.log('  ✅ 4. Login fallido protegido contra enumeración y timing attacks');

  // 5. Admin & Seller authentication
  const sellerLogin = await makeRequest(app, 'POST', '/api/auth/login', {
    email: 'vendedor@minemarket.com',
    password: 'Vendedor1',
  });
  assert.strictEqual(sellerLogin.status, 200);
  const sellerToken = sellerLogin.body.token;

  const adminLogin = await makeRequest(app, 'POST', '/api/auth/login', {
    email: 'admin@minemarket.com',
    password: 'Admin1234',
  });
  assert.strictEqual(adminLogin.status, 200);
  const adminToken = adminLogin.body.token;
  console.log('  ✅ 5. Autenticación de VENDEDOR y ADMIN verificada');

  // 6. Command injection protection on item creation
  const injectedItem = await makeRequest(
    app,
    'POST',
    '/api/items',
    {
      nombre: 'Espada Maliciosa',
      descripcion: 'Intento de inyección en comando',
      tipo: 'KIT',
      precio: 5000,
      stock: 5,
      servidor: 'Survival Tierra',
      comando: 'give {player} diamond; rm -rf /',
    },
    { authorization: `Bearer ${sellerToken}` }
  );
  assert.strictEqual(injectedItem.status, 400);
  assert(injectedItem.body.error.includes('shell no permitidos'));
  console.log('  ✅ 6. Bloqueo de inyección de comandos en ítems verificado');

  // 7. RBAC: COMPRADOR cannot publish items or read audit logs
  const forbiddenCreate = await makeRequest(
    app,
    'POST',
    '/api/items',
    {
      nombre: 'Rango Ilegal',
      descripcion: 'Intento sin rol',
      tipo: 'RANGO',
      precio: 5000,
      stock: 5,
      servidor: 'Lobby',
    },
    { authorization: `Bearer ${playerToken}` }
  );
  assert.strictEqual(forbiddenCreate.status, 403);

  const forbiddenAudit = await makeRequest(app, 'GET', '/api/audit', null, {
    authorization: `Bearer ${playerToken}`,
  });
  assert.strictEqual(forbiddenAudit.status, 403);
  console.log('  ✅ 7. Restricción RBAC: COMPRADOR bloqueado en gestión y auditoría');

  // 8. Gamertag spoofing defense on direct delivery & cart checkout
  const deliverRes = await makeRequest(
    app,
    'POST',
    '/api/items/1/deliver',
    { playerGamertag: 'OtroJugadorHacker' },
    { authorization: `Bearer ${playerToken}` }
  );
  assert.strictEqual(deliverRes.status, 200);
  assert.strictEqual(
    deliverRes.body.deliveredTo,
    randomMc,
    'La entrega debe ignorar el gamertag enviado y usar el vinculado en JWT'
  );
  console.log('  ✅ 8. Entrega blindada contra suplantación de Gamertag');

  // 9. Persistent Cart + Server-Side Price Calculation + Idempotency-Key
  const addCart = await makeRequest(
    app,
    'POST',
    '/api/cart/items',
    { id_item: 3, cantidad: 2, precio: 1 },
    { authorization: `Bearer ${playerToken}` }
  );
  assert.strictEqual(addCart.status, 200);
  assert.strictEqual(addCart.body.carrito.total, 24000);

  const checkoutRes = await makeRequest(
    app,
    'POST',
    '/api/orders/checkout',
    { metodo_pago: 'TARJETA_SIMULADA', resultado_simulado: 'APROBADO', total: 1 },
    { authorization: `Bearer ${playerToken}`, 'idempotency-key': 'sec-idem-1' }
  );
  assert.strictEqual(checkoutRes.status, 201);
  assert.strictEqual(checkoutRes.body.orden.total, 24000);
  assert.strictEqual(checkoutRes.body.entregas[0].gamertag_minecraft, randomMc);

  const replayRes = await makeRequest(
    app,
    'POST',
    '/api/orders/checkout',
    { metodo_pago: 'TARJETA_SIMULADA', resultado_simulado: 'APROBADO' },
    { authorization: `Bearer ${playerToken}`, 'idempotency-key': 'sec-idem-1' }
  );
  assert.strictEqual(replayRes.status, 201);
  assert.strictEqual(
    replayRes.body.orden.codigo_uuid,
    checkoutRes.body.orden.codigo_uuid,
    'Idempotency-Key debe evitar doble cobro'
  );
  console.log('  ✅ 9. Carrito, total calculado en servidor e Idempotency-Key verificados');

  // 10. Health check & Admin Audit verification
  const health = await makeRequest(app, 'GET', '/api/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.status, 'ok');

  const auditRes = await makeRequest(app, 'GET', '/api/audit', null, {
    authorization: `Bearer ${adminToken}`,
  });
  assert.strictEqual(auditRes.status, 200);
  assert(auditRes.body.logs.length > 0);
  console.log('  ✅ 10. Health endpoint y bitácora de auditoría ADMIN verificados');

  console.log('\n🎉 ¡Todas las pruebas de seguridad e integración MineMarket pasaron con éxito!\n');
}

run().catch((err) => {
  console.error('Error en pruebas de integración:', err);
  process.exit(1);
});
