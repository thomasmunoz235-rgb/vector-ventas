import { createClient } from '@libsql/client/http'

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
