import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

/**
 * GET /api/v1/search?q=<query>&limit=<n>
 *
 * Returns pages, databases, and blocks matching the query.
 * SQLite FTS via LIKE — upgrade to FTS5 virtual tables for production scale.
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId  = (req as any).userId
    const q       = String(req.query.q ?? '').trim()
    const limit   = Math.min(parseInt(String(req.query.limit ?? '20')), 50)

    if (!q) return res.json([])

    // Find workspace for this user
    const workspace = await prisma.workspace.findFirst({ where: { owner_id: userId } })
    if (!workspace) return res.json([])

    const wsId  = workspace.id
    const like  = `%${q}%`
    const results: SearchResult[] = []

    // ── Pages ────────────────────────────────────────────────────────────────
    const pages = await prisma.page.findMany({
      where: {
        workspace_id: wsId,
        is_database: false,
        title: { contains: q },
      },
      orderBy: { updated_at: 'desc' },
      take: limit,
    })

    for (const p of pages) {
      results.push({
        id:        p.id,
        type:      'page',
        title:     p.title || 'Untitled',
        icon:      p.icon,
        updatedAt: p.updated_at.toISOString(),
      })
    }

    // ── Databases (via page titles) ───────────────────────────────────────────
    const dbPages = await prisma.page.findMany({
      where: {
        workspace_id: wsId,
        is_database: true,
        title: { contains: q },
      },
      orderBy: { updated_at: 'desc' },
      take: limit,
    })

    for (const p of dbPages) {
      results.push({
        id:        p.id,
        type:      'database',
        title:     p.title || 'Untitled Database',
        icon:      p.icon,
        updatedAt: p.updated_at.toISOString(),
      })
    }

    // ── Blocks ────────────────────────────────────────────────────────────────
    // Raw query because Prisma doesn't support JSON field contains natively on SQLite
    const rawBlocks = await prisma.$queryRawUnsafe<RawBlock[]>(
      `SELECT b.id, b.page_id, b.type, b.content, b.updated_at,
              p.title as page_title, p.icon as page_icon, p.updated_at as page_updated_at
       FROM blocks b
       JOIN pages p ON p.id = b.page_id
       WHERE p.workspace_id = ?
         AND json_extract(b.content, '$.text') LIKE ?
       ORDER BY b.updated_at DESC
       LIMIT ?`,
      wsId,
      like,
      limit
    )

    for (const block of rawBlocks) {
      let contentText = ''
      try {
        const parsed = typeof block.content === 'string' ? JSON.parse(block.content) : block.content
        contentText = parsed?.text ?? ''
      } catch { /* skip */ }

      const excerpt = makeExcerpt(contentText, q)

      results.push({
        id:        block.id,
        type:      'block',
        title:     block.page_title || 'Untitled',
        pageId:    block.page_id,
        pageTitle: block.page_title,
        excerpt,
        icon:      block.page_icon,
        updatedAt: block.updated_at,
      })
    }

    // ── Database cell search ──────────────────────────────────────────────────
    const rawCells = await prisma.$queryRawUnsafe<RawCell[]>(
      `SELECT dc.id, dc.row_id, dc.value,
              p.id as page_id, p.title as page_title, p.icon as page_icon, p.updated_at as page_updated_at
       FROM database_cells dc
       JOIN database_rows dr ON dr.id = dc.row_id
       JOIN databases d       ON d.id  = dr.database_id
       JOIN pages p           ON p.id  = d.page_id
       WHERE d.workspace_id = ?
         AND json_extract(dc.value, '$.text') LIKE ?
       LIMIT ?`,
      wsId,
      like,
      limit
    )

    for (const cell of rawCells) {
      let cellText = ''
      try {
        const parsed = typeof cell.value === 'string' ? JSON.parse(cell.value) : cell.value
        cellText = parsed?.text ?? ''
      } catch { /* skip */ }

      results.push({
        id:        cell.row_id,
        type:      'database',
        title:     cell.page_title || 'Untitled Database',
        pageId:    cell.page_id,
        excerpt:   makeExcerpt(cellText, q),
        icon:      cell.page_icon,
        updatedAt: cell.page_updated_at,
      })
    }

    // ── De-duplicate and rank ─────────────────────────────────────────────────
    const seen = new Set<string>()
    const deduped = results.filter(r => {
      const key = `${r.type}:${r.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Simple ranking: exact title match first, then by recency
    deduped.sort((a, b) => {
      const aExact = a.title.toLowerCase() === q.toLowerCase() ? 1 : 0
      const bExact = b.title.toLowerCase() === q.toLowerCase() ? 1 : 0
      if (aExact !== bExact) return bExact - aExact
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    return res.json(deduped.slice(0, limit))
  } catch (err) {
    console.error('[Search]', err)
    return res.status(500).json({ message: 'Search failed' })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeExcerpt(text: string, query: string, radius = 60): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end   = Math.min(text.length, idx + query.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

// ─── Local types (only used in this file) ─────────────────────────────────────

interface SearchResult {
  id: string
  type: 'page' | 'database' | 'block'
  title: string
  pageId?: string
  pageTitle?: string
  excerpt?: string
  icon?: string | null
  updatedAt: string
}

interface RawBlock {
  id: string
  page_id: string
  type: string
  content: string | object
  updated_at: string
  page_title: string
  page_icon: string | null
  page_updated_at: string
}

interface RawCell {
  id: string
  row_id: string
  value: string | object
  page_id: string
  page_title: string
  page_icon: string | null
  page_updated_at: string
}

export default router
