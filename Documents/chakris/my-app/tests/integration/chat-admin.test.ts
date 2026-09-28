import { createJwt } from '../../src/lib/auth'
import app from '../../src/worker/index'

type TestUser = {
  id: string
  email: string
  display_name: string
  role: string
  is_active: number
  created_at: string
}

function createEnvironment() {
  const users = new Map<string, TestUser>([
    ['admin-1', { id: 'admin-1', email: 'admin@example.test', display_name: 'Admin', role: 'admin', is_active: 1, created_at: '2026-01-01T00:00:00.000Z' }],
    ['user-1', { id: 'user-1', email: 'user@example.test', display_name: 'User', role: 'user', is_active: 1, created_at: '2026-01-02T00:00:00.000Z' }],
  ])
  const messages = [{
    id: 'message-1',
    room: 'general',
    user_id: 'user-1',
    display_name: 'User',
    content: 'Hello from D1',
    created_at: '2026-01-02T10:00:00.000Z',
  }]
  const secret = 'chat-admin-test-secret'
  const env = {
    JWT_SECRET: secret,
    DB: {
      prepare: (sql: string) => {
        let params: unknown[] = []
        const listUsers = () => [...users.values()].map((user) => ({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
        }))
        return {
          all: async <T>() => ({ results: listUsers() as T[] }),
          bind: (...values: unknown[]) => {
            params = values
            return {
              first: async <T>() => users.get(params[0] as string) as T | undefined,
              all: async <T>() => {
                if (sql.includes('FROM chat_messages')) {
                  return { results: messages.filter((message) => message.room === params[0]).slice(-Number(params[1])) as T[] }
                }
                return { results: listUsers() as T[] }
              },
              run: async () => {
                if (sql.includes('UPDATE users SET is_active')) {
                  const user = users.get(params[1] as string)
                  if (!user) return { meta: { changes: 0 } }
                  user.is_active = params[0] as number
                  return { meta: { changes: 1 } }
                }
                return { meta: { changes: 1 } }
              },
            }
          },
        }
      },
    },
    AUTH_SESSION: {
      idFromName: (id: string) => ({ toString: () => id }),
      get: () => ({ fetch: async () => Response.json({ ok: true }) }),
    },
  }

  async function cookieFor(user: TestUser) {
    const token = await createJwt({
      sub: user.id,
      sid: `session-${user.id}`,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
    }, secret)
    return `session=${token}`
  }

  return { env, users, cookieFor }
}

describe('chat and admin routes', () => {
  it('serves persisted chat history to signed-in users and denies admin access', async () => {
    const { env, cookieFor, users } = createEnvironment()
    const userCookie = await cookieFor(users.get('user-1')!)

    const history = await app.request('http://localhost/api/chat/general/messages', {
      headers: { cookie: userCookie },
    }, env as never)
    expect(history.status).toBe(200)
    expect((await history.json()).messages[0].content).toBe('Hello from D1')

    const adminPage = await app.request('http://localhost/api/admin/users', {
      headers: { cookie: userCookie },
    }, env as never)
    expect(adminPage.status).toBe(403)
  })

  it('lets admins manage account status and rejects disabled sessions', async () => {
    const { env, cookieFor, users } = createEnvironment()
    const adminCookie = await cookieFor(users.get('admin-1')!)
    const userCookie = await cookieFor(users.get('user-1')!)

    const list = await app.request('http://localhost/api/admin/users', {
      headers: { cookie: adminCookie },
    }, env as never)
    expect(list.status).toBe(200)
    expect((await list.json()).users).toHaveLength(2)

    const update = await app.request('http://localhost/api/admin/users/user-1/status', {
      method: 'PATCH',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    }, env as never)
    expect(update.status).toBe(200)

    const me = await app.request('http://localhost/api/auth/me', {
      headers: { cookie: userCookie },
    }, env as never)
    expect(me.status).toBe(401)
  })
})
