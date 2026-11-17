# MineMarket — Plataforma Transaccional de Ítems Digitales para Servidores de Minecraft

**MineMarket** es una tienda digital full-stack desacoplada para servidores de Minecraft que permite a visitantes explorar el catálogo en Pesos Colombianos (COP), a compradores gestionar carritos persistentes y realizar compras con **integridad transaccional ACID**, y a vendedores/administradores administrar inventario, despachar entregas in-game y auditar eventos de seguridad.

---

## Arquitectura y Stack Tecnológico

- **Frontend**: React 18 + Vite 5 + Lucide Icons + CSS temático Minecraft (`frontend/`).
- **Backend**: Node.js + Express 4 (`backend/`), arquitectura limpia por capas (`routes → controllers → services → repositories → db`).
- **Persistencia Dual**: PostgreSQL 3NF (`backend/src/db/schema.sql`) cuando se define `DATABASE_URL`, o repositorio transaccional en JSON/Memoria (`MemoryJsonRepository`) con rollback atómico para desarrollo y pruebas reproducibles.
- **Seguridad (OWASP)**: BCrypt (10 rondas), JWT HS256 (TTL `2h`), Helmet + cabeceras defensivas, CORS, Rate Limiting, `timingSafeEqual` + `DUMMY_BCRYPT_HASH` anti-timing, prevención de escalación de privilegios (`ADMIN` bloqueado en registro), bloqueo de inyección en comandos Minecraft y cálculo exclusivo de totales en backend con soporte `Idempotency-Key`.
- **Calidad y Automatización**: ESLint 9, Prettier, SonarQube separado (`backend/sonar-project.properties` y `frontend/sonar-project.properties`), GitHub Actions CI/CD, Jest + Supertest, Vitest + Testing Library, Playwright E2E, Postman/Newman y Apache JMeter.

---

## Requisitos Previos

- **Node.js** `>= 20.x` y **npm** `>= 10.x`
- *(Opcional)* PostgreSQL `>= 14` si deseas usar base de datos externa mediante `DATABASE_URL`
- *(Opcional para E2E en Linux/CI)* `npx --prefix frontend playwright install --with-deps chromium`

---

## Instalación y Arranque Rápido

```bash
# 1. Instalar dependencias en raíz, backend y frontend
npm run install:all

# 2. Iniciar Backend (:4000) y Frontend (:5173) en paralelo
npm run dev
```

- **Frontend Web**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000/api` (Salud: `GET /api/health`)

### Cuentas Semilla de Prueba

| Rol | Email | Contraseña | Gamertag Minecraft |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@minemarket.com` | `Admin1234` | `AdminMarket` |
| **VENDEDOR** | `vendedor@minemarket.com` | `Vendedor1` | `VendedorPro` |
| **COMPRADOR** | `comprador@minemarket.com` | `Comprador1` | `JugadorSteve` |

---

## Scripts Disponibles desde la Raíz

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Levanta simultáneamente Backend (`:4000`) y Frontend (`:5173`). |
| `npm run test` / `npm run tests` | Ejecuta las suites unitarias y de integración de Backend (Jest) y Frontend (Vitest) con reporte de cobertura LCOV. |
| `npm run tests:e2e` | Ejecuta las 10 pruebas End-to-End en Chromium real con Playwright (levanta backend y frontend automáticamente). |
| `npm run test:security` | Ejecuta la suite de seguridad criptográfica, sanitización de comandos e integración transaccional del backend. |
| `npm run lint` | Analiza todo el código fuente y de pruebas con ESLint. |
| `npm run format:check` | Verifica formato consistente con Prettier. |
| `npm run build` | Genera el bundle de producción del frontend en `frontend/dist/`. |

---

## Estructura Principal del Repositorio

```text
Hauntly-main/
├── .github/workflows/ci.yml              # Pipeline CI/CD (Lint, Unit, Security, Build, Playwright E2E, SonarQube)
├── backend/
│   ├── sonar-project.properties          # Configuración SonarQube Backend (minemarket-backend)
│   ├── src/
│   │   ├── app.js / index.js             # App Express y arranque HTTP
│   │   ├── config/index.js               # Variables de entorno y TTL JWT
│   │   ├── controllers/                  # Controladores HTTP delgados
│   │   ├── db/                           # Pool PostgreSQL + schema.sql (3NF)
│   │   ├── middleware/                   # Auth JWT/RBAC, Security Headers, RateLimit, ErrorHandler
│   │   ├── repositories/                 # Dual Repository: PgRepository + MemoryJsonRepository
│   │   ├── routes/                       # Endpoints REST (/auth, /items, /cart, /orders, /deliveries, /audit)
│   │   ├── services/                     # Lógica de dominio, ACID checkout, idempotencia y auditoría
│   │   └── utils/                        # Constantes, HttpError y validadores sanitizados
│   └── tests/                            # Jest (unit/, integration/) + security_tests.js + integration_auth_security.js
├── frontend/
│   ├── playwright.config.js              # Configuración E2E multi-servidor
│   ├── sonar-project.properties          # Configuración SonarQube Frontend (minemarket-frontend)
│   ├── e2e/                              # Specs Playwright (auth.spec.js, items.spec.js, cart-checkout.spec.js)
│   ├── src/                              # App.jsx, componentes SRP, services/api.js, utils/, styles/minecraft.css
│   └── tests/                            # Vitest + Testing Library (unit/)
├── tests/
│   ├── postman/                          # Colección y ambiente Postman/Newman con aserciones automatizadas
│   └── jmeter/minemarket_load_test.jmx   # Plan de carga JMeter (50 usuarios concurrentes, SLA p95 <= 200ms)
└── docs/
    ├── ARQUITECTURA_Y_CALIDAD.md         # Vistas de Contexto, Información y Componentes + Escenarios SEI
    ├── HISTORIAS_DE_USUARIO.md           # HU01–HU06, criterios Gherkin y matriz de trazabilidad
    └── database_schema_3nf.md            # Documentación del modelo relacional 3NF
```

---

## Pruebas Adicionales (Postman / JMeter / SonarQube)

- **Postman / Newman**: Importa [`tests/postman/MineMarket.postman_collection.json`](tests/postman/MineMarket.postman_collection.json) junto a [`tests/postman/MineMarket.postman_environment.json`](tests/postman/MineMarket.postman_environment.json), o ejecuta con el backend corriendo:
  ```bash
  npx newman run tests/postman/MineMarket.postman_collection.json -e tests/postman/MineMarket.postman_environment.json
  ```
- **Apache JMeter**: Abre [`tests/jmeter/minemarket_load_test.jmx`](tests/jmeter/minemarket_load_test.jmx) o ejecuta en modo no-GUI:
  ```bash
  jmeter -n -t tests/jmeter/minemarket_load_test.jmx -l results.jtl
  ```
- **SonarQube**: Cada módulo cuenta con su propio `sonar-project.properties` y reporte `coverage/lcov.info` en `backend/` (`minemarket-backend`) y `frontend/` (`minemarket-frontend`).

---

## Documentación Técnica Completa

- [Vistas de Arquitectura, Calidad SEI y Patrones](docs/ARQUITECTURA_Y_CALIDAD.md)
- [Historias de Usuario HU01–HU06 y Trazabilidad](docs/HISTORIAS_DE_USUARIO.md)
- [Esquema Relacional 3NF](docs/database_schema_3nf.md)
