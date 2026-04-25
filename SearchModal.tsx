import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, FileText, Table2, Clock, X, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultType = 'page' | 'database' | 'block'

interface SearchResult {
  id: string
  type: ResultType
  title: string
  /** Page title for block results */
  pageTitle?: string
  pageId?: string
  /** Excerpt with matched text */
  excerpt?: string
  updatedAt: string
  icon?: string | null
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchSearchResults(query: string, signal: AbortSignal): Promise<SearchResult[]> {
  if (!query.trim()) return []
  const token = localStorage.getItem('token')
  const res = await fetch(
    `/api/v1/search?q=${encodeURIComponent(query.trim())}&limit=20`,
    { headers: { Authorization: `Bearer ${token}` }, signal }
  )
  if (!res.ok) return []
  return res.json()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-100 text-yellow-900 rounded px-0.5">{part}</mark>
      : part
  )
}

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  page:     <FileText size={14} className="text-gray-400" />,
  database: <Table2 size={14} className="text-blue-400" />,
  block:    <FileText size={14} className="text-gray-300" />,
}

// ─── SearchModal ──────────────────────────────────────────────────────────────

interface SearchModalProps {
  onClose: () => void
}

export function SearchModal({ onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentPages, setRecentPages] = useState<SearchResult[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Load recent pages on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/v1/pages?limit=5&sort=updatedAt', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((pages: any[]) => {
        setRecentPages(pages.map(p => ({
          id: p.id,
          type: p.is_database ? 'database' : 'page',
          title: p.title || 'Untitled',
          updatedAt: p.updated_at,
          icon: p.icon,
        })))
      })
      .catch(() => {})
  }, [])

  // Debounced search
  useEffect(() => {
    setActiveIndex(0)
    if (!query.trim()) { setResults([]); return }

    setLoading(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const r = await fetchSearchResults(query, controller.signal)
        setResults(r)
      } catch (e: any) {
        if (e.name !== 'AbortError') setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const displayedItems = query.trim() ? results : recentPages

  // Navigate to a result
  const navigateTo = useCallback((item: SearchResult) => {
    onClose()
    if (item.type === 'block' && item.pageId) {
      navigate(`/workspace/${item.pageId}`)
    } else {
      navigate(`/workspace/${item.id}`)
    }
  }, [navigate, onClose])

  // Keyboard handling
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, displayedItems.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (displayedItems[activeIndex]) navigateTo(displayedItems[activeIndex])
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [displayedItems, activeIndex, navigateTo, onClose])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          {loading
            ? <Spinner />
            : <Search size={17} className="text-gray-400 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages, databases, blocks…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="overflow-y-auto flex-1" ref={listRef}>
          {displayedItems.length === 0 && query.trim() && !loading && (
            <div className="py-12 text-center text-gray-400 text-sm">
              No results for <span className="font-medium text-gray-600">"{query}"</span>
            </div>
          )}

          {displayedItems.length === 0 && !query.trim() && !loading && (
            <div className="py-12 text-center text-gray-400 text-sm">
              No recent pages
            </div>
          )}

          {!query.trim() && recentPages.length > 0 && (
            <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Clock size={11} /> Recent
            </p>
          )}

          {displayedItems.map((item, idx) => (
            <ResultRow
              key={item.id + idx}
              item={item}
              query={query}
              active={idx === activeIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => navigateTo(item)}
            />
          ))}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
          <Shortcut icon={<CornerDownLeft size={11} />} label="Open" />
          <Shortcut icon={<><ArrowUp size={11} /><ArrowDown size={11} /></>} label="Navigate" />
          <Shortcut label="Esc" labelText="Close" />
        </div>
      </div>
    </div>
  )
}

// ─── ResultRow ────────────────────────────────────────────────────────────────

interface ResultRowProps {
  item: SearchResult
  query: string
  active: boolean
  onMouseEnter: () => void
  onClick: () => void
}

function ResultRow({ item, query, active, onMouseEnter, onClick }: ResultRowProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition ${
        active ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Icon */}
      <div className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 text-base leading-none">
        {item.icon ?? TYPE_ICON[item.type]}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {highlight(item.title || 'Untitled', query)}
        </p>
        {item.excerpt && (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {highlight(item.excerpt, query)}
          </p>
        )}
        {item.pageTitle && (
          <p className="text-xs text-gray-400 truncate mt-0.5">in {item.pageTitle}</p>
        )}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
          item.type === 'database'
            ? 'bg-blue-100 text-blue-600'
            : item.type === 'block'
            ? 'bg-gray-100 text-gray-500'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {item.type}
        </span>
        <span className="text-xs text-gray-400">{formatRelative(item.updatedAt)}</span>
      </div>
    </div>
  )
}

// ─── Small bits ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin shrink-0" />
  )
}

function Shortcut({
  icon, label, labelText,
}: { icon?: React.ReactNode; label?: string; labelText?: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-400">
      <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-500 font-mono text-[11px]">
        {icon ?? label}
      </span>
      <span>{labelText ?? label}</span>
    </div>
  )
}

// ─── Keyboard shortcut to open the modal (Cmd+K / Ctrl+K) ────────────────────

export function useSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}
