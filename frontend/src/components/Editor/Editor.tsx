import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/store/editorStore';
import type { Block, Content, BlockProperties } from '@/store/types';
import { nanoid } from 'nanoid';
import { SlashMenu } from './SlashMenu';
import { TableBlock } from './TableBlock';

export function Editor() {
  const {
    pageId,
    pageTitle,
    blocks,
    slashMenuOpen,
    slashMenuBlockId,
    setPageTitle,
    openSlashMenu,
    closeSlashMenu,
    addBlock,
    updateBlock,
    deleteBlock,
    setFocusedBlock,
    setBlocks,
  } = useEditorStore();

  // Create initial block when page loads with no blocks
  useEffect(() => {
    if (pageId && blocks.length === 0) {
      const initialBlock: Block = {
        id: nanoid(),
        pageId,
        type: 'paragraph',
        content: { text: '' },
        properties: {},
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        children: [],
      };
      setBlocks([initialBlock]);
    }
  }, [pageId, blocks.length, setBlocks]);

  const handleCreateBlock = useCallback(
    (type: string, afterId: string) => {
      const newBlock: Block = {
        id: nanoid(),
        pageId: pageId || '',
        type: type as Block['type'],
        content: { text: '' },
        properties: {},
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        children: [],
      };

      addBlock(newBlock, afterId);
      closeSlashMenu();
      setFocusedBlock(newBlock.id);
    },
    [pageId, addBlock, closeSlashMenu, setFocusedBlock]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, blockId: string) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        openSlashMenu(blockId);
      }
      if (e.key === 'Escape') {
        closeSlashMenu();
      }
    },
    [openSlashMenu, closeSlashMenu]
  );

  if (!pageId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Select a page to start editing</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto py-12 px-8">
        {/* Page Title */}
        <div className="mb-8">
          <input
            type="text"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-600"
          />
        </div>

        {/* Blocks */}
        <div className="space-y-1">
          {blocks.map((block) => (
            <BlockComponent
              key={block.id}
              block={block}
              onKeyDown={(e) => handleKeyDown(e, block.id)}
              onUpdateBlock={(id, updates) => updateBlock(id, updates)}
              onDelete={() => deleteBlock(block.id)}
              onFocus={() => setFocusedBlock(block.id)}
              onCreateAfter={(type) => handleCreateBlock(type, block.id)}
            />
          ))}
        </div>

        {/* Slash Menu */}
        {slashMenuOpen && slashMenuBlockId && (
          <SlashMenu
            onSelect={(type) => handleCreateBlock(type, slashMenuBlockId)}
            onClose={closeSlashMenu}
          />
        )}
      </div>
    </div>
  );
}

function BlockComponent({
  block,
  onKeyDown,
  onUpdateBlock,
  onDelete,
  onFocus,
  onCreateAfter,
}: {
  block: Block;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onUpdateBlock: (id: string, updates: { content?: Content; properties?: BlockProperties }) => void;
  onDelete: () => void;
  onFocus: () => void;
  onCreateAfter: (type: string) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const blocksLength = useEditorStore((s) => s.blocks.length);
  const isInitialized = useRef(false);

  // Initialize content on mount
  useEffect(() => {
    if (contentRef.current && !isInitialized.current) {
      contentRef.current.textContent = block.content?.text || '';
      isInitialized.current = true;
    }
  }, [block.id, block.content?.text]);

  const handleInput = useCallback(() => {
    const text = contentRef.current?.textContent || '';
    onUpdateBlock(block.id, { content: { text } });
  }, [onUpdateBlock, block.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onCreateAfter('paragraph');
      }
      if (e.key === 'Backspace') {
        const text = contentRef.current?.textContent || '';
        if (text === '' && blocksLength > 1) {
          e.preventDefault();
          onDelete();
        }
      }
      onKeyDown(e);
    },
    [onKeyDown, onDelete, onCreateAfter, blocksLength]
  );

  const renderBlockContent = () => {
    switch (block.type) {
      case 'heading': {
        const level = block.properties?.level || 1;
        const headingClass = level === 1 ? 'text-3xl' : level === 2 ? 'text-2xl' : 'text-xl';
        const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
        return (
          <Tag className={`font-bold ${headingClass}`}>
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              className="outline-none"
            />
          </Tag>
        );
      }

      case 'checkbox':
        return (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={block.properties?.checked || false}
              onChange={() => {
                onUpdateBlock(block.id, { properties: { ...block.properties, checked: !block.properties?.checked } });
              }}
              className="mt-1 w-4 h-4 rounded border-gray-300"
            />
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              className={`flex-1 outline-none ${block.properties?.checked ? 'line-through text-gray-400' : ''}`}
            />
          </div>
        );

      case 'code':
        return (
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <code
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              className="outline-none w-full block whitespace-pre"
            />
          </pre>
        );

      case 'divider':
        return <hr className="border-t border-gray-200 dark:border-gray-700 my-2" />;

      case 'toggle':
        return (
          <div>
            <details open={block.properties?.expanded}>
              <summary className="cursor-pointer list-none flex items-center gap-2">
                <span className="text-gray-400">{block.properties?.expanded ? '▼' : '▶'}</span>
                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleInput}
                  onKeyDown={handleKeyDown}
                  onFocus={onFocus}
                  className="flex-1 outline-none"
                />
              </summary>
            </details>
          </div>
        );

      case 'list':
        return (
          <div className="flex items-start gap-2">
            <span className="text-gray-400">
              {block.properties?.listType === 'numbered' ? (
                <span className="text-sm">{block.position + 1}.</span>
              ) : (
                '•'
              )}
            </span>
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              className="flex-1 outline-none"
            />
          </div>
        );

      case 'table':
        return (
          <TableBlock
            properties={block.properties || {}}
            onUpdate={(props) => onUpdateBlock(block.id, { properties: props })}
          />
        );

      case 'image':
        return block.properties?.url ? (
          <div className="rounded-lg overflow-hidden">
            <img
              src={block.properties.url}
              alt={block.content?.text || 'Image'}
              className="max-w-full h-auto"
            />
            {block.content?.text && (
              <p className="text-sm text-gray-500 mt-1 text-center">{block.content.text}</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            <input
              type="text"
              placeholder="Paste image URL..."
              className="w-full bg-transparent border-none outline-none text-center"
            />
          </div>
        );

      default:
        return (
          <div
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            className="outline-none min-h-[1.5em] whitespace-pre-wrap"
          />
        );
    }
  };

  return (
    <div className="group relative py-1 px-2 -mx-2 rounded cursor-text hover:bg-black/5 dark:hover:bg-white/5">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-0.5">
          <span className="block w-1 h-1 bg-gray-400 rounded-full" />
          <span className="block w-1 h-1 bg-gray-400 rounded-full" />
          <span className="block w-1 h-1 bg-gray-400 rounded-full" />
        </div>
      </div>
      {renderBlockContent()}
    </div>
  );
}
