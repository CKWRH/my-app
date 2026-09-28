import { createJwt } from '../../src/lib/auth'
import app from '../../src/worker/index'

describe('sensor reading routes', () => {
  it('requires an active session and validates sensor ranges', async () => {
    const unauthenticated = await app.request('http://localhost/api/sensors/readings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ temperatureC: 22, stepperStatus: 'stopped', servoAngle: 90 }),
    }, {} as never)

    expect(unauthenticated.status).toBe(401)

    const env = createEnvironment()
    const cookie = await sessionCookie()
    const invalid = await app.request('http://localhost/api/sensors/readings', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ temperatureC: 22, stepperStatus: 'stopped', servoAngle: 181 }),
    }, env as never)

    expect(invalid.status).toBe(400)
    expect((await invalid.json()).error).toContain('servoAngle')
  })

  it('records and returns readings from the D1 binding', async () => {
    const env = createEnvironment()
    const cookie = await sessionCookie()
    const created = await app.request('http://localhost/api/sensors/readings', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'bench-01',
        temperatureC: 24.7,
        stepperStatus: 'moving',
        servoAngle: 92,
      }),
    }, env as never)

    expect(created.status).toBe(201)
    expect((await created.json()).reading).toMatchObject({
      device_id: 'bench-01',
      temperature_c: 24.7,
      stepper_status: 'moving',
      servo_angle: 92,
    })

    const history = await app.request('http://localhost/api/sensors/readings?limit=10', {
      headers: { cookie },
    }, env as never)
    expect(history.status).toBe(200)
    expect((await history.json()).readings).toHaveLength(1)
  })
})

function createEnvironment() {
  const readings: Array<Record<string, unknown>> = []
  const secret = 'sensor-test-secret'
  return {
    JWT_SECRET: secret,
    DB: {
      prepare: (sql: string) => {
        let params: unknown[] = []
        const statement = {
          first: async <T>() => {
            if (sql.includes('FROM users WHERE id')) {
              return {
                id: 'sensor-user',
                email: 'sensor@example.test',
                display_name: 'Sensor User',
                role: 'user',
                is_active: 1,
              } as T
            }
            if (sql.includes('FROM sensor_readings WHERE id')) {
              return readings.find((reading) => reading.id === params[0]) as T | undefined
            }
            return undefined
          },
          all: async <T>() => ({ results: readings.slice(-Number(params[0])).reverse() as T[] }),
          run: async () => {
            if (sql.includes('INSERT INTO sensor_readings')) {
              readings.push({
                id: params[0],
                device_id: params[1],
                temperature_c: params[2],
                stepper_status: params[3],
                servo_angle: params[4],
                recorded_at: '2026-09-28T12:00:00.000Z',
              })
            }
            return { success: true }
          },
        }
        return {
          bind: (...values: unknown[]) => {
            params = values
            return statement
          },
        }
      },
    },
    AUTH_SESSION: {
      idFromName: (id: string) => ({ toString: () => id }),
      get: () => ({ fetch: async () => Response.json({ ok: true }) }),
    },
  }
}

async function sessionCookie() {
  const token = await createJwt({
    sub: 'sensor-user',
    sid: 'sensor-session',
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
  }, 'sensor-test-secret')
  return `session=${token}`
}
