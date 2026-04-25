import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Hydrate a database with its properties and rows (with cells). */
async function hydrateDatabase(databaseId: string) {
  const database = await prisma.database.findUnique({
    where: { id: databaseId },
    include: {
      properties: { orderBy: { position: 'asc' } },
      rows: {
        orderBy: { created_at: 'asc' },
        include: { cells: true },
      },
    },
  })

  if (!database) return null

  // Shape rows.cells into a propertyId → CellValue map
  const rows = database.rows.map((row) => ({
    id: row.id,
    database_id: row.database_id,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    cells: Object.fromEntries(
      row.cells.map((cell) => [cell.property_id, cell.value as Record<string, unknown>])
    ),
  }))

  return { ...database, rows }
}

// ─── GET /databases ───────────────────────────────────────────────────────────

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId
    const workspace = await prisma.workspace.findFirst({ where: { owner_id: userId } })
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' })

    const databases = await prisma.database.findMany({
      where: { workspace_id: workspace.id },
      include: { properties: { orderBy: { position: 'asc' } } },
      orderBy: { created_at: 'desc' },
    })

    return res.json(databases)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── GET /databases/:id ───────────────────────────────────────────────────────

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const db = await hydrateDatabase(req.params.id)
    if (!db) return res.status(404).json({ message: 'Database not found' })
    return res.json(db)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── POST /databases ──────────────────────────────────────────────────────────

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId
    const { name = 'Database', workspace_id, page_id, properties = [] } = req.body

    if (!workspace_id) return res.status(400).json({ message: 'workspace_id is required' })

    const database = await prisma.$transaction(async (tx) => {
      const db = await tx.database.create({
        data: { name, workspace_id, page_id },
      })

      if (properties.length > 0) {
        await tx.databaseProperty.createMany({
          data: properties.map((p: any, idx: number) => ({
            database_id: db.id,
            name: p.name,
            type: p.type,
            config: p.config ?? null,
            position: p.position ?? idx,
          })),
        })
      }

      return db
    })

    const hydrated = await hydrateDatabase(database.id)
    return res.status(201).json(hydrated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── PUT /databases/:id ───────────────────────────────────────────────────────

router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name } = req.body
    const db = await prisma.database.update({
      where: { id: req.params.id },
      data: { ...(name && { name }) },
    })
    return res.json(db)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── DELETE /databases/:id ────────────────────────────────────────────────────

router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.database.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTIES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /databases/:id/properties ──────────────────────────────────────────

router.post('/:id/properties', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, type = 'text', config = null, position } = req.body

    if (!name) return res.status(400).json({ message: 'name is required' })

    const count = await prisma.databaseProperty.count({ where: { database_id: req.params.id } })

    const prop = await prisma.databaseProperty.create({
      data: {
        database_id: req.params.id,
        name,
        type,
        config,
        position: position ?? count,
      },
    })

    return res.status(201).json(prop)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── PUT /databases/:id/properties/:propId ────────────────────────────────────

router.put('/:id/properties/:propId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, type, config, position } = req.body

    const prop = await prisma.databaseProperty.update({
      where: { id: req.params.propId },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(config !== undefined && { config }),
        ...(position !== undefined && { position }),
      },
    })

    return res.json(prop)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── DELETE /databases/:id/properties/:propId ─────────────────────────────────

router.delete('/:id/properties/:propId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.databaseProperty.delete({ where: { id: req.params.propId } })
    return res.status(204).send()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ROWS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /databases/:id/rows ──────────────────────────────────────────────────

router.get('/:id/rows', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await prisma.databaseRow.findMany({
      where: { database_id: req.params.id },
      include: { cells: true },
      orderBy: { created_at: 'asc' },
    })

    const shaped = rows.map((row) => ({
      id: row.id,
      database_id: row.database_id,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      cells: Object.fromEntries(row.cells.map((c) => [c.property_id, c.value])),
    }))

    return res.json(shaped)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── POST /databases/:id/rows ─────────────────────────────────────────────────

router.post('/:id/rows', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId
    const { cells = {} } = req.body  // { propertyId: CellValue }

    const row = await prisma.$transaction(async (tx) => {
      const newRow = await tx.databaseRow.create({
        data: {
          database_id: req.params.id,
          created_by: userId,
        },
      })

      // Persist each cell
      const cellEntries = Object.entries(cells) as [string, unknown][]
      if (cellEntries.length > 0) {
        await tx.databaseCell.createMany({
          data: cellEntries.map(([propertyId, value]) => ({
            row_id: newRow.id,
            property_id: propertyId,
            value,
          })),
        })
      }

      return newRow
    })

    // Return shaped row
    const fullRow = await prisma.databaseRow.findUnique({
      where: { id: row.id },
      include: { cells: true },
    })

    const shaped = {
      ...fullRow,
      cells: Object.fromEntries((fullRow?.cells ?? []).map((c) => [c.property_id, c.value])),
    }

    return res.status(201).json(shaped)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── PUT /databases/:id/rows/:rowId ──────────────────────────────────────────
// Upserts cells. Only the provided propertyIds are updated.

router.put('/:id/rows/:rowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rowId } = req.params
    const { cells = {} } = req.body  // { propertyId: CellValue }

    await prisma.$transaction(async (tx) => {
      const entries = Object.entries(cells) as [string, unknown][]
      for (const [propertyId, value] of entries) {
        await tx.databaseCell.upsert({
          where: { row_id_property_id: { row_id: rowId, property_id: propertyId } },
          update: { value },
          create: { row_id: rowId, property_id: propertyId, value },
        })
      }

      await tx.databaseRow.update({
        where: { id: rowId },
        data: { updated_at: new Date() },
      })
    })

    const fullRow = await prisma.databaseRow.findUnique({
      where: { id: rowId },
      include: { cells: true },
    })

    const shaped = {
      ...fullRow,
      cells: Object.fromEntries((fullRow?.cells ?? []).map((c) => [c.property_id, c.value])),
    }

    return res.json(shaped)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

// ─── DELETE /databases/:id/rows/:rowId ───────────────────────────────────────

router.delete('/:id/rows/:rowId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await prisma.databaseRow.delete({ where: { id: req.params.rowId } })
    return res.status(204).send()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})

export default router
