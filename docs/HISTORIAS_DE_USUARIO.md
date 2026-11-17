# Historias de Usuario, Criterios Gherkin y Trazabilidad de Pruebas — MineMarket

Este documento formaliza las Historias de Usuario (**HU01–HU06**), sus criterios de aceptación en formato **Gherkin** y su trazabilidad directa hacia las pruebas automatizadas (Unitarias, Integración, Seguridad y End-to-End con Playwright).

---

## Matriz de Trazabilidad HU → Pruebas

| Historia | Requisito Asociado | Pruebas Backend (Jest / Supertest) | Pruebas Frontend (Vitest + RTL) | Pruebas E2E (Playwright) |
| :--- | :--- | :--- | :--- | :--- |
| **HU01** Registro y Gamertag | RF01, RNF01 | `auth.api.test.js`, `authService.test.js`, `validators.test.js`, `security_tests.js` | `authForms.test.jsx`, `api.test.js` | `auth.spec.js` (positivo + negativo) |
| **HU02** Inicio de Sesión JWT & RBAC | RF01, RF02, RNF01 | `auth.api.test.js`, `authMiddleware.test.js`, `integration_auth_security.js` | `authForms.test.jsx`, `sessionAndFormat.test.js`, `catalog.test.jsx` | `auth.spec.js` (login + F5 + error 401), `items.spec.js` (RBAC) |
| **HU03** Carrito Persistente | RF04, RF05 | `cartOrders.api.test.js`, `orderAndRepo.test.js` | `cartOrdersAudit.test.jsx`, `catalog.test.jsx` | `cart-checkout.spec.js` (persistencia logout/login) |
| **HU04** Checkout ACID y Comprobante | RF06, RNF03, RNF04 | `cartOrders.api.test.js`, `orderAndRepo.test.js`, `integration_auth_security.js` | `cartOrdersAudit.test.jsx` (`APROBADO` y `RECHAZADO`) | `cart-checkout.spec.js` (positivo ACID + negativo rechazado) |
| **HU05** Catálogo Público y CRUD Vendedor | RF03 | `items.api.test.js` | `catalog.test.jsx` | `items.spec.js` (filtros visitante, CRUD vendedor, RBAC) |
| **HU06** Despacho In-Game y Auditoría | RF07, RNF01 | `cartOrders.api.test.js`, `integration_auth_security.js` | `cartOrdersAudit.test.jsx` | `cart-checkout.spec.js` (despacho `ENTREGADO` + auditoría ADMIN) |

---

## Detalle de Historias de Usuario y Escenarios Gherkin

### HU01: Registro de Usuario con Gamertag Único y Rol Seguro
> **Como** Visitante, **quiero** crear una cuenta vinculando mi correo, contraseña robusta y Gamertag de Minecraft, **para** operar como Comprador o Vendedor sin exponer credenciales.

- **Escenario 1 (Positivo — Registro y Hash BCrypt)**:
  - **Dado que** ingreso nombre, correo válido único, contraseña ≥ 8 caracteres (con mayúscula, minúscula y dígito) y gamertag `[a-zA-Z0-9_]{3,16}`
  - **Cuando** envío `POST /api/auth/register`
  - **Entonces** el sistema crea el usuario con contraseña cifrada en BCrypt (10 rondas), retorna código `201`, emite JWT y redirige al inicio de sesión sin exponer `password_hash`.
- **Escenario 2 (Negativo — Contraseña débil, Gamertag inválido o Auto-asignación ADMIN)**:
  - **Dado que** envío contraseña corta/sin números, un gamertag menor a 3 caracteres, o `rol: "ADMIN"`
  - **Cuando** envío el formulario de registro
  - **Entonces** el backend rechaza con `400 Bad Request` detallando cada validación fallida y la interfaz muestra una alerta accesible (`role="alert"`).

---

### HU02: Inicio de Sesión JWT, Expiración y Persistencia
> **Como** Comprador, Vendedor o Administrador, **quiero** autenticarme con mis credenciales y mantener la sesión activa durante el TTL permitido, **para** realizar operaciones autorizadas por mi rol.

- **Escenario 1 (Positivo — Login y Recarga F5)**:
  - **Dado que** ingreso correo y contraseña válidos
  - **Cuando** autentico en el formulario
  - **Entonces** obtengo un JWT HS256 (expiración `2h`), visualizo mi chip `gamertag · ROL` y la sesión persiste al recargar el navegador.
