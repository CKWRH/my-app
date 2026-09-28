import { Hono } from 'hono'
import type { CloudflareBindings } from '../lib/env'
import { getSessionUser } from '../lib/session-user'

export const realtimeRoutes = new Hono<{ Bindings: CloudflareBindings }>()

realtimeRoutes.get('/:room', async (c) => {
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ error: 'websocket upgrade required' }, 426)
  }
  const user = await getSessionUser(c.env, c.req.raw)
  if (!user) return c.json({ error: 'unauthorized' }, 401)
  if (!c.env.REALTIME_ROOM) return c.json({ error: 'REALTIME_ROOM binding is not configured' }, 503)

  const room = c.req.param('room')
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(room)) return c.json({ error: 'invalid room' }, 400)
  const stub = c.env.REALTIME_ROOM.get(c.env.REALTIME_ROOM.idFromName(room))
  const forwardedRequest = new Request(c.req.raw)
  forwardedRequest.headers.set('X-Chat-User-Id', user.id)
  forwardedRequest.headers.set('X-Chat-Display-Name', encodeURIComponent(user.display_name))
  forwardedRequest.headers.set('X-Chat-Room', room)
  return stub.fetch(forwardedRequest)
})
