import { prisma } from '../config/database.js';
import { Database, DatabaseProperty, DatabaseRow, CellValue, PropertyType, PropertyConfig } from '../../../shared/types/index.js';

interface CreateDatabaseInput {
  workspaceId?: string;
  name?: string;
  properties?: Array<{
    name: string;
    type: PropertyType;
    config?: PropertyConfig;
  }>;
}

interface UpdateDatabaseInput {
  name?: string;
}

function parseJsonField<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function parseCellValue(value: string): CellValue | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getAllDatabases(workspaceId?: string): Promise<Database[]> {
  const databases = await prisma.database.findMany({
    where: workspaceId ? { workspaceId } : undefined,
    include: {
      properties: {
        orderBy: { position: 'asc' },
      },
    },
  });

  return databases.map((db) => ({
    id: db.id,
    pageId: db.pageId,
    workspaceId: db.workspaceId || undefined,
    name: db.name,
    createdAt: db.createdAt,
    properties: db.properties.map((p) => ({
      id: p.id,
      databaseId: p.databaseId,
      name: p.name,
      type: p.type as PropertyType,
      config: parseJsonField<PropertyConfig>(p.config, {}),
      position: p.position,
    })),
  }));
}

export async function getDatabaseById(id: string): Promise<Database | null> {
  const db = await prisma.database.findUnique({
    where: { id },
    include: {
      properties: {
        orderBy: { position: 'asc' },
      },
      rows: {
        include: {
          cells: true,
        },
      },
    },
  });

  if (!db) return null;

  return {
    id: db.id,
    pageId: db.pageId,
    workspaceId: db.workspaceId || undefined,
    name: db.name,
    createdAt: db.createdAt,
    properties: db.properties.map((p) => ({
      id: p.id,
      databaseId: p.databaseId,
      name: p.name,
      type: p.type as PropertyType,
      config: parseJsonField<PropertyConfig>(p.config, {}),
      position: p.position,
    })),
    rows: db.rows.map((row) => ({
      id: row.id,
      databaseId: row.databaseId,
      createdById: row.createdById || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      cells: row.cells.map((cell) => ({
        id: cell.id,
        rowId: cell.rowId,
        propertyId: cell.propertyId,
        value: parseCellValue(cell.value) || { type: 'text', text: '' },
      })),
    })),
  };
}

export async function createDatabase(input: CreateDatabaseInput): Promise<Database> {
  const { workspaceId, name, properties } = input;

  // Create the page first
  const page = await prisma.page.create({
    data: {
      workspaceId,
      title: name || 'Database',
      isDatabase: true,
    },
  });

  // Create database
  const db = await prisma.database.create({
    data: {
      pageId: page.id,
      workspaceId,
      name: name || 'Database',
    },
  });

  // Create properties if provided
  if (properties && properties.length > 0) {
    for (let i = 0; i < properties.length; i++) {
      const prop = properties[i];
      await prisma.databaseProperty.create({
        data: {
          databaseId: db.id,
          name: prop.name,
          type: prop.type,
          config: JSON.stringify(prop.config || {}),
          position: i,
        },
      });
    }
  } else {
    // Create default "Name" property
    await prisma.databaseProperty.create({
      data: {
        databaseId: db.id,
        name: 'Name',
        type: 'text',
        config: JSON.stringify({}),
        position: 0,
      },
    });
  }

  // Update page with database ID
  await prisma.page.update({
    where: { id: page.id },
    data: { databaseId: db.id },
  });

  return getDatabaseById(db.id) as Promise<Database>;
}

export async function updateDatabase(id: string, input: UpdateDatabaseInput): Promise<Database> {
  await prisma.database.update({
    where: { id },
    data: {
      name: input.name,
    },
  });

  return getDatabaseById(id) as Promise<Database>;
}

export async function deleteDatabase(id: string): Promise<void> {
  const db = await prisma.database.findUnique({
    where: { id },
  });

  if (db) {
    await prisma.page.delete({
      where: { id: db.pageId },
    });
  }
}

export async function addProperty(
  databaseId: string,
  name: string,
  type: PropertyType,
  config?: PropertyConfig
): Promise<DatabaseProperty> {
  const lastProp = await prisma.databaseProperty.findFirst({
    where: { databaseId },
    orderBy: { position: 'desc' },
  });

  const prop = await prisma.databaseProperty.create({
    data: {
      databaseId,
      name,
      type,
      config: JSON.stringify(config || {}),
      position: (lastProp?.position ?? -1) + 1,
    },
  });

  return {
    id: prop.id,
    databaseId: prop.databaseId,
    name: prop.name,
    type: prop.type as PropertyType,
    config: parseJsonField<PropertyConfig>(prop.config, {}),
    position: prop.position,
  };
}

export async function createRow(
  databaseId: string,
  cells: Array<{ propertyId: string; value: CellValue }>
): Promise<DatabaseRow> {
  const row = await prisma.databaseRow.create({
    data: {
      databaseId,
    },
  });

  // Create cells
  for (const cell of cells) {
    await prisma.databaseCell.create({
      data: {
        rowId: row.id,
        propertyId: cell.propertyId,
        value: JSON.stringify(cell.value),
      },
    });
  }

  // Return the created row with cells
  const rowWithCells = await prisma.databaseRow.findUnique({
    where: { id: row.id },
    include: {
      cells: true,
    },
  });

  return {
    id: rowWithCells!.id,
    databaseId: rowWithCells!.databaseId,
    createdById: rowWithCells!.createdById || undefined,
    createdAt: rowWithCells!.createdAt,
    updatedAt: rowWithCells!.updatedAt,
    cells: rowWithCells!.cells.map((cell) => ({
      id: cell.id,
      rowId: cell.rowId,
      propertyId: cell.propertyId,
      value: parseCellValue(cell.value) || { type: 'text', text: '' },
    })),
  };
}

export async function updateRow(
  rowId: string,
  cells: Array<{ propertyId: string; value: CellValue }>
): Promise<DatabaseRow> {
  // Upsert cells
  for (const cell of cells) {
    await prisma.databaseCell.upsert({
      where: {
        rowId_propertyId: {
          rowId,
          propertyId: cell.propertyId,
        },
      },
      update: {
        value: JSON.stringify(cell.value),
      },
      create: {
        rowId,
        propertyId: cell.propertyId,
        value: JSON.stringify(cell.value),
      },
    });
  }

  const row = await prisma.databaseRow.findUnique({
    where: { id: rowId },
    include: {
      cells: true,
    },
  });

  return {
    id: row!.id,
    databaseId: row!.databaseId,
    createdById: row!.createdById || undefined,
    createdAt: row!.createdAt,
    updatedAt: row!.updatedAt,
    cells: row!.cells.map((cell) => ({
      id: cell.id,
      rowId: cell.rowId,
      propertyId: cell.propertyId,
      value: parseCellValue(cell.value) || { type: 'text', text: '' },
    })),
  };
}

export async function deleteRow(rowId: string): Promise<void> {
  await prisma.databaseRow.delete({
    where: { id: rowId },
  });
}
