import { Hono } from 'hono'
import type { CloudflareBindings } from '../lib/env'
import { getSessionUser } from '../lib/session-user'

export const userRoutes = new Hono<{ Bindings: CloudflareBindings }>()

userRoutes.get('/me', async (c) => {
  const user = await getSessionUser(c.env, c.req.raw)
  return user ? c.json({ user }) : c.json({ error: 'unauthorized' }, 401)
})
