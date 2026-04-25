# Notion Clone - Production Architecture Specification

## System Overview

A modular workspace platform with block-based editing, hierarchical pages, relational databases, and real-time persistence.

## Architecture Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Editor Engine │ State Manager │ Router │ Block Renderer            │
└───────┬─────────────────────────────────────────────────────────────┘
        │ HTTP/WebSocket
┌───────▼─────────────────────────────────────────────────────────────┐
│                        API GATEWAY (Express)                        │
├────────────────┬───────────────────┬───────────────────────────────-┤
│  /api/pages    │  /api/blocks      │  /api/databases              │
│  /api/users    │  /api/realtime    │  /api/search                 │
└───────┬────────┴───────────────────┴──────────────────────────────-─┘
        │
┌───────▼─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER (PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────────┤
│  users │ pages │ blocks │ databases │ properties │ relations       │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

```sql
-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- WORKSPACES (for multi-tenancy)
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- PAGES
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  parent_id UUID REFERENCES pages(id),  -- NULL for root pages
  title VARCHAR(500) DEFAULT 'Untitled',
  icon VARCHAR(50),
  cover_url TEXT,
  is_database BOOLEAN DEFAULT false,
  database_id UUID,  -- links to databases table if is_database=true
  position INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- BLOCKS
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blocks(id),  -- For nested blocks
  type VARCHAR(50) NOT NULL,  -- paragraph, heading, list, checkbox, table, code, image, toggle
  content JSONB,  -- { text: "Hello", marks: [{type: "bold"}] }
  properties JSONB,  -- { checked: true, language: "javascript" }
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- DATABASES
CREATE TABLE databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,  -- The page that contains the database view
  workspace_id UUID REFERENCES workspaces(id),
  name VARCHAR(255) DEFAULT 'Database',
  created_at TIMESTAMP DEFAULT NOW()
);

-- DATABASE PROPERTIES (columns)
CREATE TABLE database_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- text, number, date, select, multi_select, relation, checkbox, url
  config JSONB,  -- { options: [{label: "Todo", color: "red"}], relationDatabaseId: "..." }
  position INTEGER DEFAULT 0
);

-- DATABASE ROWS (records)
CREATE TABLE database_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id UUID REFERENCES databases(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- DATABASE CELL VALUES
CREATE TABLE database_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id UUID REFERENCES database_rows(id) ON DELETE CASCADE,
  property_id UUID REFERENCES database_properties(id) ON DELETE CASCADE,
  value JSONB  -- { text: "value" } or { number: 42 } or { date: "2024-01-01" }
);

-- BLOCK TREE INDEX (materialized path for efficient querying)
CREATE TABLE block_tree (
  block_id UUID PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,
  path TEXT NOT NULL,  -- "page_id/parent_id/child_id/..." for ancestry
  depth INTEGER NOT NULL,
  root_page_id UUID REFERENCES pages(id)
);

-- INDEXES
CREATE INDEX idx_pages_parent ON pages(parent_id);
CREATE INDEX idx_pages_workspace ON pages(workspace_id);
CREATE INDEX idx_blocks_page ON blocks(page_id);
CREATE INDEX idx_blocks_parent ON blocks(parent_id);
CREATE INDEX idx_block_tree_path ON block_tree(path);
CREATE INDEX idx_block_tree_root ON block_tree(root_page_id);
CREATE INDEX idx_database_cells_row ON database_cells(row_id);
```

### Example Data

```sql
-- User
INSERT INTO users (id, email, password_hash, display_name) VALUES
('a1b2c3d4-...', 'john@example.com', '$2b$10$...', 'John Doe');

-- Workspace
INSERT INTO workspaces (id, name, owner_id) VALUES
('ws-001-...', 'John Workspace', 'a1b2c3d4-...');

-- Root Page
INSERT INTO pages (id, workspace_id, title, position) VALUES
('page-001-...', 'ws-001-...', 'Getting Started', 0);

-- Nested Page
INSERT INTO pages (id, workspace_id, parent_id, title, position) VALUES
('page-002-...', 'ws-001-...', 'page-001-...', 'Project Notes', 0);

-- Blocks
INSERT INTO blocks (id, page_id, type, content, position) VALUES
('block-001-...', 'page-001-...', 'heading', '{"text": "Welcome to Notion Clone"}', 0),
('block-002-...', 'page-001-...', 'paragraph', '{"text": "This is a paragraph with **bold** text"}', 1),
('block-003-...', 'page-001-...', 'checkbox', '{"text": "Setup database", "checked": false}', 2);

-- Nested Block (toggle with children)
INSERT INTO blocks (id, page_id, parent_id, type, content, position) VALUES
('block-004-...', 'page-001-...', NULL, 'toggle', '{"text": "Expand me"}', 3),
('block-005-...', 'page-001-...', 'block-004-...', 'paragraph', '{"text": "I am inside the toggle"}', 0);
```

## API Design

### Endpoints

```
BASE URL: /api/v1

AUTH:
POST   /auth/register        → { email, password } → { user, token }
POST   /auth/login           → { email, password } → { user, token }

PAGES:
GET    /pages                → List all pages
GET    /pages/:id            → Get page with blocks
POST   /pages                → Create page { parent_id?, title? }
PUT    /pages/:id            → Update page { title?, icon?, cover_url? }
DELETE /pages/:id            → Delete page (cascades)

BLOCKS:
GET    /pages/:pageId/blocks → Get all blocks for page (tree structure)
POST   /blocks               → Create block { page_id, parent_id?, type, content, position }
PUT    /blocks/:id           → Update block { content?, properties?, position? }
DELETE /blocks/:id           → Delete block (cascades to children)
POST   /blocks/reorder       → Reorder blocks { blockId, newParentId?, newPosition }

DATABASES:
GET    /databases            → List all databases
GET    /databases/:id        → Get database schema + rows
POST   /databases            → Create database
PUT    /databases/:id        → Update database
DELETE /databases/:id        → Delete database
GET    /databases/:id/rows   → Get all rows
POST   /databases/:id/rows   → Create row { cells: { propertyId: value } }
PUT    /databases/:id/rows/:rowId → Update row cells
DELETE /databases/:id/rows/:rowId → Delete row

REALTIME:
WS     /ws                   → WebSocket for real-time sync
```

### Request/Response Examples

#### Create Page
```json
POST /api/v1/pages
Request: {
  "title": "My New Page",
  "parent_id": "page-001",
  "workspace_id": "ws-001"
}
Response: {
  "id": "page-002",
  "title": "My New Page",
  "parent_id": "page-001",
  "position": 1,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### Get Page with Blocks
```json
GET /api/v1/pages/page-001
Response: {
  "id": "page-001",
  "title": "Getting Started",
  "icon": "📝",
  "blocks": [
    {
      "id": "block-001",
      "type": "heading",
      "content": { "text": "Welcome" },
      "position": 0,
      "children": [
        {
          "id": "block-002",
          "type": "paragraph",
          "content": { "text": "Hello world" },
          "position": 0,
          "children": []
        }
      ]
    }
  ]
}
```

#### Create Block
```json
POST /api/v1/blocks
Request: {
  "page_id": "page-001",
  "parent_id": null,
  "type": "paragraph",
  "content": { "text": "Hello world" },
  "position": 5
}
Response: {
  "id": "block-new",
  "page_id": "page-001",
  "type": "paragraph",
  "content": { "text": "Hello world" },
  "position": 5,
  "children": []
}
```

#### Create Database
```json
POST /api/v1/databases
Request: {
  "name": "Project Tracker",
  "workspace_id": "ws-001",
  "properties": [
    { "name": "Name", "type": "text" },
    { "name": "Status", "type": "select", "config": { "options": ["Todo", "In Progress", "Done"] } },
    { "name": "Due Date", "type": "date" }
  ]
}
Response: {
  "id": "db-001",
  "name": "Project Tracker",
  "properties": [...]
}
```

## Folder Structure

```
notion-clone/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Entry point
│   │   ├── app.ts                   # Express app setup
│   │   ├── config/
│   │   │   └── database.ts          # DB connection
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── pages.ts
│   │   │   ├── blocks.ts
│   │   │   └── databases.ts
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── page.service.ts
│   │   │   ├── block.service.ts
│   │   │   └── database.service.ts
│   │   ├── models/
│   │   │   └── types.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   └── error.ts
│   │   └── utils/
│   │       └── tree.ts             # Block tree utilities
│   ├── prisma/
│   │   └── schema.prisma
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Editor/
│   │   │   │   ├── Editor.tsx          # Main editor container
│   │   │   │   ├── Block.tsx           # Individual block renderer
│   │   │   │   ├── BlockToolbar.tsx    # Block formatting toolbar
│   │   │   │   └── SlashMenu.tsx       # "/" command menu
│   │   │   ├── Page/
│   │   │   │   ├── PageContainer.tsx
│   │   │   │   └── PageList.tsx
│   │   │   ├── Database/
│   │   │   │   ├── DatabaseView.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   └── Cell.tsx
│   │   │   └── Layout/
│   │   │       ├── Sidebar.tsx
│   │   │       └── Header.tsx
│   │   ├── hooks/
│   │   │   ├── useBlocks.ts           # Block state management
│   │   │   ├── usePages.ts
│   │   │   └── useDatabase.ts
│   │   ├── store/
│   │   │   ├── editorStore.ts          # Zustand store for editor state
│   │   │   └── types.ts
│   │   ├── api/
│   │   │   ├── client.ts              # Axios/fetch wrapper
│   │   │   ├── pages.ts
│   │   │   ├── blocks.ts
│   │   │   └── databases.ts
│   │   └── utils/
│   │       ├── blockTypes.ts          # Block type definitions
│   │       └── slate-helpers.ts       # Slate.js utilities
│   ├── package.json
│   └── vite.config.ts
│
└── shared/
    └── types/
        └── index.ts                   # Shared TypeScript types
```

## Step-by-Step Build Plan

### Phase 1: Minimal Working System
**Goal:** Basic CRUD for pages with hierarchical structure

1. **Database setup** (30 min)
   - Set up PostgreSQL with Prisma
   - Define schema for users, pages, blocks
   - Run migrations

2. **Backend skeleton** (1 hour)
   - Express server with TypeScript
   - Basic auth middleware
   - Pages CRUD endpoints
   - Blocks CRUD endpoints

3. **Frontend skeleton** (1 hour)
   - Vite + React + TypeScript
   - Tailwind CSS setup
   - Basic routing

4. **Page list and creation** (2 hours)
   - Sidebar with page tree
   - Page creation
   - Page navigation

**Output:** Working page tree with titles that can be created/renamed/deleted

### Phase 2: Block Editor
**Goal:** Fully functional block-based editor

1. **Block rendering** (2 hours)
   - Render blocks based on type
   - Paragraph, heading, list blocks
   - Basic text editing

2. **Block manipulation** (2 hours)
   - Creating new blocks on Enter
   - Deleting blocks on Backspace (empty)
   - Block reordering via drag-drop

3. **Nested blocks** (2 hours)
   - Toggle blocks with children
   - Indent/outdent functionality
   - Tree structure preservation

4. **Rich text** (2 hours)
   - Bold, italic, underline via keyboard shortcuts
   - Inline code

5. **Slash command menu** (2 hours)
   - "/" to open block type menu
   - Filter block types by typing
   - Insert block on selection

**Output:** Functional block editor with nesting and rich text

### Phase 3: Database Features
**Goal:** Notion-like databases

1. **Database schema** (1 hour)
   - Create database tables
   - Property types setup

2. **Database view** (2 hours)
   - Table grid view
   - Column headers
   - Cell rendering by type

3. **CRUD operations** (2 hours)
   - Add/delete rows
   - Edit cells inline
   - Sort by column

4. **Property types** (2 hours)
   - Select, multi-select with color options
   - Date picker
   - Relation links

**Output:** Fully functional relational database

### Phase 4: Performance Optimization
**Goal:** Production-ready performance

1. **Query optimization** (2 hours)
   - Materialized paths for block trees
   - Batch operations
   - Pagination

2. **Frontend optimization** (2 hours)
   - Virtual scrolling for long pages
   - Memoization
   - Optimistic updates

3. **Caching** (1 hour)
   - React Query setup
   - Cache invalidation

**Output:** Smooth editing experience with 1000+ blocks

### Phase 5: Advanced Features
**Goal:** Production polish

1. **Real-time sync** (4 hours)
   - WebSocket server
   - Conflict resolution
   - Presence indicators

2. **Search** (2 hours)
   - Full-text search
   - Search across pages/databases

3. **Export** (2 hours)
   - Markdown export
   - PDF export

4. **Collaboration** (4 hours)
   - Multi-user cursors
   - Comments/mentions

**Output:** Production-ready collaboration features

---

## Editor Engine Design

### Block State Structure

```typescript
interface Block {
  id: string;
  type: 'paragraph' | 'heading' | 'list' | 'checkbox' | 'toggle' | 'code' | 'image' | 'table';
  content: Content;  // Rich text content
  properties: BlockProperties;
  children: Block[];  // Nested blocks
  position: number;
}

interface Content {
  text: string;
  marks?: Array<'bold' | 'italic' | 'underline' | 'code' | 'link'>;
}

interface BlockProperties {
  // Checkbox
  checked?: boolean;
  // Heading
  level?: 1 | 2 | 3;
  // List
  listType?: 'bullet' | 'numbered';
  // Code
  language?: string;
  // Image
  url?: string;
  // Toggle
  expanded?: boolean;
}
```

### State Management (Zustand)

```typescript
interface EditorState {
  pageId: string;
  blocks: Block[];
  
  // Actions
  setBlocks: (blocks: Block[]) => void;
  addBlock: (block: Block, afterId: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, newParentId: string | null, newPosition: number) => void;
  toggleBlock: (id: string) => void;
}
```

### Block Rendering Logic

```typescript
// Block component selection
const BlockComponent = ({ block }: { block: Block }) => {
  switch (block.type) {
    case 'paragraph':
      return <ParagraphBlock block={block} />;
    case 'heading':
      return <HeadingBlock block={block} />;
    case 'checkbox':
      return <CheckboxBlock block={block} />;
    case 'toggle':
      return <ToggleBlock block={block} />;
    case 'code':
      return <CodeBlock block={block} />;
    case 'list':
      return <ListBlock block={block} />;
    case 'image':
      return <ImageBlock block={block} />;
    case 'table':
      return <TableBlock block={block} />;
    default:
      return <ParagraphBlock block={block} />;
  }
};
```

### Keyboard Handling

```typescript
// Key handlers for block navigation
const handleKeyDown = (event: KeyboardEvent, blockId: string) => {
  switch (event.key) {
    case 'Enter':
      if (!event.shiftKey) {
        event.preventDefault();
        createBlockAfter(blockId);
      }
      break;
    case 'Backspace':
      if (isBlockEmpty(blockId) && !isFirstBlock(blockId)) {
        event.preventDefault();
        deleteBlock(blockId);
        focusPreviousBlock(blockId);
      }
      break;
    case 'Tab':
      event.preventDefault();
      if (event.shiftKey) {
        outdentBlock(blockId);
      } else {
        indentBlock(blockId);
      }
      break;
  }
};
```

---

## Implementation Notes

### Block Tree Query

```typescript
// Get block tree with materialized path
async function getBlockTree(pageId: string) {
  const blocks = await prisma.block.findMany({
    where: { page_id: pageId },
    orderBy: { position: 'asc' }
  });
  
  // Build tree in memory
  const blockMap = new Map(blocks.map(b => [b.id, { ...b, children: [] }]));
  const roots: Block[] = [];
  
  for (const block of blocks) {
    if (block.parent_id) {
      const parent = blockMap.get(block.parent_id);
      parent?.children.push(blockMap.get(block.id)!);
    } else {
      roots.push(blockMap.get(block.id)!);
    }
  }
  
  return roots;
}
```

### Optimistic Updates

```typescript
// Optimistic block update with rollback
async function updateBlockOptimistic(id: string, updates: Partial<Block>) {
  const previousState = store.getState().blocks;
  
  // Optimistic update
  store.getState().updateBlock(id, updates);
  
  try {
    await api.blocks.update(id, updates);
  } catch (error) {
    // Rollback on failure
    store.setState({ blocks: previousState });
    toast.error('Failed to update');
  }
}
```
