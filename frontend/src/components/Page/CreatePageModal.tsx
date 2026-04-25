import { useState, useCallback } from 'react';

interface CreatePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { title?: string; isDatabase: boolean; databaseColumns?: string[] }) => void;
  parentId?: string;
}

const DEFAULT_DATABASE_COLUMNS = ['Name', 'Tags', 'Priority'];

export function CreatePageModal({ isOpen, onClose, onCreate }: CreatePageModalProps) {
  const [title, setTitle] = useState('');
  const [pageType, setPageType] = useState<'page' | 'database'>('page');
  const [columns, setColumns] = useState(DEFAULT_DATABASE_COLUMNS);
  const [newColumnName, setNewColumnName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      title: title || 'Untitled',
      isDatabase: pageType === 'database',
      databaseColumns: pageType === 'database' ? columns : undefined,
    });
    setTitle('');
    setPageType('page');
    setColumns(DEFAULT_DATABASE_COLUMNS);
    onClose();
  };

  const addColumn = () => {
    if (newColumnName.trim()) {
      setColumns([...columns, newColumnName.trim()]);
      setNewColumnName('');
    }
  };

  const removeColumn = (index: number) => {
    setColumns(columns.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">Create a new page</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title"
              className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
          </div>

          {/* Page Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
              Page type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPageType('page')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  pageType === 'page'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">📄</div>
                <div className="font-medium">Page</div>
                <div className="text-xs text-gray-500">Free-form editing</div>
              </button>
              
              <button
                type="button"
                onClick={() => setPageType('database')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  pageType === 'database'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">📊</div>
                <div className="font-medium">Database</div>
                <div className="text-xs text-gray-500">Table with properties</div>
              </button>
            </div>
          </div>

          {/* Database Columns (only show if database selected) */}
          {pageType === 'database' && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-400">
                Initial columns
              </label>
              <div className="space-y-2">
                {columns.map((col, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded text-xs flex items-center justify-center text-gray-500">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={col}
                      onChange={(e) => {
                        const newCols = [...columns];
                        newCols[index] = e.target.value;
                        setColumns(newCols);
                      }}
                      className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeColumn(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                <div className="flex items-center gap-2">
                  <span className="w-4" />
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColumn())}
                    placeholder="Add column..."
                    className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-700 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addColumn}
                    className="p-1 text-blue-500 hover:text-blue-600"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              Create {pageType === 'database' ? 'Database' : 'Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
