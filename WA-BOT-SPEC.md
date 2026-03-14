# WhatsApp Bot — Especificación

## Qué es

Servicio Node.js independiente que corre en Railway. Maneja sesiones de WhatsApp por vendedor, procesa colas de envío y captura respuestas entrantes. Se comunica con el CRM exclusivamente a través de **Turso** (DB compartida).

---

## Responsabilidades

1. **Auth por vendedor** — genera QR, persiste sesión en Turso, reconecta automáticamente
2. **Tick cada 1 minuto** — procesa todos los vendedores en paralelo:
   - Envía el próximo mensaje pendiente de campañas en estado `running`
   - Captura respuestas entrantes y las guarda en DB
3. **HTTP API** — expuesta para que el CRM pueda pedir QR y consultar estado de sesiones

---

## Comunicación CRM ↔ Bot

```
CRM (Vercel)          Turso DB              Bot (Railway)
     │                    │                      │
     ├── crea campaña ──► │ (status=pending)      │
     │   wa_campaigns     │                      │
     │   wa_messages      │                      │
     │   (pending)        │                      │
     │                    │                      │
     ├── inicia campaña──► │ (status=running)     │
     │                    │ ◄── tick lee cola ───┤
     │                    │   (solo running)     │
     │                    │                      │
     │                    │ ◄── guarda replies ──┤
     │                    │     wa_messages(in)  │
     ├── polling status ──► /api/whatsapp/status  │
     │                    │                      │
     ├── pide QR ─────────────────────────────►  │
     │   GET /qr/:userId  │                      │
     │ ◄──────────── QR image ──────────────────-┤
```

---

## DB Schema (compartido con CRM)

```sql
-- Sesiones por vendedor
-- key format: 'creds:{user_id}' | 'keys:{type}:{id}:{user_id}' | 'pending_qr:{user_id}'
CREATE TABLE wa_auth (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Template de mensaje por vendedor (editable desde CRM)
CREATE TABLE wa_template (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id),
  body       TEXT NOT NULL DEFAULT 'Hola {nombre}, te contactamos desde Vector-IA.',
  updated_at INTEGER NOT NULL
);

-- Campañas de envío
CREATE TABLE wa_campaigns (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL DEFAULT 'Sin nombre',   -- nombre de la campaña
  template_body TEXT NOT NULL,
  total         INTEGER DEFAULT 0,
  sent          INTEGER DEFAULT 0,
  failed        INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending', -- pending | running | done | error | paused
  created_at    INTEGER NOT NULL
);
-- NOTA: la columna `name` fue agregada via ALTER TABLE en Turso (tabla ya existía)
-- ALTER TABLE wa_campaigns ADD COLUMN name TEXT NOT NULL DEFAULT 'Sin nombre';

-- Cola de mensajes a enviar + respuestas recibidas
CREATE TABLE wa_messages (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  business_id   INTEGER REFERENCES businesses(id),
  campaign_id   INTEGER REFERENCES wa_campaigns(id),
  phone         TEXT NOT NULL,
  direction     TEXT NOT NULL,       -- 'out' | 'in'
  body          TEXT NOT NULL,
  wa_message_id TEXT,
  status        TEXT DEFAULT 'pending', -- pending | sent | failed (solo direction=out)
  read          INTEGER DEFAULT 0,      -- 0 | 1 (solo direction=in)
  created_at    INTEGER NOT NULL
);
```

---

## HTTP API del Bot

Base URL: `https://wa-bot.railway.app` (configurable via env `BOT_URL` en el CRM)

Todos los endpoints requieren el header:
```
Authorization: Bearer {BOT_SECRET}
```
`BOT_SECRET` es una variable de entorno compartida entre bot y CRM.

---

### GET /health
Estado general del servicio.

**Response:**
```json
{
  "ok": true,
  "uptime": 3600,
  "activeSessions": 2
}
```

---

### GET /session/:userId
Estado de la sesión de un vendedor específico.

**Response — sin sesión:**
```json
{
  "userId": 1,
  "status": "disconnected"
}
```

**Response — QR pendiente:**
```json
{
  "userId": 1,
  "status": "awaiting_scan",
  "qrExpires": 1710000060
}
```

**Response — conectado:**
```json
{
  "userId": 1,
  "status": "connected",
  "phone": "5491112345678",
  "connectedAt": 1710000000
}
```

---

### POST /session/:userId/connect
Inicia el proceso de conexión para un vendedor. Si no hay sesión guardada, genera QR y lo guarda en Turso (`pending_qr:{userId}`). El CRM lee el QR desde Turso via polling.

**Response — sesión ya existente:**
```json
{ "status": "already_connected" }
```

**Response — QR generado:**
```json
{
  "status": "qr_generated",
  "message": "QR guardado en DB, válido por 60 segundos"
}
```

**Response — error:**
```json
{ "status": "error", "message": "..." }
```

---

### DELETE /session/:userId
Desconecta y borra la sesión de un vendedor. Limpia todas las entradas `creds:{userId}` y `keys:*:{userId}` de `wa_auth`.

**Response:**
```json
{ "ok": true }
```

---

### GET /status/all
Estado de todas las sesiones activas. Usado por el CRM para el dashboard de admin.

