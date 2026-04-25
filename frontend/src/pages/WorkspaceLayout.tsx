import { useState, useCallback } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { Search, Plus, Settings, ChevronDown, ChevronRight, FileText, Table2, Trash2 } from 'lucide-react'

import { NewPageModal }   from '../components/NewPageModal'
import { SearchModal, useSearchShortcut } from '../components/SearchModal'
import { PresenceBar }    from '../components/PresenceBar'
import { useRealtime }    from '../hooks/useRealtime'
import type { Page }      from '../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceLayoutProps {
  workspaceId: string
  workspaceName: string
  userId: string
  pages: Page[]
  onPagesChange: (pages: Page[]) => void
}

// ─── WorkspaceLayout ──────────────────────────────────────────────────────────

export function WorkspaceLayout({
  workspaceId,
  workspaceName,
  userId,
  pages,
  onPagesChange,
}: WorkspaceLayoutProps) {
  const navigate  = useNavigate()
  const { pageId } = useParams<{ pageId: string }>()

  const [showNewPage,  setShowNewPage]  = useState(false)
  const [showSearch,   setShowSearch]   = useState(false)
  const [newPageParent, setNewPageParent] = useState<string | undefined>(undefined)
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set())

  // ── Real-time (workspace-level — page-level presence is per WorkspacePage) ──
  const { connected, members, broadcast, clientId } = useRealtime({
    roomId: workspaceId,
    trackPresence: true,
    on: {
      'page:updated': (msg: any) => {
        const updated = msg.payload as Page
        onPagesChange(pages.map(p => p.id === updated.id ? { ...p, ...updated } : p))
      },
    },
  })

  // ── Search shortcut (Cmd+K) ────────────────────────────────────────────────
  useSearchShortcut(() => setShowSearch(true))

  // ── Page tree helpers ──────────────────────────────────────────────────────
  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const deletePage = async (id: string) => {
    if (!confirm('Delete this page and all its children?')) return
    onPagesChange(pages.filter(p => p.id !== id && p.parent_id !== id))
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/v1/pages/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    } catch { /* optimistic already applied */ }
  }

  const handlePageCreated = (newPageId: string) => {
    // Refresh pages list then navigate
    const token = localStorage.getItem('token')
    fetch('/api/v1/pages', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((fresh: Page[]) => {
        onPagesChange(fresh)
        navigate(`/workspace/${newPageId}`)
        // Auto-expand parent if nested
        if (newPageParent) setExpanded(prev => new Set([...prev, newPageParent]))
      })
      .catch(() => navigate(`/workspace/${newPageId}`))
    setShowNewPage(false)
    setNewPageParent(undefined)
  }

  // ── Build a page tree from flat list ──────────────────────────────────────
  const roots = buildTree(pages)

  return (
    <div className="flex h-screen bg-white overflow-hidden">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col bg-gray-50 border-r border-gray-200">

        {/* Workspace name */}
        <div className="flex items-center gap-2 px-3 py-3.5 border-b border-gray-200">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {workspaceName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-gray-800 truncate flex-1">{workspaceName}</span>
        </div>

        {/* Actions */}
        <div className="px-2 py-2 space-y-0.5">
          <SidebarBtn
            icon={<Search size={14} />}
            label="Search"
            kbd="⌘K"
            onClick={() => setShowSearch(true)}
          />
          <SidebarBtn
            icon={<Plus size={14} />}
            label="New page"
            onClick={() => { setNewPageParent(undefined); setShowNewPage(true) }}
          />
          <SidebarBtn icon={<Settings size={14} />} label="Settings" onClick={() => {}} />
        </div>

        <div className="mx-3 my-1 border-t border-gray-200" />

        {/* Page tree */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide px-2 py-2">Pages</p>
          {roots.map(page => (
            <PageNode
              key={page.id}
              page={page}
              depth={0}
              activePageId={pageId}
              expanded={expanded}
              onToggle={toggle}
              onNavigate={id => navigate(`/workspace/${id}`)}
              onAddChild={id => { setNewPageParent(id); setShowNewPage(true) }}
              onDelete={deletePage}
            />
          ))}
          {roots.length === 0 && (
            <p className="text-xs text-gray-400 px-2 py-3">No pages yet — create one above.</p>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header bar */}
        <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 text-sm text-gray-500 truncate">
            {/* Breadcrumb could go here */}
          </div>
          <div className="flex items-center gap-3">
            <PresenceBar
              members={members}
              selfClientId={clientId}
              connected={connected}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden flex">
          <Outlet />
        </main>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showNewPage && (
        <NewPageModal
          parentId={newPageParent}
          workspaceId={workspaceId}
          onClose={() => { setShowNewPage(false); setNewPageParent(undefined) }}
          onCreated={handlePageCreated}
        />
      )}

      {showSearch && (
        <SearchModal onClose={() => setShowSearch(false)} />
      )}
    </div>
  )
}

// ─── PageNode ─────────────────────────────────────────────────────────────────

interface PageNodeProps {
  page: PageWithChildren
  depth: number
  activePageId?: string
  expanded: Set<string>
  onToggle: (id: string) => void
  onNavigate: (id: string) => void
  onAddChild: (id: string) => void
  onDelete: (id: string) => void
}

function PageNode({ page, depth, activePageId, expanded, onToggle, onNavigate, onAddChild, onDelete }: PageNodeProps) {
  const isActive   = page.id === activePageId
  const isExpanded = expanded.has(page.id)
  const hasChildren = page.children.length > 0

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition text-sm ${
          isActive
            ? 'bg-gray-200 text-gray-900'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onNavigate(page.id)}
      >
        {/* Expand/collapse */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(page.id) }}
          className={`shrink-0 w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 transition ${hasChildren ? 'opacity-100' : 'opacity-0'}`}
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Icon */}
        <span className="shrink-0 text-gray-400">
          {page.icon ? (
            <span className="text-sm">{page.icon}</span>
          ) : page.is_database ? (
            <Table2 size={13} />
          ) : (
            <FileText size={13} />
          )}
        </span>

        {/* Title */}
        <span className="flex-1 truncate text-xs font-medium">
          {page.title || 'Untitled'}
        </span>

        {/* Hover actions */}
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); onAddChild(page.id) }}
            className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition"
            title="Add child page"
          >
            <Plus size={11} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(page.id) }}
            className="p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
            title="Delete page"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Children */}
      {isExpanded && page.children.map(child => (
        <PageNode
          key={child.id}
          page={child}
          depth={depth + 1}
          activePageId={activePageId}
          expanded={expanded}
          onToggle={onToggle}
          onNavigate={onNavigate}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// ─── SidebarBtn ───────────────────────────────────────────────────────────────

function SidebarBtn({ icon, label, onClick, kbd }: {
  icon: React.ReactNode; label: string; onClick: () => void; kbd?: string
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-gray-100 transition"
    >
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 text-left font-medium">{label}</span>
      {kbd && <span className="text-gray-300 text-[10px]">{kbd}</span>}
    </button>
  )
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

interface PageWithChildren extends Page {
  children: PageWithChildren[]
}

function buildTree(pages: Page[]): PageWithChildren[] {
  const map = new Map<string, PageWithChildren>(
    pages.map(p => [p.id, { ...p, children: [] }])
  )
  const roots: PageWithChildren[] = []

  for (const page of pages) {
    const node = map.get(page.id)!
    if (page.parent_id && map.has(page.parent_id)) {
      map.get(page.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort each level by position
  const sort = (nodes: PageWithChildren[]) => {
    nodes.sort((a, b) => a.position - b.position)
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)

  return roots
}
