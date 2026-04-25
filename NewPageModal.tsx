import { useState } from 'react'
import { X, FileText, Table2, ChevronRight } from 'lucide-react'

interface NewPageModalProps {
  parentId?: string
  workspaceId: string
  onClose: () => void
  onCreated: (pageId: string) => void
}

type PageType = 'page' | 'database'

const PAGE_TYPES: { type: PageType; icon: React.ReactNode; label: string; description: string }[] = [
  {
    type: 'page',
    icon: <FileText size={22} className="text-gray-600" />,
    label: 'Empty page',
    description: 'A blank canvas with blocks — text, headings, checklists, code, and more.',
  },
  {
    type: 'database',
    icon: <Table2 size={22} className="text-blue-600" />,
    label: 'Database',
    description: 'A structured table with typed properties, filters, and sorting.',
  },
]

export function NewPageModal({ parentId, workspaceId, onClose, onCreated }: NewPageModalProps) {
  const [selected, setSelected] = useState<PageType>('page')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/v1/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim() || (selected === 'database' ? 'Untitled Database' : 'Untitled'),
          parent_id: parentId ?? null,
          workspace_id: workspaceId,
          is_database: selected === 'database',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Failed to create page')
      }

      const page = await res.json()
      onCreated(page.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-900">New page</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-md p-1 hover:bg-gray-100 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Title input */}
        <div className="px-5 mb-4">
          <input
            autoFocus
            type="text"
            placeholder={selected === 'database' ? 'Database name…' : 'Page title…'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition"
          />
        </div>

        {/* Type selector */}
        <div className="px-5 mb-5 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Type</p>
          {PAGE_TYPES.map(({ type, icon, label, description }) => (
            <button
              key={type}
              onClick={() => setSelected(type)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition ${
                selected === type
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400/30'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="mt-0.5 shrink-0">{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
              </div>
              {selected === type && (
                <div className="mt-0.5 w-4 h-4 rounded-full bg-blue-500 shrink-0 flex items-center justify-center">
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 mb-3">
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? 'Creating…' : 'Create'}
            {!loading && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}
