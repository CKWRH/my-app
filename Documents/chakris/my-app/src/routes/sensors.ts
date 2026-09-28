import { Hono } from 'hono'
import { createSensorReading, listSensorReadings } from '../lib/db'
import type { CloudflareBindings } from '../lib/env'
import { getSessionUser } from '../lib/session-user'

const MAX_HISTORY = 100
const STEPPER_STATUSES = new Set(['stopped', 'moving', 'error'])

export const sensorRoutes = new Hono<{ Bindings: CloudflareBindings }>()

sensorRoutes.get('/readings', async (c) => {
  const user = await getSessionUser(c.env, c.req.raw)
  if (!user) return c.json({ error: 'unauthorized' }, 401)

  const requestedLimit = Number(c.req.query('limit') ?? 50)
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_HISTORY) {
    return c.json({ error: `limit must be between 1 and ${MAX_HISTORY}` }, 400)
  }

  const readings = await listSensorReadings(c.env, requestedLimit)
  return c.json({ readings })
})

sensorRoutes.post('/readings', async (c) => {
  const user = await getSessionUser(c.env, c.req.raw)
  if (!user) return c.json({ error: 'unauthorized' }, 401)

  let input: {
    deviceId?: unknown
    temperatureC?: unknown
    stepperStatus?: unknown
    servoAngle?: unknown
  }
  try {
    input = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (typeof input.temperatureC !== 'number' || !Number.isFinite(input.temperatureC) || input.temperatureC < -40 || input.temperatureC > 125) {
    return c.json({ error: 'temperatureC must be a number between -40 and 125' }, 400)
  }
  if (typeof input.servoAngle !== 'number' || !Number.isFinite(input.servoAngle) || input.servoAngle < 0 || input.servoAngle > 180) {
    return c.json({ error: 'servoAngle must be a number between 0 and 180' }, 400)
  }
  if (typeof input.stepperStatus !== 'string' || !STEPPER_STATUSES.has(input.stepperStatus)) {
    return c.json({ error: 'stepperStatus must be stopped, moving, or error' }, 400)
  }
  if (input.deviceId !== undefined && (typeof input.deviceId !== 'string' || !/^[\w-]{1,64}$/.test(input.deviceId))) {
    return c.json({ error: 'deviceId must contain 1-64 letters, numbers, underscores, or hyphens' }, 400)
  }

  const reading = await createSensorReading(c.env, {
    id: crypto.randomUUID(),
    device_id: (input.deviceId as string | undefined) ?? 'default',
    temperature_c: input.temperatureC,
    stepper_status: input.stepperStatus as 'stopped' | 'moving' | 'error',
    servo_angle: input.servoAngle,
  })
  return c.json({ reading }, 201)
})