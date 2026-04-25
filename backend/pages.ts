import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// ─── GET /pages ───────────────────────────────────────────────────────────────
// Returns all pages for the authenticated user's workspace as a flat list.
// The client builds the tree from parent_id.

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId

    const workspaceMember = await prisma.workspace.findFirst({
      where: { owner_id: userId },
    })
    if (!workspaceMember) return res.status(404).json({ message: 'Workspace not found' })

    const pages = await prisma.page.findMany({
      where: { workspace_id: workspaceMember.id },
      orderBy: [{ parent_id: 'asc' }, { position: 'asc' }],
    })

    return res.json(pages)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── GET /pages/:id ───────────────────────────────────────────────────────────
// Returns a single page with its full block tree.

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const page = await prisma.page.findUnique({ where: { id } })
    if (!page) return res.status(404).json({ message: 'Page not found' })

    // Fetch all blocks for this page in one query, then build the tree in memory.
    const rawBlocks = await prisma.block.findMany({
      where: { page_id: id },
      orderBy: { position: 'asc' },
    })

    const blockMap = new Map(rawBlocks.map(b => [b.id, { ...b, children: [] as any[] }]))
    const roots: any[] = []

    for (const block of rawBlocks) {
      const node = blockMap.get(block.id)!
      if (block.parent_id) {
        const parent = blockMap.get(block.parent_id)
        if (parent) parent.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return res.json({ ...page, blocks: roots })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── POST /pages ──────────────────────────────────────────────────────────────
// Creates a new page.
// When is_database === true:
//   1. Creates the page with is_database = true
//   2. Creates a Database record linked to that page
//   3. Adds a default "Name" text property
//   4. Updates page.database_id with the new DB id

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId
    const {
      title = 'Untitled',
      parent_id = null,
      workspace_id,
      icon = null,
      is_database = false,
    } = req.body

    if (!workspace_id) {
      return res.status(400).json({ message: 'workspace_id is required' })
    }

    // Compute position (append after siblings)
    const siblingCount = await prisma.page.count({
      where: { workspace_id, parent_id: parent_id ?? null },
    })

    if (!is_database) {
      // ── Plain page ──────────────────────────────────────────────────────────
      const page = await prisma.page.create({
        data: {
          workspace_id,
          parent_id,
          title,
          icon,
          is_database: false,
          position: siblingCount,
          created_by: userId,
        },
      })
      return res.status(201).json(page)
    }

    // ── Database page (transaction) ──────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the page shell (database_id will be patched below)
      const page = await tx.page.create({
        data: {
          workspace_id,
          parent_id,
          title: title === 'Untitled' ? 'Untitled Database' : title,
          icon,
          is_database: true,
          position: siblingCount,
          created_by: userId,
        },
      })

      // 2. Create the database record
      const database = await tx.database.create({
        data: {
          page_id: page.id,
          workspace_id,
          name: page.title,
        },
      })

      // 3. Seed a default "Name" text property
      await tx.databaseProperty.create({
        data: {
          database_id: database.id,
          name: 'Name',
          type: 'text',
          position: 0,
        },
      })

      // 4. Patch page.database_id now that we have the DB id
      const updatedPage = await tx.page.update({
        where: { id: page.id },
        data: { database_id: database.id },
      })

      return updatedPage
    })

    return res.status(201).json(result)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── PUT /pages/:id ───────────────────────────────────────────────────────────

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { title, icon, cover_url } = req.body

    const page = await prisma.page.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(icon !== undefined && { icon }),
        ...(cover_url !== undefined && { cover_url }),
      },
    })

    return res.json(page)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── DELETE /pages/:id ────────────────────────────────────────────────────────
// Cascade deletes blocks + database (handled by Prisma relations / DB constraints).

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    await prisma.page.delete({ where: { id } })
    return res.status(204).send()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
