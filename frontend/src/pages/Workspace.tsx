import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar } from '@/components/Layout/Sidebar';
import { Editor } from '@/components/Editor/Editor';
import { CreatePageModal } from '@/components/Page/CreatePageModal';
import { getPageTree, createPage, deletePage } from '@/api/pages';
import { createDatabase } from '@/api/databases';
import { useEditorStore } from '@/store/editorStore';
import type { Page } from '@/store/types';

export function Workspace() {
  const params = useParams();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { pageId, setPageId, fetchBlocks } = useEditorStore();

  const loadPages = useCallback(async () => {
    try {
      const response = await getPageTree();
      if (response.success && response.data) {
        setPages(response.data);
      }
    } catch (error) {
      console.error('Failed to load pages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    if (params.pageId) {
      setPageId(params.pageId);
      fetchBlocks(params.pageId);
    }
  }, [params.pageId, setPageId, fetchBlocks]);

  const handleSelectPage = useCallback(async (newPageId: string) => {
    setPageId(newPageId);
    await fetchBlocks(newPageId);
    window.history.pushState({}, '', `/page/${newPageId}`);
  }, [setPageId, fetchBlocks]);

  const handleCreatePage = useCallback((parentId?: string) => {
    setShowCreateModal(true);
  }, []);

  const handleConfirmCreate = useCallback(async (data: {
    title?: string;
    isDatabase: boolean;
    databaseColumns?: string[];
  }) => {
    try {
      if (data.isDatabase) {
        // Create database with columns
        const properties = data.databaseColumns?.map((name, index) => ({
          name,
          type: 'text' as const,
          config: {},
        })) || [];

        const dbResponse = await createDatabase({
          name: data.title,
          properties,
        });

        if (dbResponse.success && dbResponse.data) {
          await loadPages();
          window.history.pushState({}, '', `/database/${dbResponse.data.id}`);
        }
      } else {
        // Create regular page
        const response = await createPage({ title: data.title });
        if (response.success && response.data) {
          await loadPages();
          handleSelectPage(response.data.id);
        }
      }
    } catch (error) {
      console.error('Failed to create page:', error);
    }
    setShowCreateModal(false);
  }, [loadPages, handleSelectPage]);

  const handleDeletePage = useCallback(async (pageIdToDelete: string) => {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    
    try {
      await deletePage(pageIdToDelete);
      await loadPages();
      if (pageId === pageIdToDelete) {
        setPageId(null);
        window.history.pushState({}, '', '/');
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
    }
  }, [loadPages, pageId, setPageId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar
        pages={pages}
        onSelectPage={handleSelectPage}
        onCreatePage={handleCreatePage}
        onDeletePage={handleDeletePage}
        activePageId={pageId || undefined}
      />
      <Editor />
      
      <CreatePageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleConfirmCreate}
      />
    </div>
  );
}
