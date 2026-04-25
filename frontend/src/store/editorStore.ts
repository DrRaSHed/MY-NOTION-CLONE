import { create } from 'zustand';
import type { Block, Content, BlockProperties } from './types';
import { api } from '@/api/client';

interface EditorState {
  pageId: string | null;
  pageTitle: string;
  blocks: Block[];
  focusedBlockId: string | null;
  slashMenuOpen: boolean;
  slashMenuBlockId: string | null;

  setPageId: (pageId: string | null) => void;
  setPageTitle: (title: string) => void;
  setBlocks: (blocks: Block[]) => void;
  setFocusedBlock: (blockId: string | null) => void;
  openSlashMenu: (blockId: string) => void;
  closeSlashMenu: () => void;
  addBlock: (block: Block, afterId?: string) => void;
  updateBlock: (id: string, updates: { content?: Content; properties?: BlockProperties }) => void;
  deleteBlock: (id: string) => void;
  moveBlock: (id: string, newParentId: string | null, newPosition: number) => void;
  toggleBlock: (id: string) => void;
  fetchBlocks: (pageId: string) => Promise<void>;
  saveBlock: (block: Block) => Promise<void>;
  removeBlock: (id: string) => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, _get) => ({
  pageId: null,
  pageTitle: 'Untitled',
  blocks: [] as Block[],
  focusedBlockId: null,
  slashMenuOpen: false,
  slashMenuBlockId: null,

  setPageId: (pageId) => set({ pageId }),
  setPageTitle: (title) => set({ pageTitle: title }),
  setBlocks: (blocks) => set({ blocks }),
  setFocusedBlock: (blockId) => set({ focusedBlockId: blockId }),

  openSlashMenu: (blockId) => set({ slashMenuOpen: true, slashMenuBlockId: blockId }),
  closeSlashMenu: () => set({ slashMenuOpen: false, slashMenuBlockId: null }),

  addBlock: (block: Block, afterId?: string) => {
    set((state) => {
      if (!afterId) {
        return { blocks: [...state.blocks, block] };
      }
      const idx = state.blocks.findIndex((b) => b.id === afterId);
      if (idx === -1) {
        return { blocks: [...state.blocks, block] };
      }
      const newBlocks = [...state.blocks];
      newBlocks.splice(idx + 1, 0, block);
      return { blocks: newBlocks };
    });
  },

  updateBlock: (id, updates) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              content: updates.content ?? b.content,
              properties: updates.properties ?? b.properties,
            }
          : b
      ),
    }));
  },

  deleteBlock: (id) => {
    set((state) => ({
      blocks: state.blocks.filter((b) => b.id !== id && b.parentId !== id),
    }));
  },

  moveBlock: (id, newParentId, newPosition) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === id
          ? { ...b, parentId: newParentId === null ? undefined : newParentId, position: newPosition }
          : b
      ),
    }));
  },

  toggleBlock: (id) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === id
          ? { ...b, properties: { ...b.properties, checked: !b.properties.checked } }
          : b
      ),
    }));
  },

  fetchBlocks: async (pageId: string) => {
    try {
      const response = await api.get<Block[]>(`/blocks/page/${pageId}`);
      if (response.success && response.data) {
        set({ blocks: response.data });
      }
    } catch (err) {
      console.error('Failed to fetch blocks:', err);
    }
  },

  saveBlock: async (block: Block) => {
    try {
      const response = await api.put<Block>(`/blocks/${block.id}`, {
        content: block.content,
        properties: block.properties,
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to save block');
      }
    } catch (err) {
      console.error('Failed to save block:', err);
    }
  },

  removeBlock: async (id: string) => {
    try {
      await api.delete(`/blocks/${id}`);
    } catch (err) {
      console.error('Failed to delete block:', err);
    }
  },
}));
