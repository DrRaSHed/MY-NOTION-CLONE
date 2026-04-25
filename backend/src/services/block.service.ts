import { prisma } from '../config/database.js';
import { Block, Content, BlockProperties } from '../../../shared/types/index.js';

interface CreateBlockInput {
  pageId: string;
  parentId?: string;
  type: string;
  content?: Content;
  properties?: BlockProperties;
  position?: number;
}

interface UpdateBlockInput {
  content?: Content;
  properties?: BlockProperties;
  position?: number;
}

function parseJsonField<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export async function getBlocksByPageId(pageId: string): Promise<Block[]> {
  const blocks = await prisma.block.findMany({
    where: { pageId },
    orderBy: { position: 'asc' },
  });

  return blocks.map((block) => ({
    id: block.id,
    pageId: block.pageId,
    parentId: block.parentId || undefined,
    type: block.type as Block['type'],
    content: parseJsonField<Content>(block.content, { text: '' }),
    properties: parseJsonField<BlockProperties>(block.properties, {}),
    position: block.position,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    children: [],
  }));
}

export async function getBlockTree(pageId: string): Promise<Block[]> {
  const blocks = await getBlocksByPageId(pageId);
  
  // Build tree structure
  const blockMap = new Map<string, Block>();
  const roots: Block[] = [];

  // First pass: index all blocks
  for (const block of blocks) {
    blockMap.set(block.id, { ...block, children: [] });
  }

  // Second pass: build tree
  for (const block of blocks) {
    const blockWithChildren = blockMap.get(block.id)!;
    if (block.parentId) {
      const parent = blockMap.get(block.parentId);
      if (parent) {
        parent.children!.push(blockWithChildren);
      } else {
        roots.push(blockWithChildren);
      }
    } else {
      roots.push(blockWithChildren);
    }
  }

  // Sort children by position
  const sortChildren = (blocks: Block[]) => {
    blocks.sort((a, b) => a.position - b.position);
    for (const block of blocks) {
      if (block.children && block.children.length > 0) {
        sortChildren(block.children);
      }
    }
  };
  sortChildren(roots);

  return roots;
}

export async function createBlock(input: CreateBlockInput): Promise<Block> {
  const { pageId, parentId, type, content, properties, position } = input;

  // Calculate position if not provided
  let blockPosition = position;
  if (blockPosition === undefined) {
    const lastBlock = await prisma.block.findFirst({
      where: { pageId, parentId: parentId || null },
      orderBy: { position: 'desc' },
    });
    blockPosition = (lastBlock?.position ?? -1) + 1;
  }

  const block = await prisma.block.create({
    data: {
      pageId,
      parentId: parentId || null,
      type,
      content: JSON.stringify(content || { text: '' }),
      properties: JSON.stringify(properties || {}),
      position: blockPosition,
    },
  });

  return {
    id: block.id,
    pageId: block.pageId,
    parentId: block.parentId || undefined,
    type: block.type as Block['type'],
    content: parseJsonField<Content>(block.content, { text: '' }),
    properties: parseJsonField<BlockProperties>(block.properties, {}),
    position: block.position,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    children: [],
  };
}

export async function updateBlock(id: string, input: UpdateBlockInput): Promise<Block> {
  const block = await prisma.block.update({
    where: { id },
    data: {
      content: input.content ? JSON.stringify(input.content) : undefined,
      properties: input.properties ? JSON.stringify(input.properties) : undefined,
      position: input.position,
    },
  });

  return {
    id: block.id,
    pageId: block.pageId,
    parentId: block.parentId || undefined,
    type: block.type as Block['type'],
    content: parseJsonField<Content>(block.content, { text: '' }),
    properties: parseJsonField<BlockProperties>(block.properties, {}),
    position: block.position,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    children: [],
  };
}

export async function deleteBlock(id: string): Promise<void> {
  await prisma.block.delete({
    where: { id },
  });
}

export async function reorderBlock(
  id: string,
  newParentId: string | null,
  newPosition: number
): Promise<Block> {
  const block = await prisma.block.update({
    where: { id },
    data: {
      parentId: newParentId,
      position: newPosition,
    },
  });

  return {
    id: block.id,
    pageId: block.pageId,
    parentId: block.parentId || undefined,
    type: block.type as Block['type'],
    content: parseJsonField<Content>(block.content, { text: '' }),
    properties: parseJsonField<BlockProperties>(block.properties, {}),
    position: block.position,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
    children: [],
  };
}
