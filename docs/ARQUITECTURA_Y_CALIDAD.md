# Arquitectura de Software y Escenarios de Calidad — MineMarket

Este documento presenta las **3 vistas arquitectónicas fundamentales** (Contexto, Información y Componentes/Módulos), el cumplimiento de los **Escenarios de Atributos de Calidad SEI**, las **decisiones de diseño (ADRs)** y los principios de **Clean Code & Patrones SOLID** aplicados en MineMarket.

---

## 1. Vista de Contexto (Diagrama de Contexto y Despliegue)

```mermaid
flowchart LR
  Visitor["Visitante / Comprador / Vendedor / Admin\n(Navegador Web)"]
  Frontend["MineMarket SPA\nReact 18 + Vite (:5173)\nVercel Ready"]
  Backend["MineMarket REST API\nExpress + Node.js (:4000)\nRender Ready"]
  DB[("PostgreSQL 3NF\n(o JSON Store ACID Local)")]
  Gateway["Pasarela de Pago Simulada\n(APROBADO / RECHAZADO)"]
  MCQueue["Cola de Entregas In-Game\n(Comandos RCON/Plugin Sanitizados)"]

  Visitor -->|"HTTPS / UI Minecraft"| Frontend
  Frontend -->|"REST JSON + JWT HS256 + Idempotency-Key\n(/api/*)"| Backend
  Backend -->|"Transacciones ACID / SQL Parametrizado"| DB
  Backend -->|"Validación Transaccional"| Gateway
  Backend -->|"Encolado Seguro bound to JWT Gamertag"| MCQueue
```

---

## 2. Vista de Información (Modelo Relacional 3NF y Flujo ACID)

### 2.1 Modelo Entidad-Relación (3NF)

```mermaid
erDiagram
  ROLES ||--o{ USERS : assigns
  USERS ||--|| USER_MINECRAFT_PROFILES : owns
  USERS ||--o{ STORE_ITEMS : sells
  STORE_CATEGORIES ||--o{ STORE_ITEMS : classifies
  USERS ||--o| CARTS : maintains
  CARTS ||--o{ CART_ITEMS : contains
  STORE_ITEMS ||--o{ CART_ITEMS : referenced_by
  USERS ||--o{ ORDERS : places
  ORDERS ||--|{ ORDER_ITEMS : details
  STORE_ITEMS ||--o{ ORDER_ITEMS : snapshot_of
  ORDERS ||--|{ DELIVERY_QUEUE : schedules
  USERS ||--o{ IDEMPOTENCY_KEYS : protects
  AUDIT_ACTION_TYPES ||--o{ AUDIT_LOGS : categorizes
  USERS ||--o{ AUDIT_LOGS : triggers

  USERS {
    int id PK
    string nombre
    string email UK
    string password_hash
    int role_id FK
  }
  USER_MINECRAFT_PROFILES {
    int id PK
    int user_id FK
    string gamertag_minecraft UK
  }
  STORE_ITEMS {
    int id PK
    int category_id FK
    int seller_id FK
    string nombre
    decimal precio
    int stock
    string servidor
    string comando
    boolean activo
  }
  ORDERS {
    int id PK
    string codigo_uuid UK
    int user_id FK
    decimal total
    string estado
    string metodo_pago
  }
  DELIVERY_QUEUE {
    int id PK
    int order_id FK
    string gamertag_minecraft
    string comando_a_ejecutar
    string estado_entrega
  }
```

### 2.2 Flujo Transaccional ACID de Checkout (`POST /api/orders/checkout`)

```mermaid
sequenceDiagram
  autonumber
  actor Buyer as Comprador Autenticado
  participant API as OrderController / OrderService
  participant Repo as StoreRepository (PG o Memory)
  participant Audit as AuditService

  Buyer->>API: POST /api/orders/checkout (JWT + Idempotency-Key)
  API->>Repo: findIdempotencyRecord(userId, key)
  alt Reintento Idempotente
    Repo-->>API: Orden previa almacenada (201)
    API-->>Buyer: 201 OK + X-Idempotent-Replay: true
  else Nueva Transacción
    API->>Repo: runTransaction(BEGIN / Snapshot Clone)
    loop Por cada ítem del carrito
      API->>Repo: findItemById & decrementItemStock(id, qty)
      alt Stock insuficiente o ítem inactivo
        Repo-->>API: false
        API->>Repo: ROLLBACK
        API-->>Buyer: 409 Conflict (Carrito y stock intactos)
      end
    end
    API->>Repo: createOrder(codigo_uuid, serverTotal, PAGADO) + order_items
    API->>Repo: enqueueDelivery(gamertag del JWT, PENDIENTE)
    API->>Repo: clearCart(userId) + saveIdempotencyRecord
    API->>Audit: logAudit(ORDER_CHECKOUT_PAID)
    Repo-->>API: COMMIT
    API-->>Buyer: 201 Created { orden, detalles, entregas }
  end
```

