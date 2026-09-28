import { Hono } from 'hono'
import { getServerEnv, type CloudflareBindings } from '../lib/env'
import { adminRoutes } from '../routes/admin'
import { authRoutes } from '../routes/auth'
import { chatRoutes } from '../routes/chat'
import { indexRoute } from '../routes/index'
import { realtimeRoutes } from '../routes/realtime'
import { sensorRoutes } from '../routes/sensors'
import { userRoutes } from '../routes/users'
export { AuthSessionDurableObject } from './auth-session'
export { RealtimeRoomDurableObject } from './realtime-room'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', async (c, next) => {
  c.set('appEnv', getServerEnv(c.env))
  await next()
})

app.route('/', indexRoute)
app.route('/api/auth', authRoutes)
app.route('/api/chat', chatRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/users', userRoutes)
app.route('/api/realtime', realtimeRoutes)
app.route('/api/sensors', sensorRoutes)

export default app
