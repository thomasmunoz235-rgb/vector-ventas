# Vector Ventas — Contexto del Proyecto

## Qué es este proyecto

Panel interno de gestión de negocios. Permite visualizar, filtrar, ordenar y editar registros de una tabla `businesses` almacenada en Turso (SQLite en la nube). Acceso protegido por login con usuario único.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** para estilos
- **@libsql/client** para conectarse a Turso
- **@tanstack/react-table v8** para la tabla (filtros, sort, edición)
- Sin librerías de auth externas — sesión simple con cookie httpOnly

## Estructura de archivos

```
src/
├── app/
│   ├── layout.tsx                        ← Root layout, fuente Inter
│   ├── globals.css                       ← Tailwind + scrollbar dark
│   ├── page.tsx                          ← Redirige a /dashboard
│   ├── login/page.tsx                    ← Formulario de login (client component)
│   ├── dashboard/page.tsx                ← Server component, fetch Turso + server action logout
│   └── api/
│       ├── auth/login/route.ts           ← POST: valida credenciales, setea cookie
│       └── businesses/[id]/route.ts      ← PATCH: edita un campo de un registro
├── components/
│   └── BusinessesTable.tsx               ← Client component principal (tabla completa)
├── lib/
│   └── db.ts                             ← createClient de @libsql/client
└── types/
    └── business.ts                       ← Tipo Business con todos los campos

middleware.ts                             ← Protege todas las rutas excepto /login y /api/auth
```

## Base de datos — Tabla `businesses`

Turso (libsql). Schema:

| Columna           | Tipo      | Notas                        |
|-------------------|-----------|------------------------------|
| id                | integer   | Primary Key                  |
| place_id          | text      | Unique                       |
| name              | text      |                              |
| address           | text      |                              |
| phone             | text      |                              |
| website           | text      |                              |
| rating            | real      | 0.0 – 5.0                    |
| total_ratings     | integer   |                              |
| category          | text      |                              |
| city              | text      |                              |
| types             | text      |                              |
| status            | text      |                              |
| website_type      | text      |                              |
| web_scrape_status | text      |                              |
| email             | text      |                              |
| ig_handle         | text      |                              |
| contacted         | integer   | 0 = no contactado, 1 = contactado |
| created_at        | numeric   | Unix timestamp               |
| updated_at        | numeric   | Unix timestamp, se actualiza en cada PATCH |

## Autenticación

- Usuarios en tabla `users` de Turso: `id`, `username`, `password_hash` (PBKDF2+salt), `created_at`
- Login: `POST /api/auth/login` → verifica contra DB → genera token firmado HMAC-SHA256 con expiración → cookie `session`
- Token formato: `base64url(payload)|signature`, payload = `{ u: username, exp: unix }`
- Middleware verifica firma + expiración en cada request → redirige a `/login` si inválido/expirado
- Logout: server action borra cookie
- Sesión dura 7 días
- `SESSION_SECRET` en `.env.local` — string aleatorio de 64 hex chars
- Lógica de token en `src/lib/session.ts`

## Variables de entorno (`.env.local`)

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
ADMIN_USER=...
ADMIN_PASSWORD=...
SESSION_SECRET=...   # string random largo
```

## Funcionalidades de la tabla (`BusinessesTable.tsx`)

- **Búsqueda global**: filtra sobre name, phone, email, website, ig_handle, address
- **Filtros por columna**: dropdowns con valores únicos (faceted) para city, category, status, website_type, web_scrape_status
- **Sort**: click en header → asc/desc/none
- **Edición inline**: doble click en celda → input → Enter guarda / Escape cancela
  - Actualización optimista del estado local
  - PATCH a `/api/businesses/[id]` con `{ column, value }`
  - Revert automático si el API falla
- **Toggle de columnas**: panel dropdown para mostrar/ocultar columnas (por defecto ocultas: place_id, types, created_at, updated_at)
- **Export CSV**: exporta los registros actualmente filtrados como `.csv`
- **Click en fila** → popup con detalles + botón "Marcar como contactado" (toggle)
- **Switch Todos / Sin contactar / Contactados** en barra de filtros (server-side)
- Columnas editables: name, address, phone, website, rating, total_ratings, category, city, types, status, website_type, web_scrape_status, email, ig_handle, contacted
- Columnas no editables: id, place_id, created_at, updated_at

## API routes

### `POST /api/auth/login`
Body: `{ user: string, pass: string }`
Respuesta: `{ ok: true }` + cookie `session`

### `PATCH /api/businesses/[id]`
Body: `{ column: string, value: string }`
- Valida auth por cookie
- Whitelist de columnas editables (previene SQL injection)
- Convierte a número si la columna es `rating` o `total_ratings`
- Actualiza `updated_at` a timestamp actual

## Diseño visual

- Dark theme: fondo negro puro (`#000`)
- Bordes muy sutiles (`zinc-900`)
- Texto: blanco para primario, `zinc-400/500` para secundario, `zinc-700` para vacíos
- Sin colores de acento — minimalista
- Tipografía: Inter (Google Fonts)
- Consistent con el estilo de `vector/index.html` (sitio principal)

## Cómo correr

```bash
cd "vector - ventas"
npm install
npm run dev
# → http://localhost:3000
```

## Pendiente / Próximas features

- Paginación o virtualización para tablas muy grandes (>50k filas)
- Filtro por rango de rating (min/max)
- Crear / eliminar registros
- Múltiples usuarios con roles
- Deploy (Vercel recomendado para Next.js + Turso)
