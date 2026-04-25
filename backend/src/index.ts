// ═══════════════════════════════════════════════════════════════════════════════
// backend/src/index.ts  —  Main server entry point
// ═══════════════════════════════════════════════════════════════════════════════
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { createWebSocketServer } from './services/websocket'

// Routes
import authRoutes     from './routes/auth'
import pageRoutes     from './routes/pages'
import blockRoutes    from './routes/blocks'
import databaseRoutes from './routes/databases'
import searchRoutes   from './routes/search'

const app  = express()
const http = createServer(app)

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '4mb' }))

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',      authRoutes)
app.use('/api/v1/pages',     pageRoutes)
app.use('/api/v1/blocks',    blockRoutes)
app.use('/api/v1/databases', databaseRoutes)
app.use('/api/v1/search',    searchRoutes)

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

// ── WebSocket server (same HTTP server — no extra port) ───────────────────────
createWebSocketServer(http)

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10)
http.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`)
  console.log(`[ws]     WebSocket on ws://localhost:${PORT}/ws`)
})

export default app
