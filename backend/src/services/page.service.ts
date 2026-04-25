import { prisma } from '../config/database.js';
import { Page } from '../../../shared/types/index.js';

interface CreatePageInput {
  workspaceId?: string;
  parentId?: string;
  title?: string;
  createdById?: string;
}

interface UpdatePageInput {
  title?: string;
  icon?: string;
  coverUrl?: string;
  parentId?: string;
  position?: number;
}

export async function getAllPages(workspaceId?: string): Promise<Page[]> {
  const pages = await prisma.page.findMany({
    where: workspaceId ? { workspaceId } : undefined,
    orderBy: { position: 'asc' },
  });

  return pages.map((page) => ({
    id: page.id,
    workspaceId: page.workspaceId || undefined,
    parentId: page.parentId || undefined,
    title: page.title,
    icon: page.icon || undefined,
    coverUrl: page.coverUrl || undefined,
    isDatabase: page.isDatabase,
    databaseId: page.databaseId || undefined,
    position: page.position,
    createdById: page.createdById || undefined,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  }));
}

export async function getPageTree(workspaceId?: string): Promise<Page[]> {
  const pages = await getAllPages(workspaceId);

  // Build tree structure
  const pageMap = new Map<string, Page>();
  const roots: Page[] = [];

  // First pass: index all pages
  for (const page of pages) {
    pageMap.set(page.id, { ...page, children: [] });
  }

  // Second pass: build tree
  for (const page of pages) {
    const pageWithChildren = pageMap.get(page.id)!;
    if (page.parentId) {
      const parent = pageMap.get(page.parentId);
      if (parent) {
        parent.children!.push(pageWithChildren);
      } else {
        roots.push(pageWithChildren);
      }
    } else {
      roots.push(pageWithChildren);
    }
  }

  // Sort children by position
  const sortChildren = (items: Page[]) => {
    items.sort((a, b) => a.position - b.position);
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        sortChildren(item.children);
      }
    }
  };
  sortChildren(roots);

  return roots;
}

export async function getPageById(id: string): Promise<Page | null> {
  const page = await prisma.page.findUnique({
    where: { id },
  });

  if (!page) return null;

  return {
    id: page.id,
    workspaceId: page.workspaceId || undefined,
    parentId: page.parentId || undefined,
    title: page.title,
    icon: page.icon || undefined,
    coverUrl: page.coverUrl || undefined,
    isDatabase: page.isDatabase,
    databaseId: page.databaseId || undefined,
    position: page.position,
    createdById: page.createdById || undefined,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export async function createPage(input: CreatePageInput): Promise<Page> {
  const { workspaceId, parentId, title, createdById } = input;

  // Calculate position
  const lastPage = await prisma.page.findFirst({
    where: { parentId: parentId || null },
    orderBy: { position: 'desc' },
  });

  const page = await prisma.page.create({
    data: {
      workspaceId,
      parentId: parentId || null,
      title: title || 'Untitled',
      createdById,
      position: (lastPage?.position ?? -1) + 1,
    },
  });

  return {
    id: page.id,
    workspaceId: page.workspaceId || undefined,
    parentId: page.parentId || undefined,
    title: page.title,
    icon: page.icon || undefined,
    coverUrl: page.coverUrl || undefined,
    isDatabase: page.isDatabase,
    databaseId: page.databaseId || undefined,
    position: page.position,
    createdById: page.createdById || undefined,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export async function updatePage(id: string, input: UpdatePageInput): Promise<Page> {
  const page = await prisma.page.update({
    where: { id },
    data: {
      title: input.title,
      icon: input.icon,
      coverUrl: input.coverUrl,
      parentId: input.parentId,
      position: input.position,
    },
  });

  return {
    id: page.id,
    workspaceId: page.workspaceId || undefined,
    parentId: page.parentId || undefined,
    title: page.title,
    icon: page.icon || undefined,
    coverUrl: page.coverUrl || undefined,
    isDatabase: page.isDatabase,
    databaseId: page.databaseId || undefined,
    position: page.position,
    createdById: page.createdById || undefined,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export async function deletePage(id: string): Promise<void> {
  await prisma.page.delete({
    where: { id },
  });
}
