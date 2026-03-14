-- Sesiones por vendedor
-- key format: 'creds:{user_id}' | 'keys:{type}:{id}:{user_id}' | 'pending_qr:{user_id}'
CREATE TABLE IF NOT EXISTS wa_auth (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Template de mensaje por vendedor (editable desde CRM)
CREATE TABLE IF NOT EXISTS wa_template (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id),
  body       TEXT NOT NULL DEFAULT 'Hola {nombre}, te contactamos desde Vector-IA.',
  updated_at INTEGER NOT NULL
);

-- Campañas de envío
CREATE TABLE IF NOT EXISTS wa_campaigns (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  name          TEXT NOT NULL DEFAULT 'Sin nombre',
  template_body TEXT NOT NULL,
  total         INTEGER DEFAULT 0,
  sent          INTEGER DEFAULT 0,
  failed        INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'pending', -- pending | running | done | error | paused
  created_at    INTEGER NOT NULL
);

-- Cola de mensajes a enviar + respuestas recibidas
CREATE TABLE IF NOT EXISTS wa_messages (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  business_id   INTEGER REFERENCES businesses(id),
  campaign_id   INTEGER REFERENCES wa_campaigns(id),
  phone         TEXT NOT NULL,
  direction     TEXT NOT NULL,            -- 'out' | 'in'
  body          TEXT NOT NULL,
  wa_message_id TEXT,
  status        TEXT DEFAULT 'pending',   -- pending | sent | failed  (solo direction=out)
  read          INTEGER DEFAULT 0,        -- 0 | 1  (solo direction=in)
  created_at    INTEGER NOT NULL
);
