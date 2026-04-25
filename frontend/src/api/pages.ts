import { api } from './client';
import type { Page, ApiResponse } from '../store/types';

export async function getPages(): Promise<ApiResponse<Page[]>> {
  return api.get<Page[]>('/pages');
}

export async function getPageTree(): Promise<ApiResponse<Page[]>> {
  return api.get<Page[]>('/pages/tree');
}

export async function getPage(id: string): Promise<ApiResponse<Page>> {
  return api.get<Page>(`/pages/${id}`);
}

export async function createPage(data: {
  parentId?: string;
  title?: string;
}): Promise<ApiResponse<Page>> {
  return api.post<Page>('/pages', data);
}

export async function updatePage(
  id: string,
  data: {
    title?: string;
    icon?: string;
    coverUrl?: string;
    parentId?: string;
    position?: number;
  }
): Promise<ApiResponse<Page>> {
  return api.put<Page>(`/pages/${id}`, data);
}

export async function deletePage(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return api.delete<{ deleted: boolean }>(`/pages/${id}`);
}
