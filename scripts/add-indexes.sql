-- Índices para el dashboard de businesses (filtros y ordenamiento)
CREATE INDEX IF NOT EXISTS idx_businesses_city             ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_category         ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_status           ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_website_type     ON businesses(website_type);
CREATE INDEX IF NOT EXISTS idx_businesses_web_scrape_status ON businesses(web_scrape_status);
CREATE INDEX IF NOT EXISTS idx_businesses_contacted        ON businesses(contacted);

-- Índice para usuarios (login)
CREATE INDEX IF NOT EXISTS idx_users_username              ON users(username);

-- Índices para campañas WA
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_user_created   ON wa_campaigns(user_id, created_at DESC);

-- Índices para mensajes WA
CREATE INDEX IF NOT EXISTS idx_wa_messages_user_dir_read   ON wa_messages(user_id, direction, read);
CREATE INDEX IF NOT EXISTS idx_wa_messages_campaign_status ON wa_messages(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_messages_business        ON wa_messages(business_id);
