import { useEffect, useRef, useCallback, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WsEventType =
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

export interface WsMessage {
  type: WsEventType
  roomId: string
  userId?: string
  payload: unknown
  timestamp: number
  clientId: string
}

export interface PresenceMember {
  clientId: string
  userId: string
  displayName: string
  lastSeen: number
  cursorPosition?: { blockId: string; offset: number }
}

type EventHandler = (msg: WsMessage) => void

// ─── Stable client ID (per tab) ───────────────────────────────────────────────

const CLIENT_ID = Math.random().toString(36).slice(2, 10)

// ─── Singleton WS connection (shared across hook instances) ───────────────────

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const globalHandlers = new Map<string, Set<EventHandler>>()  // eventType → handlers

function getWsUrl(): string {
  const token = localStorage.getItem('token') ?? ''
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = import.meta.env.VITE_WS_URL ?? window.location.host
  return `${proto}://${host}/ws?token=${token}&clientId=${CLIENT_ID}`
}

function dispatch(msg: WsMessage) {
  // Fire handlers registered for this specific event type
  globalHandlers.get(msg.type)?.forEach(h => h(msg))
  // Also fire wildcard handlers
  globalHandlers.get('*')?.forEach(h => h(msg))
}

function connectSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  socket = new WebSocket(getWsUrl())

  socket.onopen = () => {
    console.debug('[WS] Connected')
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  socket.onmessage = (event) => {
    try {
      const msg: WsMessage = JSON.parse(event.data)
      dispatch(msg)
    } catch { /* malformed message */ }
  }

  socket.onclose = () => {
    console.debug('[WS] Disconnected — reconnecting in 3s')
    socket = null
    reconnectTimer = setTimeout(connectSocket, 3000)
  }

  socket.onerror = (err) => {
    console.error('[WS] Error', err)
  }
}

function sendMessage(msg: Omit<WsMessage, 'clientId' | 'timestamp'>) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify({ ...msg, clientId: CLIENT_ID, timestamp: Date.now() }))
}

function subscribe(eventType: string, handler: EventHandler): () => void {
  if (!globalHandlers.has(eventType)) globalHandlers.set(eventType, new Set())
  globalHandlers.get(eventType)!.add(handler)
  return () => globalHandlers.get(eventType)?.delete(handler)
}

// ─── Main hook ────────────────────────────────────────────────────────────────

interface UseRealtimeOptions {
  /** The page or database ID this component is viewing */
  roomId: string | null
  /** Handlers keyed by event type */
  on?: Partial<Record<WsEventType, EventHandler>>
  /** Whether to track and expose presence members */
  trackPresence?: boolean
}

export function useRealtime({ roomId, on = {}, trackPresence = false }: UseRealtimeOptions) {
  const [connected, setConnected] = useState(false)
  const [members, setMembers] = useState<PresenceMember[]>([])
  const handlersRef = useRef(on)
  handlersRef.current = on  // always latest

  // ── Connect once ────────────────────────────────────────────────────────────
  useEffect(() => {
    connectSocket()

    const checkInterval = setInterval(() => {
      setConnected(socket?.readyState === WebSocket.OPEN)
    }, 1000)

    return () => clearInterval(checkInterval)
  }, [])

  // ── Join / leave room ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return

    sendMessage({ type: 'presence:join', roomId, payload: {} })

    return () => {
      sendMessage({ type: 'presence:leave', roomId, payload: {} })
    }
  }, [roomId])

  // ── Register event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    const unsubs: (() => void)[] = []

    for (const [eventType, handler] of Object.entries(on)) {
      if (!handler) continue
      unsubs.push(
        subscribe(eventType, (msg) => {
          // Only fire if message is for our room or is a system event
          if (msg.roomId === roomId || msg.roomId === '__system__') {
            handler(msg)
          }
        })
      )
    }

    return () => unsubs.forEach(u => u())
  }, [roomId, JSON.stringify(Object.keys(on))])

  // ── Presence tracking ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!trackPresence || !roomId) return

    const handleJoin = (msg: WsMessage) => {
      const p = msg.payload as any
      if (p.members) {
        // Initial snapshot
        setMembers(p.members)
      } else {
        // Single member joined
        setMembers(prev => {
          if (prev.find(m => m.clientId === p.clientId)) return prev
          return [...prev, p]
        })
      }
    }

    const handleLeave = (msg: WsMessage) => {
      const p = msg.payload as any
      setMembers(prev => prev.filter(m => m.clientId !== p.clientId))
    }

    const handleCursor = (msg: WsMessage) => {
      const p = msg.payload as any
      setMembers(prev =>
        prev.map(m => m.clientId === msg.clientId ? { ...m, cursorPosition: p } : m)
      )
    }

    const u1 = subscribe('presence:join',   handleJoin)
    const u2 = subscribe('presence:leave',  handleLeave)
    const u3 = subscribe('presence:cursor', handleCursor)

    return () => { u1(); u2(); u3() }
  }, [trackPresence, roomId])

  // ── Ping / pong keepalive ───────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (roomId) sendMessage({ type: 'ping', roomId, payload: {} })
    }, 20_000)
    return () => clearInterval(interval)
  }, [roomId])

  // ── Public API ──────────────────────────────────────────────────────────────
  const broadcast = useCallback((type: WsEventType, payload: unknown) => {
    if (!roomId) return
    sendMessage({ type, roomId, payload })
  }, [roomId])

  const sendCursor = useCallback((blockId: string, offset: number) => {
    if (!roomId) return
    sendMessage({ type: 'presence:cursor', roomId, payload: { blockId, offset } })
  }, [roomId])

  return { connected, members, broadcast, sendCursor, clientId: CLIENT_ID }
}

// ─── Lightweight hook for one-off event subscriptions ────────────────────────

export function useWsEvent(eventType: WsEventType, handler: EventHandler, roomId?: string) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    return subscribe(eventType, (msg) => {
      if (!roomId || msg.roomId === roomId) {
        handlerRef.current(msg)
      }
    })
  }, [eventType, roomId])
}
