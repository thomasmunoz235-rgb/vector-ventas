// Lightweight signed session token (no external deps, works on Edge runtime)
// Format: base64url(payload)|signature
// Payload: { u: username, id: userId, exp: unix timestamp }

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7 // 7 days

function base64url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return base64url(String.fromCharCode(...new Uint8Array(sig)))
}

export async function createSessionToken(username: string, id: number): Promise<string> {
  const payload = base64url(JSON.stringify({
    u: username,
    id,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  }))
  const secret = process.env.SESSION_SECRET!
  const sig = await hmac(secret, payload)
  return `${payload}|${sig}`
}

export async function verifySessionToken(token: string): Promise<{ username: string; id: number } | null> {
  try {
    const [payload, sig] = token.split('|')
    if (!payload || !sig) return null

    const secret = process.env.SESSION_SECRET!
    const expected = await hmac(secret, payload)

    // Constant-time comparison
    if (expected.length !== sig.length) return null
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
    if (diff !== 0) return null

    const data = JSON.parse(fromBase64url(payload))
    if (Math.floor(Date.now() / 1000) > data.exp) return null
    if (!data.id || typeof data.id !== 'number') return null  // token viejo sin id → re-login

    return { username: data.u, id: data.id }
  } catch {
    return null
  }
}
