import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DatabaseView } from '../components/DatabaseView'
import { BlockEditor } from '../components/BlockEditor'   // your existing editor
import type { Page } from '../../shared/types'

interface WorkspacePageProps {
  /** Optional: pass in if already fetched by parent (e.g. sidebar state) */
  page?: Page
}

export function WorkspacePage({ page: pageProp }: WorkspacePageProps) {
  const { pageId } = useParams<{ pageId: string }>()
  const [page, setPage] = useState<Page | null>(pageProp ?? null)
  const [loading, setLoading] = useState(!pageProp)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pageId) return
    if (pageProp && pageProp.id === pageId) {
      setPage(pageProp)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const token = localStorage.getItem('token')
    fetch(`/api/v1/pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Page not found')
        return res.json()
      })
      .then((data: Page) => {
        setPage(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [pageId, pageProp])

  if (loading) return <PageShell><PageSkeleton /></PageShell>
  if (error) return <PageShell><ErrorState message={error} /></PageShell>
  if (!page) return <PageShell><EmptyState /></PageShell>

  // ── Route to the right view ────────────────────────────────────────────────
  if (page.is_database && page.database_id) {
    return (
      <div className="flex-1 overflow-y-auto bg-white">
        <DatabaseView
          databaseId={page.database_id}
          pageTitle={page.title}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <BlockEditor pageId={page.id} initialBlocks={(page as any).blocks ?? []} />
    </div>
  )
}

// ─── Layout shell ────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto bg-white">{children}</div>
}

// ─── Skeleton / empty states ─────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-8 pt-16 animate-pulse">
      <div className="h-8 w-64 bg-gray-200 rounded-lg mb-6" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-gray-400">
      <svg className="w-10 h-10 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-gray-400">
      <p className="text-sm">Select a page from the sidebar</p>
    </div>
  )
}
