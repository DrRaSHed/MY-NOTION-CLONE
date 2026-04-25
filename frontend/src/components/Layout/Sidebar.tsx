import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import type { Page } from '@/store/types';

interface SidebarProps {
  pages: Page[];
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onDeletePage: (pageId: string) => void;
  activePageId?: string;
}

export function Sidebar({
  pages,
  onSelectPage,
  onCreatePage,
  onDeletePage,
  activePageId,
}: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 h-screen bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">Notion Clone</h1>
          <button
            onClick={() => onCreatePage()}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="New page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-auto p-2">
        <div className="text-xs text-gray-400 uppercase px-3 py-2">Pages</div>
        {pages.map((page) => (
          <PageItem
            key={page.id}
            page={page}
            level={0}
            activePageId={activePageId}
            expandedPages={expandedPages}
            onToggle={toggleExpanded}
            onSelect={onSelectPage}
            onCreate={onCreatePage}
            onDelete={onDeletePage}
          />
        ))}

        {pages.length === 0 && (
          <div className="px-3 py-2 text-sm text-gray-400">
            No pages yet.{' '}
            <button
              onClick={() => onCreatePage()}
              className="text-blue-500 hover:underline"
            >
              Create one
            </button>
          </div>
        )}
      </div>

      {/* User section */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.displayName || 'User'}</div>
            <div className="text-xs text-gray-400 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Logout"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

interface PageItemProps {
  page: Page;
  level: number;
  activePageId?: string;
  expandedPages: Set<string>;
  onToggle: (pageId: string) => void;
  onSelect: (pageId: string) => void;
  onCreate: (parentId: string) => void;
  onDelete: (pageId: string) => void;
}

function PageItem({
  page,
  level,
  activePageId,
  expandedPages,
  onToggle,
  onSelect,
  onCreate,
  onDelete,
}: PageItemProps) {
  const hasChildren = page.children && page.children.length > 0;
  const isExpanded = expandedPages.has(page.id);
  const isActive = page.id === activePageId;

  return (
    <div>
      <div
        className={`page-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
      >
        {/* Expand/collapse button */}
        <button
          onClick={() => hasChildren && onToggle(page.id)}
          className={`p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${!hasChildren ? 'invisible' : ''}`}
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Page icon */}
        <span className="text-sm">{page.icon || '📄'}</span>

        {/* Page title */}
        <span
          className="flex-1 truncate"
          onClick={() => onSelect(page.id)}
        >
          {page.title}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button
            onClick={() => onCreate(page.id)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Add page"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(page.id)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {page.children!.map((child) => (
            <PageItem
              key={child.id}
              page={child}
              level={level + 1}
              activePageId={activePageId}
              expandedPages={expandedPages}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreate={onCreate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
