// Types (mirrors shared/types but for frontend use)

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface Page {
  id: string;
  workspaceId?: string;
  parentId?: string;
  title: string;
  icon?: string;
  coverUrl?: string;
  isDatabase: boolean;
  databaseId?: string;
  position: number;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
  children?: Page[];
  blocks?: Block[];
}

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'checkbox'
  | 'toggle'
  | 'code'
  | 'image'
  | 'table'
  | 'divider';

export interface Content {
  text: string;
  marks?: Array<'bold' | 'italic' | 'underline' | 'code' | 'link'>;
  link?: { url: string };
}

export interface BlockProperties {
  level?: 1 | 2 | 3;
  listType?: 'bullet' | 'numbered';
  checked?: boolean;
  expanded?: boolean;
  language?: string;
  url?: string;
  caption?: string;
  columns?: number;
  rows?: number;
}

export interface Block {
  id: string;
  pageId: string;
  parentId?: string;
  type: BlockType;
  content: Content;
  properties: BlockProperties;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  children?: Block[];
}

export interface Database {
  id: string;
  pageId: string;
  workspaceId?: string;
  name: string;
  createdAt: Date;
  properties: DatabaseProperty[];
  rows?: DatabaseRow[];
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'relation'
  | 'checkbox'
  | 'url'
  | 'email';

export interface PropertyConfig {
  options?: Array<{ label: string; color: string }>;
  relationDatabaseId?: string;
  maxLength?: number;
}

export interface DatabaseProperty {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  config: PropertyConfig;
  position: number;
}

export interface DatabaseRow {
  id: string;
  databaseId: string;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
  cells: DatabaseCell[];
}

export interface DatabaseCell {
  id: string;
  rowId: string;
  propertyId: string;
  value: CellValue;
}

export type CellValue =
  | { type: 'text'; text: string }
  | { type: 'number'; number: number }
  | { type: 'date'; date: string }
  | { type: 'select'; select: string }
  | { type: 'multi_select'; multiSelect: string[] }
  | { type: 'relation'; relation: string }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'url'; url: string }
  | { type: 'email'; email: string };

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PageWithBlocks extends Page {
  blocks: Block[];
}

export interface DatabaseWithRows extends Database {
  rows: DatabaseRow[];
}

// Auth types
export interface AuthPayload {
  userId: string;
  email: string;
}

export interface TokenPayload extends AuthPayload {
  iat: number;
  exp: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginResponse {
  user: User;
  token: string;
}
