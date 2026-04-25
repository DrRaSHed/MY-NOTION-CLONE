// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  owner_id: string
  created_at: string
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export interface Page {
  id: string
  workspace_id: string
  parent_id: string | null
  title: string
  icon: string | null
  cover_url: string | null
  /** true when this page IS the database view */
  is_database: boolean
  /** populated only when is_database === true */
  database_id: string | null
  position: number
  created_by: string
  created_at: string
  updated_at: string
  /** hydrated by the backend for tree rendering */
  children?: Page[]
}

export interface CreatePageInput {
  title?: string
  parent_id?: string | null
  workspace_id: string
  icon?: string
  /** when true the backend also creates a Database record */
  is_database?: boolean
}

export interface UpdatePageInput {
  title?: string
  icon?: string
  cover_url?: string
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'checkbox'
  | 'toggle'
  | 'code'
  | 'image'
  | 'table'
  | 'divider'
  | 'quote'

export interface TextMark {
  type: 'bold' | 'italic' | 'underline' | 'code' | 'link'
  href?: string
}

export interface BlockContent {
  text: string
  marks?: TextMark[]
}

export interface BlockProperties {
  // Heading
  level?: 1 | 2 | 3
  // List
  listType?: 'bullet' | 'numbered'
  // Checkbox
  checked?: boolean
  // Code
  language?: string
  // Image
  url?: string
  caption?: string
  // Toggle
  expanded?: boolean
}

export interface Block {
  id: string
  page_id: string
  parent_id: string | null
  type: BlockType
  content: BlockContent
  properties: BlockProperties
  position: number
  children: Block[]
  created_at: string
  updated_at: string
}

export interface CreateBlockInput {
  page_id: string
  parent_id?: string | null
  type: BlockType
  content?: Partial<BlockContent>
  properties?: Partial<BlockProperties>
  position: number
}

export interface UpdateBlockInput {
  content?: Partial<BlockContent>
  properties?: Partial<BlockProperties>
  position?: number
}

// ─── Databases ────────────────────────────────────────────────────────────────

export type PropertyType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi_select'
  | 'checkbox'
  | 'url'
  | 'relation'

export interface SelectOption {
  id: string
  label: string
  color: string
}

export interface PropertyConfig {
  options?: SelectOption[]
  relationDatabaseId?: string
  dateFormat?: string
  numberFormat?: 'integer' | 'decimal' | 'percent' | 'currency'
}

export interface DatabaseProperty {
  id: string
  database_id: string
  name: string
  type: PropertyType
  config: PropertyConfig | null
  position: number
}

export interface CellValue {
  text?: string
  number?: number
  date?: string
  checked?: boolean
  /** IDs of selected options (select / multi_select) */
  selected?: string[]
  url?: string
  /** IDs of related rows (relation) */
  relationIds?: string[]
}

export interface DatabaseRow {
  id: string
  database_id: string
  created_by: string | null
  created_at: string
  updated_at: string
  /** propertyId → CellValue, hydrated by the backend */
  cells: Record<string, CellValue>
}

export interface Database {
  id: string
  page_id: string
  workspace_id: string
  name: string
  created_at: string
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
}

export interface CreateDatabaseInput {
  name?: string
  workspace_id: string
  /** If omitted, backend auto-creates a page and links it */
  page_id?: string
  properties?: Array<{
    name: string
    type: PropertyType
    config?: PropertyConfig
    position?: number
  }>
}

export interface CreateRowInput {
  cells?: Record<string, CellValue>
}

export interface UpdateRowInput {
  cells: Record<string, CellValue>
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiError {
  message: string
  code?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: User
  token: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  display_name?: string
}

// ─── Zustand store shapes ────────────────────────────────────────────────────

export interface EditorState {
  pageId: string
  blocks: Block[]
  setBlocks: (blocks: Block[]) => void
  addBlock: (block: Block, afterId?: string) => void
  updateBlock: (id: string, updates: Partial<Block>) => void
  deleteBlock: (id: string) => void
  moveBlock: (id: string, newParentId: string | null, newPosition: number) => void
  toggleBlock: (id: string) => void
}

export interface PageTreeState {
  pages: Page[]
  currentPageId: string | null
  setPages: (pages: Page[]) => void
  setCurrentPage: (id: string) => void
  addPage: (page: Page) => void
  updatePage: (id: string, updates: Partial<Page>) => void
  deletePage: (id: string) => void
}

export interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}
