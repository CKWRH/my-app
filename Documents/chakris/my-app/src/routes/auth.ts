import { Hono } from 'hono'
import {
    clearSessionCookie,
    createJwt,
    getCookieValue,
    hashPassword,
    setSessionCookie,
    verifyJwt,
    verifyPassword,
} from '../lib/auth'
import {
    createAuthSession,
    createUser,
    findUserByEmail,
    revokeAuthSession,
} from '../lib/db'
import type { CloudflareBindings } from '../lib/env'
import { getSessionUser } from '../lib/session-user'

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
export const authRoutes = new Hono<{ Bindings: CloudflareBindings }>()

function jwtSecret(env: CloudflareBindings) {
  return env.JWT_SECRET ?? 'development-only-change-me'
}

function sessionStub(env: CloudflareBindings, sessionId: string) {
  if (!env.AUTH_SESSION) throw new Error('AUTH_SESSION binding is not configured')
  return env.AUTH_SESSION.get(env.AUTH_SESSION.idFromName(sessionId))
}

authRoutes.post('/register', async (c) => {
  const input = await c.req.json<{ email?: string; password?: string; displayName?: string }>()
  if (!input.email || !input.password || !input.displayName) {
    return c.json({ error: 'email, password, and displayName are required' }, 400)
  }

  const existing = await findUserByEmail(c.env, input.email)
  if (existing) return c.json({ error: 'email already registered' }, 409)

  const user = await createUser(c.env, {
    email: input.email,
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
  })
  return c.json({ user }, 201)
})

authRoutes.post('/login', async (c) => {
  const input = await c.req.json<{ email?: string; password?: string }>()
  if (!input.email || !input.password) return c.json({ error: 'email and password are required' }, 400)

  const user = await findUserByEmail(c.env, input.email)
  if (!user || user.is_active !== 1 || !(await verifyPassword(input.password, user.password_hash))) {
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  await createAuthSession(c.env, { id: sessionId, userId: user.id, expiresAt })
  await sessionStub(c.env, sessionId).fetch(new Request('https://session/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: user.id, role: user.role, expiresAt }),
  }))

  const token = await createJwt({
    sub: user.id,
    sid: sessionId,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }, jwtSecret(c.env))
  return c.json({ user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role } }, 200, {
    'Set-Cookie': setSessionCookie(token),
  })
})

authRoutes.post('/logout', async (c) => {
  const token = getCookieValue(c.req.raw, 'session')
  const claims = token ? await verifyJwt(token, jwtSecret(c.env)) : null
  if (claims) {
    await revokeAuthSession(c.env, claims.sid)
    await sessionStub(c.env, claims.sid).fetch(new Request('https://session/session', { method: 'DELETE' }))
  }
  return c.json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
})

authRoutes.get('/me', async (c) => {
  const user = await getSessionUser(c.env, c.req.raw)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  return c.json({ user })
})
