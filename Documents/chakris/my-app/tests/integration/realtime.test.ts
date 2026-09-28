import { createJwt } from '../../src/lib/auth'
import app from '../../src/worker/index'

describe('realtime routes', () => {
  it('rejects requests that do not ask for a websocket upgrade', async () => {
    const response = await app.request('http://localhost/api/realtime/general', undefined, {
      REALTIME_ROOM: {} as DurableObjectNamespace,
    } as never)

    expect(response.status).toBe(426)
    expect(await response.json()).toEqual({ error: 'websocket upgrade required' })
  })

  it('forwards authenticated websocket upgrades to the room Durable Object', async () => {
    let forwarded = false
    const secret = 'realtime-test-secret'
    const token = await createJwt({
      sub: 'user-1',
      sid: 'session-1',
      role: 'user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    }, secret)
    const env = {
      JWT_SECRET: secret,
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({ id: 'user-1', email: 'user@example.test', display_name: 'Test User', role: 'user', is_active: 1 }),
          }),
        }),
      },
      AUTH_SESSION: {
        idFromName: () => ({ toString: () => 'session-1' }),
        get: () => ({ fetch: async () => Response.json({ ok: true }) }),
      },
      REALTIME_ROOM: {
        idFromName: () => ({ toString: () => 'general' }),
        get: () => ({
          fetch: async () => {
            forwarded = true
            return new Response('forwarded')
          },
        }),
      },
    }
    const response = await app.request('http://localhost/api/realtime/general', {
      headers: { Upgrade: 'websocket', Cookie: `session=${token}` },
    }, env as never)

    expect(forwarded).toBe(true)
    expect(response.status).toBe(200)
  })
})
