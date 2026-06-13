// Minimal signed session token (HMAC-SHA256) — works in both Node and Edge
// runtimes via Web Crypto, so it can be verified in proxy.ts middleware.

export const SESSION_COOKIE = 'mn_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days, in seconds

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const bin = atob(str)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET environment variable is not set')
  return secret
}

async function getKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function createSessionToken(phone: string): Promise<string> {
  const payload = JSON.stringify({ phone, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  const payloadB64 = base64url(encoder.encode(payload))
  const key = await getKey(getSecret())
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64))
  return `${payloadB64}.${base64url(new Uint8Array(sig))}`
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const [payloadB64, sigB64] = token.split('.')
  if (!payloadB64 || !sigB64) return false
  try {
    const key = await getKey(getSecret())
    const valid = await crypto.subtle.verify('HMAC', key, base64urlToBytes(sigB64) as BufferSource, encoder.encode(payloadB64))
    if (!valid) return false
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)))
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}
