import { useState } from 'react'
import { Filter, ArrowUpDown, LayoutGrid, List, Search, Plus } from 'lucide-react'

export type ViewMode = 'table' | 'board'

interface SortConfig {
  propertyId: string
  direction: 'asc' | 'desc'
}

interface FilterConfig {
  propertyId: string
  value: string
}

interface DatabaseProperty {
  id: string
  name: string
  type: string
}

interface DatabaseToolbarProps {
  properties: DatabaseProperty[]
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onSortChange: (sort: SortConfig | null) => void
  onFilterChange: (filter: FilterConfig | null) => void
  onSearch: (query: string) => void
  onAddRow: () => void
}

export function DatabaseToolbar({
  properties,
  viewMode,
  onViewModeChange,
  onSortChange,
  onFilterChange,
  onSearch,
  onAddRow,
}: DatabaseToolbarProps) {
  const [showSort, setShowSort] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [sortProp, setSortProp] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterProp, setFilterProp] = useState('')
  const [filterValue, setFilterValue] = useState('')

  const handleSortApply = () => {
    if (sortProp) {
      onSortChange({ propertyId: sortProp, direction: sortDir })
    }
    setShowSort(false)
  }

  const handleFilterApply = () => {
    if (filterProp && filterValue) {
      onFilterChange({ propertyId: filterProp, value: filterValue })
    }
    setShowFilter(false)
  }

  const handleSearchChange = (val: string) => {
    setSearchValue(val)
    onSearch(val)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap relative">
      {/* View mode toggle */}
      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
        <button
          onClick={() => onViewModeChange('table')}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
            viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <List size={13} /> Table
        </button>
        <button
          onClick={() => onViewModeChange('board')}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
            viewMode === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <LayoutGrid size={13} /> Board
        </button>
      </div>

      <div className="flex-1" />

      {/* Search */}
      {showSearch ? (
        <div className="flex items-center border border-gray-200 rounded-lg px-2 py-1 bg-white gap-1.5">
          <Search size={13} className="text-gray-400" />
          <input
            autoFocus
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => { if (!searchValue) setShowSearch(false) }}
            placeholder="Search rows…"
            className="text-xs outline-none w-36 text-gray-800 placeholder-gray-400"
          />
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); onSearch(''); setShowSearch(false) }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ) : (
        <ToolbarBtn icon={<Search size={13} />} label="Search" onClick={() => setShowSearch(true)} />
      )}

      {/* Filter */}
      <div className="relative">
        <ToolbarBtn icon={<Filter size={13} />} label="Filter" onClick={() => { setShowFilter(v => !v); setShowSort(false) }} active={showFilter} />
        {showFilter && (
          <Popover onClose={() => setShowFilter(false)}>
            <p className="text-xs font-semibold text-gray-700 mb-3">Filter rows</p>
            <div className="space-y-2">
              <select
                value={filterProp}
                onChange={(e) => setFilterProp(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input
                type="text"
                placeholder="Contains…"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { onFilterChange(null); setFilterProp(''); setFilterValue(''); setShowFilter(false) }}
                  className="flex-1 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Clear
                </button>
                <button
                  onClick={handleFilterApply}
                  className="flex-1 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition"
                >
                  Apply
                </button>
              </div>
            </div>
          </Popover>
        )}
      </div>

      {/* Sort */}
      <div className="relative">
        <ToolbarBtn icon={<ArrowUpDown size={13} />} label="Sort" onClick={() => { setShowSort(v => !v); setShowFilter(false) }} active={showSort} />
        {showSort && (
          <Popover onClose={() => setShowSort(false)}>
            <p className="text-xs font-semibold text-gray-700 mb-3">Sort by</p>
            <div className="space-y-2">
              <select
                value={sortProp}
                onChange={(e) => setSortProp(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="flex gap-1.5">
                {(['asc', 'desc'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSortDir(d)}
                    className={`flex-1 py-1.5 text-xs rounded-md border transition ${
                      sortDir === d
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {d === 'asc' ? '↑ Ascending' : '↓ Descending'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { onSortChange(null); setSortProp(''); setShowSort(false) }}
                  className="flex-1 py-1 text-xs text-gray-500 hover:text-gray-700 transition"
                >
                  Clear
                </button>
                <button
                  onClick={handleSortApply}
                  className="flex-1 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition"
                >
                  Apply
                </button>
              </div>
            </div>
          </Popover>
        )}
      </div>

      {/* Add row */}
      <button
        onClick={onAddRow}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
      >
        <Plus size={13} /> New row
      </button>
    </div>
  )
}

function ToolbarBtn({
  icon, label, onClick, active,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
        active
          ? 'border-blue-400 bg-blue-50 text-blue-700'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function X({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-56">
        {children}
      </div>
    </>
  )
}
