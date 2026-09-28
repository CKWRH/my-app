const encoder = new TextEncoder()

function toBase64Url(value: ArrayBuffer | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  return atob(normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '='))
}

async function getSigningKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  )
}

export type AuthClaims = {
  sub: string
  sid: string
  role: string
  exp: number
  iat: number
}

export async function createJwt(claims: AuthClaims, secret: string) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify(claims))
  const input = `${header}.${payload}`
  const key = await getSigningKey(secret, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(input))
  return `${input}.${toBase64Url(signature)}`
}

export async function verifyJwt(token: string, secret: string): Promise<AuthClaims | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, payload, encodedSignature] = parts
    const key = await getSigningKey(secret, ['verify'])
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(fromBase64Url(encodedSignature), (char) => char.charCodeAt(0)),
      encoder.encode(`${header}.${payload}`)
    )
    if (!valid) return null

    const claims = JSON.parse(fromBase64Url(payload)) as AuthClaims
    return claims.exp > Math.floor(Date.now() / 1000) ? claims : null
  } catch {
    return null
  }
}

export async function hashPassword(password: string, salt = crypto.randomUUID()) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' },
    key,
    256
  )
  return `pbkdf2$${salt}$${toBase64Url(bits)}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [, salt, expected] = storedHash.split('$')
  if (!salt || !expected) return false
  const actual = await hashPassword(password, salt)
  return actual === `pbkdf2$${salt}$${expected}`
}

export function getCookieValue(request: Request, name: string) {
  const cookies = request.headers.get('cookie')?.split(';') ?? []
  const prefix = `${name}=`
  return cookies.map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix))?.slice(prefix.length) ?? null
}

export function setSessionCookie(token: string) {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
}

export function clearSessionCookie() {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}
