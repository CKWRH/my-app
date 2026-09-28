import { getCookieValue, verifyJwt } from './auth'
import { findUserById } from './db'
import type { CloudflareBindings } from './env'

export async function getSessionUser(env: CloudflareBindings, request: Request) {
  const token = getCookieValue(request, 'session')
  const claims = token
    ? await verifyJwt(token, env.JWT_SECRET ?? 'development-only-change-me')
    : null
  if (!claims || !env.AUTH_SESSION) return null

  const session = await env.AUTH_SESSION.get(env.AUTH_SESSION.idFromName(claims.sid))
    .fetch(new Request('https://session/session'))
  if (!session.ok) return null

  const user = await findUserById(env, claims.sub)
  if (!user || user.is_active !== 1) return null
  return user
}