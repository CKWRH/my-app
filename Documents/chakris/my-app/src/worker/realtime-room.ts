import { DurableObject } from 'cloudflare:workers'
import type { ChatMessageRecord } from '../lib/db'
import type { CloudflareBindings } from '../lib/env'

export class RealtimeRoomDurableObject extends DurableObject<CloudflareBindings> {
  private readonly sockets = new Set<WebSocket>()

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env)
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ error: 'websocket upgrade required' }, { status: 426 })
    }

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const userId = request.headers.get('X-Chat-User-Id')
    const encodedDisplayName = request.headers.get('X-Chat-Display-Name')
    const room = request.headers.get('X-Chat-Room')
    if (!userId || !encodedDisplayName || !room || !this.env.DB) {
      return Response.json({ error: 'chat session unavailable' }, { status: 503 })
    }
    const displayName = decodeURIComponent(encodedDisplayName)

    server.accept()
    this.sockets.add(server)
    server.addEventListener('message', (event) => {
      this.ctx.waitUntil(this.persistAndBroadcast(event.data, room, userId, displayName, server))
    })
    server.addEventListener('close', () => this.sockets.delete(server))
    server.addEventListener('error', () => this.sockets.delete(server))
    server.send(JSON.stringify({ type: 'connected' }))
    return new Response(null, { status: 101, webSocket: client })
  }

  private async persistAndBroadcast(
    data: string | ArrayBuffer,
    room: string,
    userId: string,
    displayName: string,
    sender: WebSocket
  ) {
    try {
      const text = typeof data === 'string' ? data : await new Response(data).text()
      const payload = JSON.parse(text) as { content?: unknown }
      const content = typeof payload.content === 'string' ? payload.content.trim() : ''
      if (!content || content.length > 2000) throw new Error('Message must be between 1 and 2000 characters')

      const message: ChatMessageRecord = {
        id: crypto.randomUUID(),
        room,
        user_id: userId,
        display_name: displayName,
        content,
        created_at: new Date().toISOString(),
      }
      await this.env.DB!.prepare(
        'INSERT INTO chat_messages (id, room, user_id, display_name, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
      ).bind(message.id, room, userId, displayName, content, message.created_at).run()

      const frame = JSON.stringify({ type: 'message', message })
      for (const socket of this.sockets) {
        if (socket.readyState === WebSocket.OPEN) socket.send(frame)
      }
    } catch (error) {
      if (sender.readyState === WebSocket.OPEN) {
        sender.send(JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unable to save message' }))
      }
    }
  }
}
