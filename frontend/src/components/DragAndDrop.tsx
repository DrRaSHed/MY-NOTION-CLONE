/**
 * Drag-and-drop utilities for both database rows and editor blocks.
 * Uses @dnd-kit/core + @dnd-kit/sortable.
 *
 * Install: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
 */

import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE ROW DRAG-AND-DROP
// ═══════════════════════════════════════════════════════════════════════════════

export interface SortableRowItem {
  id: string
  [key: string]: unknown
}

interface SortableRowListProps<T extends SortableRowItem> {
  items: T[]
  onReorder: (items: T[]) => void
  onReorderEnd: (items: T[]) => void   // fires when drag ends — call the API here
  renderRow: (item: T, dragHandleProps: DragHandleProps) => React.ReactNode
  overlayRender?: (item: T) => React.ReactNode
}

export interface DragHandleProps {
  ref: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  [key: string]: unknown
}

/**
 * Wraps a list of database rows in sortable DnD context.
 * Usage:
 *
 *   <SortableRowList
 *     items={rows}
 *     onReorder={setRows}
 *     onReorderEnd={persistRowOrder}
 *     renderRow={(row, handle) => <tr><td><DragHandle {...handle} />...</td></tr>}
 *   />
 */
export function SortableRowList<T extends SortableRowItem>({
  items,
  onReorder,
  onReorderEnd,
  renderRow,
  overlayRender,
}: SortableRowListProps<T>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const activeItem = items.find(i => i.id === activeId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex)
    onReorder(reordered)
    onReorderEnd(reordered)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(item => (
          <SortableRowWrapper key={item.id} id={item.id} renderRow={(handle) => renderRow(item, handle)} />
        ))}
      </SortableContext>

      <DragOverlay>
        {activeItem && overlayRender ? (
          overlayRender(activeItem)
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface SortableRowWrapperProps {
  id: string
  renderRow: (handle: DragHandleProps) => React.ReactNode
}

function SortableRowWrapper({ id, renderRow }: SortableRowWrapperProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 'auto',
  }

  const handle: DragHandleProps = {
    ref: setActivatorNodeRef,
    style: { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' },
    ...attributes,
    ...listeners,
  }

  return (
    <tr ref={setNodeRef} style={style}>
      {renderRow(handle) as any}
    </tr>
  )
}

/** Standalone drag handle knob you can drop anywhere in your row */
export function RowDragHandle({ handleProps }: { handleProps: DragHandleProps }) {
  const { ref, ...rest } = handleProps
  return (
    <div ref={ref as any} {...rest} className="flex items-center justify-center text-gray-300 hover:text-gray-500 transition px-1 cursor-grab active:cursor-grabbing">
      <GripVertical size={14} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK EDITOR DRAG-AND-DROP
// ═══════════════════════════════════════════════════════════════════════════════

export interface BlockItem {
  id: string
  type: string
  content: { text: string; [key: string]: unknown }
  children: BlockItem[]
  [key: string]: unknown
}

interface BlockDndContextProps {
  blocks: BlockItem[]
  onReorder: (blocks: BlockItem[]) => void
  onReorderEnd: (movedId: string, newIndex: number) => void
  children: React.ReactNode
}

/**
 * Wraps the block editor in a DnD context.
 * Each individual block should be wrapped in <SortableBlock>.
 */
export function BlockDndContext({ blocks, onReorder, onReorderEnd, children }: BlockDndContextProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over || active.id === over.id) return

    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(blocks, oldIndex, newIndex)
    onReorder(reordered)
    onReorderEnd(String(active.id), newIndex)
  }

  const activeBlock = blocks.find(b => b.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {activeBlock && (
          <div className="bg-white border border-blue-200 rounded-lg px-4 py-2 shadow-lg text-sm text-gray-700 opacity-90 max-w-2xl">
            {activeBlock.content?.text || <span className="text-gray-400 italic">{activeBlock.type}</span>}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

interface SortableBlockProps {
  id: string
  children: (props: {
    isDragging: boolean
    dragHandleProps: React.HTMLAttributes<HTMLElement> & { ref: (n: HTMLElement | null) => void }
  }) => React.ReactNode
}

/**
 * Wrap each block in this component inside <BlockDndContext>.
 *
 * Usage:
 *   <SortableBlock id={block.id}>
 *     {({ isDragging, dragHandleProps }) => (
 *       <div className={isDragging ? 'opacity-40' : ''}>
 *         <DragHandle {...dragHandleProps} />
 *         <BlockContent block={block} />
 *       </div>
 *     )}
 *   </SortableBlock>
 */
export function SortableBlock({ id, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        isDragging,
        dragHandleProps: {
          ref: setActivatorNodeRef,
          style: { cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' },
          ...attributes,
          ...listeners,
        },
      })}
    </div>
  )
}

/** Block drag handle icon */
export function BlockDragHandle({
  dragHandleProps,
}: {
  dragHandleProps: React.HTMLAttributes<HTMLElement> & { ref: (n: HTMLElement | null) => void }
}) {
  const { ref, ...rest } = dragHandleProps
  return (
    <div
      ref={ref}
      {...rest}
      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-6 text-gray-400 hover:text-gray-600 transition cursor-grab active:cursor-grabbing shrink-0"
    >
      <GripVertical size={14} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: useRowReorder — API persistence for row reordering
// ═══════════════════════════════════════════════════════════════════════════════

export function useRowReorder(databaseId: string) {
  return useCallback(async (reorderedRows: SortableRowItem[]) => {
    const token = localStorage.getItem('token')
    try {
      await fetch(`/api/v1/databases/${databaseId}/rows/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          order: reorderedRows.map((r, i) => ({ id: r.id, position: i })),
        }),
      })
    } catch (err) {
      console.error('[DnD] Failed to persist row order', err)
    }
  }, [databaseId])
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: useBlockReorder — API persistence for block reordering
// ═══════════════════════════════════════════════════════════════════════════════

export function useBlockReorder(pageId: string) {
  return useCallback(async (blockId: string, newPosition: number, newParentId?: string | null) => {
    const token = localStorage.getItem('token')
    try {
      await fetch('/api/v1/blocks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blockId, newPosition, newParentId: newParentId ?? null, pageId }),
      })
    } catch (err) {
      console.error('[DnD] Failed to persist block order', err)
    }
  }, [pageId])
}
