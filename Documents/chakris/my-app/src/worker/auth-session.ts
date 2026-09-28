import { DurableObject } from 'cloudflare:workers';
import type { CloudflareBindings } from '../lib/env';

export class AuthSessionDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
  }

  async fetch(request: Request) {
    if (request.method === 'POST') {
      const payload = await request.json<{ userId?: string; role?: string; expiresAt?: string }>()
      await this.ctx.storage.put('session', {
        userId: payload.userId ?? 'anonymous',
        role: payload.role ?? 'user',
        expiresAt: payload.expiresAt ?? new Date(Date.now() + 86_400_000).toISOString(),
      })
      return Response.json({ ok: true })
    }

    if (request.method === 'DELETE') {
      await this.ctx.storage.delete('session')
      return Response.json({ ok: true })
    }

    const session = await this.ctx.storage.get<{ userId: string; role: string; expiresAt: string }>('session')
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.ctx.storage.delete('session')
      return Response.json({ error: 'session expired' }, { status: 401 })
    }
    return Response.json(session)
  }
}
