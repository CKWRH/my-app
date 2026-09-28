import { Hono } from 'hono'
import { listChatMessages } from '../lib/db'
import type { CloudflareBindings } from '../lib/env'
import { getSessionUser } from '../lib/session-user'

export const chatRoutes = new Hono<{ Bindings: CloudflareBindings }>()

chatRoutes.get('/:room/messages', async (c) => {
  const user = await getSessionUser(c.env, c.req.raw)
  if (!user) return c.json({ error: 'unauthorized' }, 401)

  const room = c.req.param('room')
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(room)) return c.json({ error: 'invalid room' }, 400)
  const messages = await listChatMessages(c.env, room)
  return c.json({ messages })
})