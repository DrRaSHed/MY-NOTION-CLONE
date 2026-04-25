import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, MoreHorizontal, Trash2, GripVertical,
  Type, Hash, Calendar, CheckSquare, Tag, Link2, AlignLeft
} from 'lucide-react'
import { DatabaseToolbar, ViewMode } from './DatabaseToolbar'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PropertyType =
  | 'text' | 'number' | 'date' | 'select' | 'multi_select'
  | 'checkbox' | 'url' | 'relation'

export interface SelectOption {
  id: string
  label: string
  color: string
}

export interface DatabaseProperty {
  id: string
  name: string
  type: PropertyType
  config?: { options?: SelectOption[]; relationDatabaseId?: string }
  position: number
}

export interface CellValue {
  text?: string
  number?: number
  date?: string
  checked?: boolean
  selected?: string[]   // for select / multi_select
  url?: string
}

export interface DatabaseRow {
  id: string
  cells: Record<string, CellValue>  // propertyId → value
  created_at: string
}

export interface DatabaseData {
  id: string
  name: string
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_ICONS: Record<PropertyType, React.ReactNode> = {
  text:         <Type size={12} />,
  number:       <Hash size={12} />,
  date:         <Calendar size={12} />,
  checkbox:     <CheckSquare size={12} />,
  select:       <Tag size={12} />,
  multi_select: <Tag size={12} />,
  url:          <Link2 size={12} />,
  relation:     <AlignLeft size={12} />,
}

const SELECT_COLORS = [
  { bg: 'bg-red-100',    text: 'text-red-700',    value: 'red'    },
  { bg: 'bg-orange-100', text: 'text-orange-700',  value: 'orange' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700',  value: 'yellow' },
  { bg: 'bg-green-100',  text: 'text-green-700',   value: 'green'  },
  { bg: 'bg-blue-100',   text: 'text-blue-700',    value: 'blue'   },
  { bg: 'bg-purple-100', text: 'text-purple-700',  value: 'purple' },
  { bg: 'bg-pink-100',   text: 'text-pink-700',    value: 'pink'   },
  { bg: 'bg-gray-100',   text: 'text-gray-700',    value: 'gray'   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorClasses(color: string) {
  return SELECT_COLORS.find(c => c.value === color) ?? SELECT_COLORS[7]
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function apiHeaders() {
  const token = localStorage.getItem('token')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

// ─── DatabaseView (root component) ────────────────────────────────────────────

interface DatabaseViewProps {
  databaseId: string
  pageTitle: string
}

export function DatabaseView({ databaseId, pageTitle }: DatabaseViewProps) {
  const [data, setData] = useState<DatabaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState<{ propertyId: string; direction: 'asc' | 'desc' } | null>(null)
  const [filterConfig, setFilterConfig] = useState<{ propertyId: string; value: string } | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/databases/${databaseId}`, { headers: apiHeaders() })
      if (!res.ok) throw new Error('Failed to load database')
      const db: DatabaseData = await res.json()
      setData(db)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [databaseId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived rows (search + filter + sort) ─────────────────────────────────
  const displayedRows = (() => {
    if (!data) return []
    let rows = [...data.rows]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      rows = rows.filter(row =>
        Object.values(row.cells).some(cell =>
          String(cell.text ?? cell.number ?? cell.url ?? '').toLowerCase().includes(q)
        )
      )
    }

    if (filterConfig) {
      rows = rows.filter(row => {
        const cell = row.cells[filterConfig.propertyId]
        if (!cell) return false
        const val = String(cell.text ?? cell.number ?? cell.url ?? '').toLowerCase()
        return val.includes(filterConfig.value.toLowerCase())
      })
    }

    if (sortConfig) {
      rows.sort((a, b) => {
        const av = a.cells[sortConfig.propertyId]
        const bv = b.cells[sortConfig.propertyId]
        const aStr = String(av?.text ?? av?.number ?? '')
        const bStr = String(bv?.text ?? bv?.number ?? '')
        return sortConfig.direction === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr)
      })
    }

    return rows
  })()

  // ── Actions ────────────────────────────────────────────────────────────────
  const addRow = async () => {
    if (!data) return
    try {
      const res = await fetch(`/api/v1/databases/${databaseId}/rows`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ cells: {} }),
      })
      if (!res.ok) throw new Error('Failed to create row')
      const row: DatabaseRow = await res.json()
      setData(d => d ? { ...d, rows: [...d.rows, { ...row, cells: {} }] } : d)
    } catch {
      // optimistic fallback
      const row: DatabaseRow = { id: uid(), cells: {}, created_at: new Date().toISOString() }
      setData(d => d ? { ...d, rows: [...d.rows, row] } : d)
    }
  }

  const deleteRow = async (rowId: string) => {
    setData(d => d ? { ...d, rows: d.rows.filter(r => r.id !== rowId) } : d)
    try {
      await fetch(`/api/v1/databases/${databaseId}/rows/${rowId}`, {
        method: 'DELETE', headers: apiHeaders(),
      })
    } catch { fetchData() }
  }

  const updateCell = async (rowId: string, propertyId: string, value: CellValue) => {
    setData(d => {
      if (!d) return d
      return {
        ...d,
        rows: d.rows.map(r =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [propertyId]: value } } : r
        ),
      }
    })
    try {
      await fetch(`/api/v1/databases/${databaseId}/rows/${rowId}`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ cells: { [propertyId]: value } }),
      })
    } catch { /* optimistic stays */ }
  }

  const addProperty = async () => {
    if (!data) return
    const name = prompt('Property name:')
    if (!name) return
    const prop: DatabaseProperty = {
      id: uid(), name, type: 'text', position: data.properties.length
    }
    setData(d => d ? { ...d, properties: [...d.properties, prop] } : d)
    try {
      const res = await fetch(`/api/v1/databases/${databaseId}/properties`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ name, type: 'text', position: prop.position }),
      })
      if (res.ok) {
        const saved = await res.json()
        setData(d => d
          ? { ...d, properties: d.properties.map(p => p.id === prop.id ? saved : p) }
          : d)
      }
    } catch { /* optimistic stays */ }
  }

  const renameProperty = (propId: string) => {
    const prop = data?.properties.find(p => p.id === propId)
    const name = prompt('Rename property:', prop?.name)
    if (!name || !data) return
    setData(d => d
      ? { ...d, properties: d.properties.map(p => p.id === propId ? { ...p, name } : p) }
      : d)
    fetch(`/api/v1/databases/${databaseId}/properties/${propId}`, {
      method: 'PUT', headers: apiHeaders(), body: JSON.stringify({ name })
    }).catch(() => {})
  }

  const deleteProperty = (propId: string) => {
    if (!confirm('Delete this property and all its data?')) return
    setData(d => d
      ? { ...d, properties: d.properties.filter(p => p.id !== propId) }
      : d)
    fetch(`/api/v1/databases/${databaseId}/properties/${propId}`, {
      method: 'DELETE', headers: apiHeaders()
    }).catch(() => {})
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <DatabaseSkeleton />
  if (error) return <p className="text-red-500 text-sm p-6">{error}</p>
  if (!data) return null

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page title */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{data.rows.length} rows · {data.properties.length} properties</p>
      </div>

      {/* Toolbar */}
      <div className="px-6 pb-4">
        <DatabaseToolbar
          properties={data.properties}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSortChange={setSortConfig}
          onFilterChange={setFilterConfig}
          onSearch={setSearchQuery}
          onAddRow={addRow}
        />
      </div>

      {/* Table / Board */}
      <div className="flex-1 overflow-auto px-6 pb-8">
        {viewMode === 'table' ? (
          <TableGrid
            properties={data.properties}
            rows={displayedRows}
            databaseId={databaseId}
            onUpdateCell={updateCell}
            onDeleteRow={deleteRow}
            onAddRow={addRow}
            onAddProperty={addProperty}
            onRenameProperty={renameProperty}
            onDeleteProperty={deleteProperty}
          />
        ) : (
          <BoardView properties={data.properties} rows={displayedRows} onUpdateCell={updateCell} />
        )}
      </div>
    </div>
  )
}

// ─── TableGrid ────────────────────────────────────────────────────────────────

interface TableGridProps {
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
  databaseId: string
  onUpdateCell: (rowId: string, propId: string, value: CellValue) => void
  onDeleteRow: (rowId: string) => void
  onAddRow: () => void
  onAddProperty: () => void
  onRenameProperty: (propId: string) => void
  onDeleteProperty: (propId: string) => void
}

function TableGrid({
  properties, rows, onUpdateCell, onDeleteRow, onAddRow, onAddProperty, onRenameProperty, onDeleteProperty,
}: TableGridProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [headerMenu, setHeaderMenu] = useState<string | null>(null)

  const sortedProps = [...properties].sort((a, b) => a.position - b.position)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {/* Header */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-8 px-2" />
              {sortedProps.map(prop => (
                <th
                  key={prop.id}
                  className="text-left border-r border-gray-200 last:border-r-0 min-w-[140px]"
                >
                  <div className="flex items-center gap-1.5 px-3 py-2.5 group">
                    <span className="text-gray-400">{PROPERTY_ICONS[prop.type]}</span>
                    <span className="font-medium text-xs text-gray-700 flex-1">{prop.name}</span>
                    <div className="relative">
                      <button
                        onClick={() => setHeaderMenu(headerMenu === prop.id ? null : prop.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400 transition"
                      >
                        <MoreHorizontal size={12} />
                      </button>
                      {headerMenu === prop.id && (
                        <PropertyMenu
                          onRename={() => { onRenameProperty(prop.id); setHeaderMenu(null) }}
                          onDelete={() => { onDeleteProperty(prop.id); setHeaderMenu(null) }}
                          onClose={() => setHeaderMenu(null)}
                        />
                      )}
                    </div>
                  </div>
                </th>
              ))}
              {/* Add property */}
              <th className="w-10">
                <button
                  onClick={onAddProperty}
                  className="w-full py-2.5 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                  title="Add property"
                >
                  <Plus size={14} />
                </button>
              </th>
            </tr>
          </thead>

          {/* Rows */}
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 last:border-b-0 transition ${
                  hoveredRow === row.id ? 'bg-gray-50/60' : ''
                }`}
                onMouseEnter={() => setHoveredRow(row.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Row number / drag handle */}
                <td className="px-2 w-8">
                  <div className="flex items-center justify-center text-gray-300">
                    {hoveredRow === row.id ? (
                      <button
                        onClick={() => onDeleteRow(row.id)}
                        className="text-red-400 hover:text-red-600 transition"
                        title="Delete row"
                      >
                        <Trash2 size={12} />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">{idx + 1}</span>
                    )}
                  </div>
                </td>

                {/* Cells */}
                {sortedProps.map(prop => (
                  <td key={prop.id} className="border-r border-gray-100 last:border-r-0 p-0">
                    <CellEditor
                      property={prop}
                      value={row.cells[prop.id] ?? {}}
                      onChange={(v) => onUpdateCell(row.id, prop.id, v)}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}

            {/* Add row */}
            <tr>
              <td colSpan={sortedProps.length + 2}>
                <button
                  onClick={onAddRow}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
                >
                  <Plus size={13} /> New row
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── CellEditor ───────────────────────────────────────────────────────────────

interface CellEditorProps {
  property: DatabaseProperty
  value: CellValue
  onChange: (v: CellValue) => void
}

function CellEditor({ property, value, onChange }: CellEditorProps) {
  const [editing, setEditing] = useState(false)
  const [localText, setLocalText] = useState(value.text ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocalText(value.text ?? '') }, [value.text])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (property.type === 'text' || property.type === 'url') {
      onChange({ text: localText })
    } else if (property.type === 'number') {
      onChange({ number: parseFloat(localText) || 0 })
    }
  }

  switch (property.type) {
    case 'checkbox':
      return (
        <div className="px-3 py-2 flex items-center">
          <input
            type="checkbox"
            checked={value.checked ?? false}
            onChange={(e) => onChange({ checked: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )

    case 'date':
      return (
        <div className="px-3 py-2">
          <input
            type="date"
            value={value.date ?? ''}
            onChange={(e) => onChange({ date: e.target.value })}
            className="text-xs text-gray-700 bg-transparent focus:outline-none cursor-pointer w-full"
          />
        </div>
      )

    case 'select': {
      const options = property.config?.options ?? []
      const selected = options.find(o => value.selected?.includes(o.id))
      return (
        <SelectCell
          options={options}
          selected={value.selected ?? []}
          multi={false}
          onChange={(ids) => onChange({ selected: ids })}
        />
      )
    }

    case 'multi_select': {
      const options = property.config?.options ?? []
      return (
        <SelectCell
          options={options}
          selected={value.selected ?? []}
          multi={true}
          onChange={(ids) => onChange({ selected: ids })}
        />
      )
    }

    case 'number':
      return editing ? (
        <input
          ref={inputRef}
          type="number"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-full px-3 py-2 text-xs text-gray-800 bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
        />
      ) : (
        <div
          className="px-3 py-2 text-xs text-gray-700 cursor-text hover:bg-gray-50 transition min-h-[34px] flex items-center"
          onClick={() => setEditing(true)}
        >
          {value.number !== undefined ? value.number : <span className="text-gray-300">—</span>}
        </div>
      )

    default: // text, url, relation
      return editing ? (
        <input
          ref={inputRef}
          type={property.type === 'url' ? 'url' : 'text'}
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-full px-3 py-2 text-xs text-gray-800 bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
        />
      ) : (
        <div
          className="px-3 py-2 text-xs text-gray-700 cursor-text hover:bg-gray-50 transition min-h-[34px] flex items-center truncate"
          onClick={() => setEditing(true)}
        >
          {localText || <span className="text-gray-300">—</span>}
        </div>
      )
  }
}

// ─── SelectCell ───────────────────────────────────────────────────────────────

interface SelectCellProps {
  options: SelectOption[]
  selected: string[]
  multi: boolean
  onChange: (ids: string[]) => void
}

function SelectCell({ options, selected, multi, onChange }: SelectCellProps) {
  const [open, setOpen] = useState(false)

  const toggle = (id: string) => {
    if (multi) {
      onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
    } else {
      onChange(selected.includes(id) ? [] : [id])
      setOpen(false)
    }
  }

  const selectedOptions = options.filter(o => selected.includes(o.id))

  return (
    <div className="relative px-2 py-1.5 min-h-[34px]">
      <div
        className="flex flex-wrap gap-1 cursor-pointer min-h-[20px]"
        onClick={() => setOpen(v => !v)}
      >
        {selectedOptions.length > 0 ? (
          selectedOptions.map(opt => {
            const c = colorClasses(opt.color)
            return (
              <span key={opt.id} className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                {opt.label}
              </span>
            )
          })
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-44">
            {options.length === 0 ? (
              <p className="text-xs text-gray-400 px-2 py-1">No options configured.</p>
            ) : (
              options.map(opt => {
                const c = colorClasses(opt.color)
                const isSelected = selected.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggle(opt.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition ${isSelected ? 'bg-gray-50' : ''}`}
                  >
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text} flex-1 text-left`}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── PropertyMenu ─────────────────────────────────────────────────────────────

function PropertyMenu({
  onRename, onDelete, onClose,
}: { onRename: () => void; onDelete: () => void; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-1.5 w-40">
        <button
          onClick={onRename}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-gray-700 hover:bg-gray-50 transition text-left"
        >
          <Type size={12} className="text-gray-400" /> Rename
        </button>
        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-red-600 hover:bg-red-50 transition text-left"
        >
          <Trash2 size={12} /> Delete property
        </button>
      </div>
    </>
  )
}

// ─── BoardView (Kanban placeholder) ──────────────────────────────────────────

function BoardView({
  properties, rows, onUpdateCell,
}: {
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
  onUpdateCell: (rowId: string, propId: string, value: CellValue) => void
}) {
  const selectProp = properties.find(p => p.type === 'select')
  if (!selectProp) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Tag size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-medium text-gray-500">No select property found</p>
        <p className="text-xs mt-1">Add a <strong>Select</strong> property to enable board view.</p>
      </div>
    )
  }

  const options = selectProp.config?.options ?? []
  const unassigned = rows.filter(r => !r.cells[selectProp.id]?.selected?.length)
  const columns = [
    { id: 'unassigned', label: 'No status', color: 'gray', rows: unassigned },
    ...options.map(opt => ({
      id: opt.id,
      label: opt.label,
      color: opt.color,
      rows: rows.filter(r => r.cells[selectProp.id]?.selected?.includes(opt.id)),
    })),
  ]

  const nameProp = properties.find(p => p.type === 'text') ?? properties[0]

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(col => {
        const c = colorClasses(col.color)
        return (
          <div key={col.id} className="flex-shrink-0 w-60">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>{col.label}</span>
              <span className="text-xs text-gray-400">{col.rows.length}</span>
            </div>
            <div className="space-y-2">
              {col.rows.map(row => (
                <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition">
                  <p className="text-sm text-gray-800 font-medium">
                    {nameProp ? (row.cells[nameProp.id]?.text ?? 'Untitled') : 'Untitled'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DatabaseSkeleton() {
  return (
    <div className="px-6 pt-8 animate-pulse">
      <div className="h-7 w-48 bg-gray-200 rounded-lg mb-4" />
      <div className="h-4 w-24 bg-gray-100 rounded mb-6" />
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 h-10 flex gap-px">
          {[120, 140, 100, 120].map((w, i) => (
            <div key={i} className="h-full bg-gray-100" style={{ width: w }} />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 flex gap-px border-t border-gray-100">
            {[120, 140, 100, 120].map((w, j) => (
              <div key={j} className="h-full flex items-center px-3" style={{ width: w }}>
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
