import { useState, useCallback } from 'react';
import type { BlockProperties } from '@/store/types';

interface TableBlockProps {
  properties: BlockProperties;
  onUpdate: (properties: BlockProperties) => void;
}

type ColumnType = 'text' | 'number' | 'date' | 'select' | 'checkbox';

interface Column {
  id: string;
  name: string;
  type: ColumnType;
  width: number;
}

interface Row {
  id: string;
  cells: Record<string, string>;
}

export function TableBlock({ properties, onUpdate }: TableBlockProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [columns, setColumns] = useState<Column[]>(
    properties.tableColumns || [
      { id: 'col-1', name: 'Column 1', type: 'text', width: 150 },
      { id: 'col-2', name: 'Column 2', type: 'text', width: 150 },
    ]
  );
  const [rows, setRows] = useState<Row[]>(
    properties.tableRows || [
      { id: 'row-1', cells: { 'col-1': '', 'col-2': '' } },
      { id: 'row-2', cells: { 'col-1': '', 'col-2': '' } },
    ]
  );

  const updateColumns = useCallback((newColumns: Column[]) => {
    const updatedColumns = [...newColumns];
    setColumns(updatedColumns);
    onUpdate({ ...properties, tableColumns: updatedColumns, tableRows: rows });
  }, [properties, onUpdate, rows]);

  const updateRows = useCallback((newRows: Row[]) => {
    setRows(newRows);
    onUpdate({ ...properties, tableColumns: columns, tableRows: newRows });
  }, [properties, onUpdate, columns]);

  const addColumn = () => {
    const newCol: Column = {
      id: `col-${Date.now()}`,
      name: `Column ${columns.length + 1}`,
      type: 'text',
      width: 150,
    };
    const newColumns = [...columns, newCol];
    // Add cell to all rows
    const newRows = rows.map(row => ({
      ...row,
      cells: { ...row.cells, [newCol.id]: '' },
    }));
    updateColumns(newColumns);
    updateRows(newRows);
  };

  const addRow = () => {
    const newRow: Row = {
      id: `row-${Date.now()}`,
      cells: columns.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {}),
    };
    updateRows([...rows, newRow]);
  };

  const deleteColumn = (colId: string) => {
    if (columns.length <= 1) return;
    const newColumns = columns.filter(c => c.id !== colId);
    const newRows = rows.map(row => {
      const { [colId]: _, ...rest } = row.cells;
      return { ...row, cells: rest };
    });
    updateColumns(newColumns);
    updateRows(newRows);
  };

  const deleteRow = (rowId: string) => {
    if (rows.length <= 1) return;
    updateRows(rows.filter(r => r.id !== rowId));
  };

  const updateCell = (rowId: string, colId: string, value: string) => {
    const newRows = rows.map(row =>
      row.id === rowId ? { ...row, cells: { ...row.cells, [colId]: value } } : row
    );
    updateRows(newRows);
  };

  const updateColumnName = (colId: string, name: string) => {
    const newColumns = columns.map(c => c.id === colId ? { ...c, name } : c);
    updateColumns(newColumns);
  };

  const updateColumnType = (colId: string, type: ColumnType) => {
    const newColumns = columns.map(c => c.id === colId ? { ...c, type } : c);
    updateColumns(newColumns);
  };

  const columnTypeLabels: Record<ColumnType, { label: string; icon: string }> = {
    text: { label: 'Text', icon: 'T' },
    number: { label: 'Number', icon: '#' },
    date: { label: 'Date', icon: '📅' },
    select: { label: 'Select', icon: '▼' },
    checkbox: { label: 'Checkbox', icon: '☑' },
  };

  return (
    <div className="my-4">
      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Table Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Column Settings */}
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Columns</label>
            <div className="mt-2 space-y-2 max-h-40 overflow-auto">
              {columns.map((col, index) => (
                <div key={col.id} className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-gray-200 dark:bg-gray-600 rounded text-xs flex items-center justify-center text-gray-500">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={col.name}
                    onChange={(e) => updateColumnName(col.id, e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-700"
                    placeholder="Column name"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => updateColumnType(col.id, e.target.value as ColumnType)}
                    className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-700"
                  >
                    {Object.entries(columnTypeLabels).map(([type, { label }]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={col.width}
                    onChange={(e) => {
                      const newColumns = columns.map(c =>
                        c.id === col.id ? { ...c, width: parseInt(e.target.value) || 150 } : c
                      );
                      updateColumns(newColumns);
                    }}
                    className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-700"
                    title="Width (px)"
                  />
                  <button
                    onClick={() => deleteColumn(col.id)}
                    className="p-1 text-gray-400 hover:text-red-500"
                    disabled={columns.length <= 1}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addColumn}
              className="mt-2 text-sm text-blue-500 hover:text-blue-600"
            >
              + Add column
            </button>
          </div>

          {/* Row Settings */}
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Rows: {rows.length}</label>
            <button
              onClick={addRow}
              className="mt-2 ml-4 text-sm text-blue-500 hover:text-blue-600"
            >
              + Add row
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="db-header px-3 py-2 text-left text-sm font-medium border-r border-gray-200 dark:border-gray-700"
                  style={{ minWidth: col.width, width: col.width }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded flex items-center justify-center text-xs bg-gray-200 dark:bg-gray-600 ${
                      col.type === 'text' ? '' :
                      col.type === 'number' ? 'font-mono' : ''
                    }`}>
                      {columnTypeLabels[col.type]?.icon}
                    </span>
                    <span className="flex-1">{col.name}</span>
                  </div>
                </th>
              ))}
              <th className="w-10">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-600"
                  title="Table settings"
                >
                  ⚙️
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className="db-cell px-3 py-2 text-sm border-r border-gray-100 dark:border-gray-800"
                    style={{ minWidth: col.width, width: col.width }}
                  >
                    {col.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={row.cells[col.id] === 'true'}
                        onChange={(e) => updateCell(row.id, col.id, e.target.checked ? 'true' : 'false')}
                        className="w-4 h-4"
                      />
                    ) : col.type === 'select' ? (
                      <select
                        value={row.cells[col.id] || ''}
                        onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                        className="w-full bg-transparent border-none outline-none"
                      >
                        <option value="">Select...</option>
                        <option value="Option 1">Option 1</option>
                        <option value="Option 2">Option 2</option>
                      </select>
                    ) : (
                      <input
                        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                        value={row.cells[col.id] || ''}
                        onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                        className="w-full bg-transparent border-none outline-none"
                        placeholder="..."
                      />
                    )}
                  </td>
                ))}
                <td className="w-10">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="w-full h-full flex items-center justify-center text-gray-300 hover:text-red-500"
                    disabled={rows.length <= 1}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Add row button */}
      <button
        onClick={addRow}
        className="mt-2 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
      >
        + Add row
      </button>
    </div>
  );
}
