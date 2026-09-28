export type CloudflareBindings = {
  APP_NAME?: string
  JWT_SECRET?: string
  CACHE?: KVNamespace
  DB?: D1Database
  HYPERDRIVE?: any
  AUTH_SESSION?: DurableObjectNamespace
  REALTIME_ROOM?: DurableObjectNamespace
  ASSETS?: Fetcher
}

export type AppEnv = {
  appName: string
  cache: KVNamespace
  db: D1Database
  hyperdrive: any
  authSession: DurableObjectNamespace
}

export function getServerEnv(env: CloudflareBindings = {}): AppEnv {
  const fallbackEnv: CloudflareBindings = {
    APP_NAME: 'my-app',
    JWT_SECRET: 'development-only-change-me',
    CACHE: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
    } as unknown as KVNamespace,
    DB: {} as D1Database,
    HYPERDRIVE: null,
    AUTH_SESSION: {
      idFromName: (name: string) => ({ toString: () => name }),
      get: () => ({ fetch: async () => Response.json({ ok: true }) }),
    } as unknown as DurableObjectNamespace,
    REALTIME_ROOM: {
      idFromName: (name: string) => ({ toString: () => name }),
      get: () => ({ fetch: async () => Response.json({ ok: true }) }),
    } as unknown as DurableObjectNamespace,
    ASSETS: { fetch: async () => new Response() } as Fetcher,
    ...env,
  }

  return {
    appName: fallbackEnv.APP_NAME ?? 'my-app',
    cache: fallbackEnv.CACHE as KVNamespace,
    db: fallbackEnv.DB as D1Database,
    hyperdrive: fallbackEnv.HYPERDRIVE,
    authSession: fallbackEnv.AUTH_SESSION as DurableObjectNamespace,
  }
}
