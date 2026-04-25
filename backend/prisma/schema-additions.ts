// Add this route to backend/src/routes/databases.ts
// POST /api/v1/databases/:id/rows/reorder
// Body: { order: [{ id: string, position: number }] }

// Paste inside the databases router, before `export default router`:

/*
router.post('/:id/rows/reorder', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { order } = req.body as { order: { id: string; position: number }[] }
    if (!Array.isArray(order)) return res.status(400).json({ message: 'order[] is required' })

    await prisma.$transaction(
      order.map(({ id, position }) =>
        prisma.databaseRow.update({ where: { id }, data: { position } })
      )
    )

    return res.json({ success: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal server error' })
  }
})
*/

// ── Also add `position Int @default(0)` to DatabaseRow in prisma/schema.prisma ──
// Then run: npx prisma migrate dev --name add_row_position

// ── Prisma schema additions needed ────────────────────────────────────────────
export const SCHEMA_ADDITIONS = `
// Add to DatabaseRow model:
//   position Int @default(0)

// Add to Block model (if not present):
//   updated_at DateTime @updatedAt

// DatabaseCell compound unique (required for upsert):
//   @@unique([row_id, property_id])

// Full schema snippet for new models:

model Database {
  id           String             @id @default(cuid())
  page_id      String?            @unique
  workspace_id String
  name         String             @default("Database")
  created_at   DateTime           @default(now())
  page         Page?              @relation(fields: [page_id], references: [id], onDelete: Cascade)
  workspace    Workspace          @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  properties   DatabaseProperty[]
  rows         DatabaseRow[]
}

model DatabaseProperty {
  id          String         @id @default(cuid())
  database_id String
  name        String
  type        String         @default("text")
  config      Json?
  position    Int            @default(0)
  database    Database       @relation(fields: [database_id], references: [id], onDelete: Cascade)
  cells       DatabaseCell[]
}

model DatabaseRow {
  id          String         @id @default(cuid())
  database_id String
  created_by  String?
  position    Int            @default(0)
  created_at  DateTime       @default(now())
  updated_at  DateTime       @updatedAt
  database    Database       @relation(fields: [database_id], references: [id], onDelete: Cascade)
  cells       DatabaseCell[]
}

model DatabaseCell {
  id          String           @id @default(cuid())
  row_id      String
  property_id String
  value       Json             @default("{}")
  row         DatabaseRow      @relation(fields: [row_id], references: [id], onDelete: Cascade)
  property    DatabaseProperty @relation(fields: [property_id], references: [id], onDelete: Cascade)

  @@unique([row_id, property_id])
}

// Add to Page model:
//   is_database Boolean  @default(false)
//   database_id String?
//   database    Database? @relation
`