---

## 3. Vista de Componentes y Módulos (Clean Architecture por Capas)

```mermaid
flowchart TB
  subgraph Frontend["Frontend React SPA (src/)"]
    UI["Componentes SRP\nHeader, Catalog, ItemCard, ItemForm,\nCartView, CheckoutModal, OrdersView, AuditLogsView"]
    ApiClient["services/api.js + utils/session.js + utils/format.js"]
    UI --> ApiClient
  end

  subgraph Backend["Backend API REST (backend/src/)"]
    MW["Middleware Seguridad\nHelmet, SecurityHeaders, RateLimiter,\nJWT authenticateToken, RBAC authorize, ErrorHandler"]
    Routes["Routes REST\nauth, items, cart, orders, deliveries, audit"]
    Controllers["Controllers\nauthController, itemController, cartController, orderController"]
    Services["Services (Lógica de Negocio)\nauthService, itemService, cartService, orderService, auditService"]
    Validators["Validators & Utils\nvalidators.js, httpError.js, constants.js"]
    Repo["Repository Adapter\nPgRepository (SQL) | MemoryJsonRepository (JSON)"]
    DB["PostgreSQL Pool / store.json"]

    Routes --> MW --> Controllers --> Services --> Repo --> DB
    Services --> Validators
  end

  ApiClient --> Routes
```

---

## 4. Escenarios de Atributos de Calidad (Modelo SEI de 6 Partes)

| Atributo | Estímulo | Entorno | Respuesta y Medida Verificada |
| :--- | :--- | :--- | :--- |
| **Seguridad e Integridad** (RNF01) | Petición con contraseña débil, auto-asignación de rol `ADMIN`, manipulación de precio/gamertag en checkout o inyección `; rm -rf /` en comando. | Operación normal API REST pública. | Bloqueo inmediato (`400` / `403` / `401`), total calculado exclusivamente en backend, gamertag tomado únicamente desde el claim JWT verificado HS256 (`TTL 2h`), hash BCrypt coste 10 y `DUMMY_BCRYPT_HASH` anti-timing. |
| **Integridad Transaccional** (RNF04) | Checkout concurrente cuando otro usuario agotó el stock de uno de los ítems o reintento de red con la misma `Idempotency-Key`. | Alta concurrencia en carrito/checkout. | `ROLLBACK` atómico (`409`) sin descontar ítems restantes ni vaciar carrito; respuestas idempotentes `X-Idempotent-Replay: true` evitan doble cobro 100% de las veces. |
| **Rendimiento** (RNF02) | 50 usuarios concurrentes consultando `/api/health`, `/api/items` y `/api/cart`. | Carga normal/pico según plan JMeter. | Latencia p95 ≤ 200 ms validada mediante aserciones de duración JMeter y Postman (`responseTime < 200ms`). |
| **Modificabilidad y Portabilidad** | Cambio de almacenamiento local JSON a PostgreSQL 3NF en producción. | Despliegue en Render/Supabase. | Patrón **Repository + Factory (`createStoreRepository`)**: basta configurar `DATABASE_URL` sin modificar controladores, servicios ni UI. |

---

## 5. Patrones de Diseño y Principios SOLID Aplicados

- **Repository + Factory Pattern** (`storeRepository.js`): Abstrae la persistencia intercambiando `MemoryJsonRepository` y `PgRepository` con una interfaz uniforme y transacciones ACID (`runTransaction`).
- **Dependency Injection**: Todos los servicios (`authService`, `itemService`, `cartService`, `orderService`) reciben `repo = storeRepository`, permitiendo pruebas unitarias determinísticas sin acoplarse a disco ni base de datos externa.
- **Chain of Responsibility (Express Middleware)**: `helmet` → `securityHeaders` → `cors` → `apiRateLimiter` → `authenticateToken` → `authorize(...roles)` → `controller` → `errorHandler`.
- **Single Responsibility Principle (SRP)**: Validación (`validators.js`), errores tipados (`HttpError`), reglas de dominio (`services/`), capa HTTP (`controllers/` + `routes/`) y componentes UI están estrictamente desacoplados en funciones pequeñas y cohesivas.
