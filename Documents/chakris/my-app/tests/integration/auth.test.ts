import app from '../../src/worker/index'

type TestUser = {
  id: string
  email: string
  display_name: string
  role: string
  password_hash: string
}

function createTestEnvironment() {
  const users = new Map<string, TestUser>()
  const sessions = new Map<string, unknown>()
  const sessionStub = {
    fetch: async (request: Request) => {
      if (request.method === 'POST') {
        sessions.set(new URL(request.url).pathname, await request.json())
        return Response.json({ ok: true })
      }
      if (request.method === 'DELETE') {
        sessions.clear()
        return Response.json({ ok: true })
      }
      const value = [...sessions.values()][0]
      return value ? Response.json(value) : Response.json({ error: 'session expired' }, { status: 401 })
    },
  }
  const db = {
    prepare: (sql: string) => {
      let params: unknown[] = []
      return {
        bind: (...values: unknown[]) => {
          params = values
          return {
            first: async <T>() => {
              if (sql.includes('password_hash')) {
                return [...users.values()].find((user) => user.email === params[0]) as T | undefined
              }
              return users.get(params[0] as string) as T | undefined
            },
            run: async () => {
              if (sql.startsWith('INSERT INTO users')) {
                const [id, email, displayName, passwordHash] = params as string[]
                users.set(id, { id, email, display_name: displayName, password_hash: passwordHash, role: 'user', is_active: 1 })
              }
              return { success: true }
            },
          }
        },
      }
    },
  }
  const env = {
    APP_NAME: 'my-app',
    JWT_SECRET: 'test-secret',
    DB: db,
    AUTH_SESSION: {
      idFromName: (name: string) => ({ toString: () => name }),
      get: () => sessionStub,
    },
  }
  return env
}

describe('auth routes', () => {
  it('registers, logs in, reads the current user, and logs out', async () => {
    const env = createTestEnvironment()
    const register = await app.request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'correct horse', displayName: 'Test User' }),
      headers: { 'content-type': 'application/json' },
    }, env as never)
    expect(register.status).toBe(201)

    const login = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'correct horse' }),
      headers: { 'content-type': 'application/json' },
    }, env as never)
    expect(login.status).toBe(200)
    const cookie = login.headers.get('set-cookie')
    expect(cookie).toContain('session=')

    const me = await app.request('http://localhost/api/auth/me', {
      headers: { cookie: cookie ?? '' },
    }, env as never)
    expect(me.status).toBe(200)
    expect((await me.json()).user.email).toBe('user@example.com')

    const logout = await app.request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { cookie: cookie ?? '' },
    }, env as never)
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
