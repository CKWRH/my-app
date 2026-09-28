import { AuthSessionDurableObject } from '../../src/worker/auth-session'

describe('AuthSessionDurableObject', () => {
  it('creates, reads, and deletes an opaque session', async () => {
    const storage = new Map<string, unknown>()
    const state = {
      storage: {
        put: async (key: string, value: unknown) => storage.set(key, value),
        get: async <T>(key: string) => storage.get(key) as T | undefined,
        delete: async (key: string) => storage.delete(key),
      },
    }
    const durableObject = new AuthSessionDurableObject(state as DurableObjectState, {} as never)
    const payload = JSON.stringify({ userId: 'u-1', role: 'admin', expiresAt: new Date(Date.now() + 60_000).toISOString() })

    const created = await durableObject.fetch(new Request('https://session', {
      method: 'POST',
      body: payload,
      headers: { 'content-type': 'application/json' },
    }))
    expect(created.status).toBe(200)

    const read = await durableObject.fetch(new Request('https://session'))
    expect(await read.json()).toMatchObject({ userId: 'u-1', role: 'admin' })

    const deleted = await durableObject.fetch(new Request('https://session', { method: 'DELETE' }))
    expect(deleted.status).toBe(200)
    expect((await durableObject.fetch(new Request('https://session'))).status).toBe(401)
  })
})
