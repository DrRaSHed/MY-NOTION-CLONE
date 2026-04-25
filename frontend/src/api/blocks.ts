import { api } from './client';
import type { Block, Content, BlockProperties, ApiResponse } from '../store/types';

export async function getBlocksByPage(pageId: string): Promise<ApiResponse<Block[]>> {
  return api.get<Block[]>(`/blocks/page/${pageId}`);
}

export async function createBlock(data: {
  pageId: string;
  parentId?: string;
  type: string;
  content?: Content;
  properties?: BlockProperties;
  position?: number;
}): Promise<ApiResponse<Block>> {
  return api.post<Block>('/blocks', data);
}

export async function updateBlock(
  id: string,
  data: {
    content?: Content;
    properties?: BlockProperties;
    position?: number;
  }
): Promise<ApiResponse<Block>> {
  return api.put<Block>(`/blocks/${id}`, data);
}

export async function deleteBlock(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return api.delete<{ deleted: boolean }>(`/blocks/${id}`);
}

export async function reorderBlock(data: {
  blockId: string;
  newParentId?: string;
  newPosition: number;
}): Promise<ApiResponse<Block>> {
  return api.post<Block>('/blocks/reorder', data);
}
