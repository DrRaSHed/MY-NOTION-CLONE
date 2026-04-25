import { useState, useRef, useEffect } from 'react';

interface SlashMenuProps {
  onSelect: (type: string) => void;
  onClose: () => void;
}

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'Text', icon: '¶', description: 'Plain text block' },
  { type: 'heading', label: 'Heading 1', icon: 'H1', description: 'Large heading' },
  { type: 'heading', label: 'Heading 2', icon: 'H2', description: 'Medium heading', level: 2 },
  { type: 'heading', label: 'Heading 3', icon: 'H3', description: 'Small heading', level: 3 },
  { type: 'checkbox', label: 'To-do', icon: '☑', description: 'Checkbox item' },
  { type: 'toggle', label: 'Toggle', icon: '▶', description: 'Collapsible content' },
  { type: 'list', label: 'Bulleted list', icon: '•', description: 'Bulleted list item' },
  { type: 'code', label: 'Code', icon: '</>', description: 'Code block' },
  { type: 'image', label: 'Image', icon: '🖼', description: 'Embed an image' },
  { type: 'divider', label: 'Divider', icon: '—', description: 'Horizontal line' },
];

export function SlashMenu({ onSelect, onClose }: SlashMenuProps) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredTypes = BLOCK_TYPES.filter(
    (bt) =>
      bt.label.toLowerCase().includes(filter.toLowerCase()) ||
      bt.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredTypes.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredTypes.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredTypes[selectedIndex]) {
          onSelect(filteredTypes[selectedIndex].type);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <div
      ref={menuRef}
      className="slash-menu p-2"
      onKeyDown={handleKeyDown}
    >
      <div className="px-2 py-1 text-xs text-gray-400 uppercase">Basic blocks</div>
      
      <input
        type="text"
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded border-none outline-none mb-2"
        autoFocus
      />

      <div className="max-h-64 overflow-auto">
        {filteredTypes.map((bt, index) => (
          <div
            key={`${bt.type}-${bt.label}`}
            className={`slash-menu-item ${index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
            onClick={() => onSelect(bt.type)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-lg">
              {bt.icon}
            </span>
            <div>
              <div className="text-sm font-medium">{bt.label}</div>
              <div className="text-xs text-gray-400">{bt.description}</div>
            </div>
          </div>
        ))}

        {filteredTypes.length === 0 && (
          <div className="px-3 py-2 text-sm text-gray-400">No blocks found</div>
        )}
      </div>
    </div>
  );
}