**Response:**
```json
{
  "sessions": [
    { "userId": 1, "status": "connected", "phone": "5491112345678" },
    { "userId": 2, "status": "disconnected" }
  ]
}
```

---

## Lógica del tick (cada 1 minuto)

```
tick():
  vendors = SELECT DISTINCT user_id FROM wa_auth WHERE key LIKE 'creds:%'

  Promise.all(vendors.map(vendor => procesarVendor(vendor.user_id)))

procesarVendor(userId):
  1. Cargar auth de Turso para este userId
  2. Conectar a WhatsApp (timeout 15s)
  3. En paralelo:
     a. checkReplies(userId)   → guarda mensajes entrantes nuevos
     b. sendNext(userId)       → envía próximo wa_messages pending de campañas running
  4. Cerrar conexión

checkReplies(userId, sock):
  - Escucha messages.upsert por 5s
  - Filtra: direction=in, no fromMe, no grupos
  - Por cada mensaje nuevo:
      - Busca business por phone (últimos 8 dígitos)
      - INSERT wa_messages (direction=in, read=0)

sendNext(userId, sock):
  *** IMPORTANTE: solo procesa mensajes de campañas con status='running' ***

  - SELECT m.*
    FROM wa_messages m
    JOIN wa_campaigns c ON m.campaign_id = c.id
    WHERE m.user_id = userId
      AND m.direction = 'out'
      AND m.status = 'pending'
      AND c.status = 'running'
    LIMIT 1

  - Si no hay pendientes: no hace nada
  - Si hay:
      - Envía mensaje via WhatsApp
      - UPDATE wa_messages SET status='sent', wa_message_id=?
      - UPDATE businesses SET contacted=1
      - UPDATE wa_campaigns SET sent = sent + 1
      - Si todos los mensajes de la campaña están sent/failed:
          UPDATE wa_campaigns SET status='done'
      - Si falla el envío:
          UPDATE wa_messages SET status='failed'
          UPDATE wa_campaigns SET failed = failed + 1
```

---

## Flujo de vida de una campaña

```
CRM crea campaña          → wa_campaigns.status = 'pending'  (estática, no se envía)
Vendedor pulsa "Enviar"   → POST /api/whatsapp/campaign/:id/start
                          → wa_campaigns.status = 'running'
Bot tick                  → procesa mensajes de campañas 'running'
Todos enviados            → wa_campaigns.status = 'done'
```

---

## Variables de entorno del Bot

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
BOT_SECRET=...          # string random compartido con CRM para auth de la API
PORT=3000               # puerto HTTP
```

---

## Variables de entorno que necesita el CRM

```
BOT_URL=https://wa-bot.railway.app    # URL del bot en Railway
BOT_SECRET=...                         # mismo valor que en el bot
```

---

## Endpoints CRM (Vercel) — implementados

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/whatsapp/status` | GET | Polling: sessionStatus, replies sin leer, última campaña activa |
| `/api/whatsapp/qr` | GET | Lee `pending_qr:{userId}` de Turso, devuelve QR |
| `/api/whatsapp/connect` | POST | Llama a `BOT_URL/session/:userId/connect` |
| `/api/whatsapp/connect` | DELETE | Llama a `DELETE BOT_URL/session/:userId`, limpia pending_qr |
| `/api/whatsapp/template` | GET | Obtiene template del vendedor |
| `/api/whatsapp/template` | PUT | Guarda/actualiza template (UPSERT) |
| `/api/whatsapp/campaign` | POST | Crea campaña + inserta wa_messages (status=pending). Excluye negocios ya en campañas activas. Usa db.batch() para inserción masiva. |
| `/api/whatsapp/campaign` | GET | Lista últimas 20 campañas del vendedor |
| `/api/whatsapp/campaign/:id/start` | POST | Cambia campaign.status de 'pending' a 'running' (disparador manual) |
| `/api/whatsapp/assigned-businesses` | GET | Devuelve `{ [businessId]: campaignName }` para negocios en campañas activas |

## Lo que el CRM hace (sin tocar el bot)

| Acción en CRM | Cómo se implementa |
|---------------|-------------------|
| Crear campaña | INSERT wa_campaigns + batch INSERT wa_messages (status=pending). Campañas quedan estáticas hasta ser enviadas manualmente. |
| Iniciar campaña | POST /api/whatsapp/campaign/:id/start → UPDATE wa_campaigns SET status='running' |
| Ver progreso campaña | SELECT wa_campaigns WHERE user_id = ? |
| Ver negocios en campaña | GET /api/whatsapp/assigned-businesses — badge visible en tabla principal |
| Filtrar negocios en campaña | ?in_campaign=1 en dashboard — JOIN con wa_messages/wa_campaigns |
| Ver respuestas | SELECT wa_messages WHERE direction='in' AND read=0 |
| Marcar respuesta leída | UPDATE wa_messages SET read=1 |
| Conectar WhatsApp | POST {BOT_URL}/session/{userId}/connect → luego polling de pending_qr en Turso |
| Ver QR | SELECT wa_auth WHERE key='pending_qr:{userId}' → mostrar imagen |
| Desconectar | DELETE {BOT_URL}/session/{userId} |
| Badge de alertas | SELECT COUNT(*) FROM wa_messages WHERE direction='in' AND read=0 AND user_id=? |
