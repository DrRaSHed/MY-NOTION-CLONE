import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'
import { broadcastEvent } from '../services/websocket'

const router = Router()
const prisma = new PrismaClient()

// ─── GET /blocks?pageId=<id> ──────────────────────────────────────────────────
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { pageId } = req.query
    if (!pageId) return res.status(400).json({ message: 'pageId is required' })

    const blocks = await prisma.block.findMany({
      where: { page_id: String(pageId) },
      orderBy: { position: 'asc' },
    })

    // Build tree in-memory
    const map = new Map(blocks.map(b => [b.id, { ...b, children: [] as any[] }]))
    const roots: any[] = []
    for (const b of blocks) {
      const node = map.get(b.id)!
      if (b.parent_id) map.get(b.parent_id)?.children.push(node)
      else roots.push(node)
    }

    return res.json(roots)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── POST /blocks ─────────────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { page_id, parent_id = null, type = 'paragraph', content = {}, properties = {}, position } = req.body
    if (!page_id) return res.status(400).json({ message: 'page_id is required' })

    // Shift siblings down to make room
    if (position !== undefined) {
      await prisma.block.updateMany({
        where: { page_id, parent_id: parent_id ?? null, position: { gte: position } },
        data: { position: { increment: 1 } },
      })
    }

    const siblingCount = await prisma.block.count({ where: { page_id, parent_id: parent_id ?? null } })

    const block = await prisma.block.create({
      data: {
        page_id,
        parent_id,
        type,
        content,
        properties,
        position: position ?? siblingCount,
      },
    })

    broadcastEvent(page_id, 'block:created', block)
    return res.status(201).json(block)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── PUT /blocks/:id ──────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, properties } = req.body

    const block = await prisma.block.update({
      where: { id: req.params.id },
      data: {
        ...(content    !== undefined && { content }),
        ...(properties !== undefined && { properties }),
        updated_at: new Date(),
      },
    })

    broadcastEvent(block.page_id, 'block:updated', block)
    return res.json(block)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── DELETE /blocks/:id ───────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const block = await prisma.block.findUnique({ where: { id: req.params.id } })
    if (!block) return res.status(404).json({ message: 'Block not found' })

    // Cascade delete children recursively
    await deleteBlockTree(req.params.id)

    broadcastEvent(block.page_id, 'block:deleted', { id: req.params.id, page_id: block.page_id })
    return res.status(204).send()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── POST /blocks/reorder ─────────────────────────────────────────────────────
/**
 * Body: { blockId, newPosition, newParentId, pageId }
 * Moves a block to a new position (and optionally a new parent).
 */
router.post('/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { blockId, newPosition, newParentId = null, pageId } = req.body
    if (!blockId || newPosition === undefined || !pageId) {
      return res.status(400).json({ message: 'blockId, newPosition, and pageId are required' })
    }

    const block = await prisma.block.findUnique({ where: { id: blockId } })
    if (!block) return res.status(404).json({ message: 'Block not found' })

    await prisma.$transaction(async (tx) => {
      const oldParent = block.parent_id
      const oldPos    = block.position

      // 1. Remove from old position — close the gap
      await tx.block.updateMany({
        where: {
          page_id:   pageId,
          parent_id: oldParent,
          position:  { gt: oldPos },
        },
        data: { position: { decrement: 1 } },
      })

      // 2. Open a slot at the new position in the new parent
      await tx.block.updateMany({
        where: {
          page_id:   pageId,
          parent_id: newParentId,
          position:  { gte: newPosition },
        },
        data: { position: { increment: 1 } },
      })

      // 3. Move the block
      await tx.block.update({
        where: { id: blockId },
        data:  { parent_id: newParentId, position: newPosition },
      })
    })

    broadcastEvent(pageId, 'block:reordered', { blockId, newPosition, newParentId })
    return res.json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function deleteBlockTree(blockId: string) {
  const children = await prisma.block.findMany({ where: { parent_id: blockId } })
  for (const child of children) await deleteBlockTree(child.id)
  await prisma.block.delete({ where: { id: blockId } })
}

export default router
