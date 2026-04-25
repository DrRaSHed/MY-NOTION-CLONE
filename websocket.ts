import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'
import { Server } from 'http'
import jwt from 'jsonwebtoken'
import { parse as parseUrl } from 'url'

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType =
  | 'page:updated'
  | 'block:created'
  | 'block:updated'
  | 'block:deleted'
  | 'block:reordered'
  | 'db:row:created'
  | 'db:row:updated'
  | 'db:row:deleted'
  | 'presence:join'
  | 'presence:leave'
  | 'presence:cursor'
  | 'ping'
  | 'pong'
  | 'error'

interface WsMessage {
  type: EventType
  roomId: string       // pageId or databaseId
  userId?: string
  payload: unknown
  timestamp: number
  clientId: string     // UUID per browser tab, for echo-suppression
}

interface ConnectedClient {
  ws: WebSocket
  userId: string
  displayName: string
  rooms: Set<string>
  lastSeen: number
  clientId: string
}

// ─── State ────────────────────────────────────────────────────────────────────

const clients = new Map<string, ConnectedClient>()         // clientId → client
const rooms   = new Map<string, Set<string>>()             // roomId → Set<clientId>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoomClients(roomId: string): ConnectedClient[] {
  const ids = rooms.get(roomId) ?? new Set()
  return [...ids].map(id => clients.get(id)).filter(Boolean) as ConnectedClient[]
}

function joinRoom(clientId: string, roomId: string) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  rooms.get(roomId)!.add(clientId)
  const client = clients.get(clientId)
  if (client) client.rooms.add(roomId)
}

function leaveRoom(clientId: string, roomId: string) {
  rooms.get(roomId)?.delete(clientId)
  if (rooms.get(roomId)?.size === 0) rooms.delete(roomId)
  clients.get(clientId)?.rooms.delete(roomId)
}

function leaveAllRooms(clientId: string) {
  const client = clients.get(clientId)
  if (!client) return
  for (const roomId of client.rooms) {
    leaveRoom(clientId, roomId)
    broadcastToRoom(roomId, {
      type: 'presence:leave',
      roomId,
      userId: client.userId,
      payload: { clientId, userId: client.userId, displayName: client.displayName },
      timestamp: Date.now(),
      clientId,
    }, clientId) // broadcast to everyone else
  }
}

function send(client: ConnectedClient, msg: WsMessage) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg))
  }
}

/**
 * Broadcast a message to all clients in a room.
 * @param exceptClientId - if provided, skip that sender (echo suppression)
 */
function broadcastToRoom(roomId: string, msg: WsMessage, exceptClientId?: string) {
  for (const client of getRoomClients(roomId)) {
    if (exceptClientId && client.clientId === exceptClientId) continue
    send(client, msg)
  }
}

function presenceSnapshot(roomId: string) {
  return getRoomClients(roomId).map(c => ({
    clientId: c.clientId,
    userId: c.userId,
    displayName: c.displayName,
    lastSeen: c.lastSeen,
  }))
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function parseToken(req: IncomingMessage): { userId: string; displayName: string } | null {
  try {
    const { query } = parseUrl(req.url ?? '', true)
    const token = query.token as string
    if (!token) return null
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'secret') as any
    return { userId: payload.userId ?? payload.id, displayName: payload.displayName ?? 'Anonymous' }
  } catch {
    return null
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

function handleMessage(clientId: string, raw: string) {
  let msg: WsMessage
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }

  const client = clients.get(clientId)
  if (!client) return
  client.lastSeen = Date.now()

  switch (msg.type) {
    case 'ping':
      send(client, { ...msg, type: 'pong' })
      return

    case 'presence:join': {
      joinRoom(clientId, msg.roomId)
      // Send existing presence to the joiner
      send(client, {
        type: 'presence:join',
        roomId: msg.roomId,
        userId: client.userId,
        payload: { members: presenceSnapshot(msg.roomId) },
        timestamp: Date.now(),
        clientId,
      })
      // Announce arrival to others
      broadcastToRoom(msg.roomId, {
        type: 'presence:join',
        roomId: msg.roomId,
        userId: client.userId,
        payload: { clientId, userId: client.userId, displayName: client.displayName },
        timestamp: Date.now(),
        clientId,
      }, clientId)
      return
    }

    case 'presence:leave': {
      leaveRoom(clientId, msg.roomId)
      broadcastToRoom(msg.roomId, {
        ...msg,
        payload: { clientId, userId: client.userId, displayName: client.displayName },
        timestamp: Date.now(),
      })
      return
    }

    case 'presence:cursor':
      // Cursor move — broadcast only to the same room, not back to sender
      broadcastToRoom(msg.roomId, { ...msg, userId: client.userId, timestamp: Date.now() }, clientId)
      return

    // All content events: broadcast to room, skip sender
    case 'page:updated':
    case 'block:created':
    case 'block:updated':
    case 'block:deleted':
    case 'block:reordered':
    case 'db:row:created':
    case 'db:row:updated':
    case 'db:row:deleted':
      broadcastToRoom(msg.roomId, { ...msg, userId: client.userId, timestamp: Date.now() }, clientId)
      return

    default:
      break
  }
}

// ─── Server factory ───────────────────────────────────────────────────────────

export function createWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const auth = parseToken(req)
    if (!auth) {
      ws.close(4001, 'Unauthorized')
      return
    }

    const { query } = parseUrl(req.url ?? '', true)
    const clientId = (query.clientId as string) ?? Math.random().toString(36).slice(2)

    const client: ConnectedClient = {
      ws,
      userId: auth.userId,
      displayName: auth.displayName,
      rooms: new Set(),
      lastSeen: Date.now(),
      clientId,
    }
    clients.set(clientId, client)

    ws.on('message', (data) => handleMessage(clientId, data.toString()))

    ws.on('close', () => {
      leaveAllRooms(clientId)
      clients.delete(clientId)
    })

    ws.on('error', (err) => {
      console.error(`[WS] Client ${clientId} error:`, err.message)
    })

    // Confirm connection
    send(client, {
      type: 'presence:join',
      roomId: '__system__',
      userId: auth.userId,
      payload: { connected: true, clientId },
      timestamp: Date.now(),
      clientId,
    })
  })

  // Heartbeat — drop stale connections every 30s
  setInterval(() => {
    const now = Date.now()
    for (const [id, client] of clients) {
      if (now - client.lastSeen > 60_000) {
        client.ws.terminate()
        leaveAllRooms(id)
        clients.delete(id)
      }
    }
  }, 30_000)

  console.log('[WS] WebSocket server running on /ws')
  return wss
}

// ─── Export broadcast utility (usable from REST routes) ───────────────────────

export function broadcastEvent(roomId: string, type: EventType, payload: unknown, sourceClientId?: string) {
  const msg: WsMessage = {
    type,
    roomId,
    payload,
    timestamp: Date.now(),
    clientId: sourceClientId ?? '__server__',
  }
  broadcastToRoom(roomId, msg, sourceClientId)
}