- **Escenario 2 (Negativo — Credenciales Inválidas / Anti-timing)**:
  - **Dado que** ingreso una contraseña incorrecta o un correo inexistente
  - **Cuando** envío el formulario
  - **Entonces** el backend responde `401 Credenciales inválidas` protegiendo contra ataques de temporización mediante `DUMMY_BCRYPT_HASH`.

---

### HU03: Carrito de Compras Persistente en Base de Datos / Repositorio
> **Como** Comprador autenticado, **quiero** agregar ítems y ajustar cantidades manteniendo mi carrito persistido entre sesiones, **para** retomar mi compra antes de pagar.

- **Escenario 1 (Positivo — Persistencia entre Logout y Login)**:
  - **Dado que** agrego un ítem al carrito y aumento su cantidad a `2`
  - **Cuando** cierro sesión e inicio sesión nuevamente con la misma cuenta
  - **Entonces** `GET /api/cart` retorna los mismos ítems, cantidad `2` y subtotal recalculado en el servidor.
- **Escenario 2 (Negativo — Exceso de Stock)**:
  - **Dado que** intento agregar más unidades de las disponibles en inventario
  - **Cuando** invoco `POST /api/cart/items`
  - **Entonces** el backend responde `409 Conflict` preservando la integridad del inventario.

---

### HU04: Checkout Transaccional ACID, Pasarela Simulada e Idempotencia
> **Como** Comprador, **quiero** confirmar mi compra con protección transaccional atómica e `Idempotency-Key`, **para** recibir un comprobante UUID o revertir cualquier fallo sin cobros duplicados.

- **Escenario 1 (Positivo — Pago Aprobado ACID)**:
  - **Dado que** tengo ítems disponibles en mi carrito y elijo `APROBADO` en la pasarela simulada
  - **Cuando** confirmo la compra enviando `Idempotency-Key`
  - **Entonces** en una única transacción se descuenta el stock, se crea la orden `PAGADO` con `codigo_uuid`, se encola la entrega en estado `PENDIENTE` vinculada al `gamertag_minecraft` del JWT y se vacía el carrito.
- **Escenario 2 (Negativo — Pago Rechazado / Rollback por Stock Insuficiente)**:
  - **Dado que** selecciono `RECHAZADO` o un ítem se quedó sin stock antes de confirmar
  - **Cuando** confirmo el checkout
  - **Entonces** el sistema retorna `402` o `409`, ejecuta `ROLLBACK` dejando stock y carrito intactos.

---

### HU05: Exploración Pública del Catálogo y CRUD por Vendedor/Admin
> **Como** Visitante o Vendedor, **quiero** explorar y filtrar el catálogo públicamente y gestionar mis propios ítems publicados si soy Vendedor, **para** ofrecer y encontrar productos del servidor.

- **Escenario 1 (Positivo — Búsqueda y CRUD Vendedor)**:
  - **Dado que** visito la tienda sin login o autenticado como Vendedor
  - **Cuando** filtro por tipo (`RANGO`, `KIT`, `LLAVE`, `COSMETICO`, `MONEDA`) o publico/edito/elimino un ítem propio
  - **Entonces** el catálogo refleja los cambios al instante en el listado público.
- **Escenario 2 (Negativo — RBAC de Propietario)**:
  - **Dado que** soy `COMPRADOR` o `VENDEDOR` no propietario de un ítem ajeno
  - **Cuando** intento ver controles o enviar `PUT`/`DELETE` sobre ese ítem
  - **Entonces** la interfaz oculta los controles y la API bloquea con `403 Forbidden`.

---

### HU06: Cola de Entregas In-Game y Auditoría Administrativa
> **Como** Vendedor o Administrador, **quiero** despachar órdenes pendientes a estado `ENTREGADO` y auditar eventos críticos de seguridad y compra, **para** garantizar trazabilidad operativa.

- **Escenario 1 (Positivo — Despacho y Bitácora ADMIN)**:
  - **Dado que** existe una orden pagada con entrega `PENDIENTE`
  - **Cuando** el Administrador o Vendedor propietario ejecuta `PATCH /api/deliveries/:id/dispatch`
  - **Entonces** la entrega pasa a `ENTREGADO` con timestamp `dispatched_at` y la acción queda registrada en `GET /api/audit`.
