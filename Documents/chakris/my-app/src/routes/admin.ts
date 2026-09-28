import { Hono } from 'hono'
import { listAdminUsers, setUserActiveStatus } from '../lib/db'
import type { CloudflareBindings } from '../lib/env'
import { getSessionUser } from '../lib/session-user'

export const adminRoutes = new Hono<{
  Bindings: CloudflareBindings
  Variables: { adminUserId: string }
}>()

adminRoutes.use('*', async (c, next) => {
  const user = await getSessionUser(c.env, c.req.raw)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  c.set('adminUserId', user.id)
  await next()
})

adminRoutes.get('/users', async (c) => {
  return c.json({ users: await listAdminUsers(c.env) })
})

adminRoutes.patch('/users/:userId/status', async (c) => {
  const input = await c.req.json<{ isActive?: boolean }>()
  if (typeof input.isActive !== 'boolean') {
    return c.json({ error: 'isActive must be a boolean' }, 400)
  }

  const userId = c.req.param('userId')
  if (!input.isActive && userId === c.get('adminUserId')) {
    return c.json({ error: 'cannot deactivate your own account' }, 400)
  }

  const result = await setUserActiveStatus(c.env, userId, input.isActive)
  if (!result.meta.changes) return c.json({ error: 'user not found' }, 404)
  return c.json({ id: userId, is_active: input.isActive ? 1 : 0 })
})