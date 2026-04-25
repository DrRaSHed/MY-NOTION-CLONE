import { useMemo } from 'react'
import type { PresenceMember } from '../hooks/useRealtime'

// ─── Color palette — one per user slot ───────────────────────────────────────
const USER_COLORS = [
  { bg: 'bg-violet-500',  ring: 'ring-violet-300',  text: 'text-violet-500',  hex: '#7c3aed' },
  { bg: 'bg-rose-500',    ring: 'ring-rose-300',    text: 'text-rose-500',    hex: '#e11d48' },
  { bg: 'bg-amber-500',   ring: 'ring-amber-300',   text: 'text-amber-500',   hex: '#d97706' },
  { bg: 'bg-emerald-500', ring: 'ring-emerald-300', text: 'text-emerald-500', hex: '#059669' },
  { bg: 'bg-sky-500',     ring: 'ring-sky-300',     text: 'text-sky-500',     hex: '#0ea5e9' },
  { bg: 'bg-pink-500',    ring: 'ring-pink-300',    text: 'text-pink-500',    hex: '#ec4899' },
  { bg: 'bg-teal-500',    ring: 'ring-teal-300',    text: 'text-teal-500',    hex: '#14b8a6' },
  { bg: 'bg-orange-500',  ring: 'ring-orange-300',  text: 'text-orange-500',  hex: '#f97316' },
]

export function colorForIndex(idx: number) {
  return USER_COLORS[idx % USER_COLORS.length]
}

// ─── PresenceBar ──────────────────────────────────────────────────────────────

interface PresenceBarProps {
  members: PresenceMember[]
  /** The current user's clientId — we skip rendering them */
  selfClientId: string
  connected: boolean
  /** Max avatars before "+N more" */
  maxVisible?: number
}

export function PresenceBar({
  members,
  selfClientId,
  connected,
  maxVisible = 5,
}: PresenceBarProps) {
  const others = useMemo(
    () => members.filter(m => m.clientId !== selfClientId),
    [members, selfClientId]
  )

  const visible  = others.slice(0, maxVisible)
  const overflow = others.length - visible.length

  return (
    <div className="flex items-center gap-2.5">
      {/* Connection indicator */}
      <ConnectionDot connected={connected} />

      {/* Avatars */}
      {visible.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {visible.map((member, idx) => (
            <MemberAvatar key={member.clientId} member={member} colorIdx={idx} />
          ))}
          {overflow > 0 && (
            <div className="w-7 h-7 rounded-full bg-gray-200 ring-2 ring-white flex items-center justify-center text-xs font-semibold text-gray-600 z-0">
              +{overflow}
            </div>
          )}
        </div>
      )}

      {/* Nobody else here */}
      {others.length === 0 && connected && (
        <span className="text-xs text-gray-400">Only you</span>
      )}
    </div>
  )
}

// ─── MemberAvatar ─────────────────────────────────────────────────────────────

interface MemberAvatarProps {
  member: PresenceMember
  colorIdx: number
}

function MemberAvatar({ member, colorIdx }: MemberAvatarProps) {
  const color  = colorForIndex(colorIdx)
  const initials = getInitials(member.displayName)

  return (
    <div
      className={`relative w-7 h-7 rounded-full ${color.bg} ring-2 ring-white flex items-center justify-center cursor-default select-none`}
      title={member.displayName}
      style={{ zIndex: 10 - colorIdx }}
    >
      <span className="text-white text-xs font-semibold leading-none">{initials}</span>
      {/* Online pulse dot */}
      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-1 ring-white" />
    </div>
  )
}

// ─── ConnectionDot ────────────────────────────────────────────────────────────

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5" title={connected ? 'Live' : 'Reconnecting…'}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-amber-400'} ${connected ? 'animate-pulse' : ''}`} />
      <span className={`text-xs ${connected ? 'text-green-600' : 'text-amber-600'}`}>
        {connected ? 'Live' : 'Reconnecting'}
      </span>
    </div>
  )
}

// ─── Tooltip (member list on hover) ──────────────────────────────────────────

interface PresenceTooltipProps {
  members: PresenceMember[]
  selfClientId: string
}

export function PresenceTooltip({ members, selfClientId }: PresenceTooltipProps) {
  const others = members.filter(m => m.clientId !== selfClientId)
  if (others.length === 0) return null

  return (
    <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-48">
      <p className="text-xs font-medium text-gray-500 px-2 pb-1 mb-1 border-b border-gray-100">
        {others.length} viewer{others.length !== 1 ? 's' : ''}
      </p>
      {others.map((member, idx) => {
        const c = colorForIndex(idx)
        return (
          <div key={member.clientId} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50">
            <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center shrink-0`}>
              <span className="text-white text-xs font-semibold">{getInitials(member.displayName)}</span>
            </div>
            <span className="text-sm text-gray-700 truncate">{member.displayName}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Cursor overlay (renders colored cursors from other users) ────────────────

interface CursorOverlayProps {
  members: PresenceMember[]
  selfClientId: string
}

/**
 * Renders a colored block-highlight for each member who has an active cursor.
 * Place this inside the editor container (position: relative).
 * Each member's cursorPosition.blockId should match a block element's data-block-id attribute.
 */
export function CursorOverlay({ members, selfClientId }: CursorOverlayProps) {
  const others = members.filter(m => m.clientId !== selfClientId && m.cursorPosition)

  return (
    <>
      {others.map((member, idx) => {
        const color = colorForIndex(idx)
        const blockEl = member.cursorPosition?.blockId
          ? document.querySelector(`[data-block-id="${member.cursorPosition.blockId}"]`)
          : null

        if (!blockEl) return null

        const rect = blockEl.getBoundingClientRect()
        const parentRect = blockEl.closest('[data-editor-root]')?.getBoundingClientRect()

        if (!parentRect) return null

        const top  = rect.top  - parentRect.top
        const left = rect.left - parentRect.left

        return (
          <div
            key={member.clientId}
            className="absolute pointer-events-none"
            style={{ top, left, width: rect.width, height: rect.height, zIndex: 50 }}
          >
            {/* Highlight bar */}
            <div
              className="absolute inset-0 rounded opacity-10"
              style={{ backgroundColor: color.hex }}
            />
            {/* Name tag */}
            <div
              className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs text-white font-medium whitespace-nowrap"
              style={{ backgroundColor: color.hex }}
            >
              {member.displayName}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
