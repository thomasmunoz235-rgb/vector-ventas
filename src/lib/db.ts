import { createClient } from '@libsql/client'

let _db: ReturnType<typeof createClient> | null = null

export function getDb() {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    })
  }
  return _db
}

// Backwards-compat proxy so existing `db.execute(...)` calls keep working
export const db = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
