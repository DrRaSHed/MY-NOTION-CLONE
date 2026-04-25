import { api } from './client';
import type {
  Database,
  DatabaseRow,
  DatabaseProperty,
  CellValue,
  ApiResponse,
  PropertyType,
  PropertyConfig,
} from '../store/types';

export async function getDatabases(): Promise<ApiResponse<Database[]>> {
  return api.get<Database[]>('/databases');
}

export async function getDatabase(id: string): Promise<ApiResponse<Database>> {
  return api.get<Database>(`/databases/${id}`);
}

export async function createDatabase(data: {
  name?: string;
  properties?: Array<{
    name: string;
    type: PropertyType;
    config?: PropertyConfig;
  }>;
}): Promise<ApiResponse<Database>> {
  return api.post<Database>('/databases', data);
}

export async function updateDatabase(
  id: string,
  data: { name?: string }
): Promise<ApiResponse<Database>> {
  return api.put<Database>(`/databases/${id}`, data);
}

export async function deleteDatabase(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return api.delete<{ deleted: boolean }>(`/databases/${id}`);
}

export async function addProperty(
  databaseId: string,
  name: string,
  type: PropertyType,
  config?: PropertyConfig
): Promise<ApiResponse<DatabaseProperty>> {
  return api.post<DatabaseProperty>(`/databases/${databaseId}/properties`, {
    name,
    type,
    config,
  });
}

export async function createRow(
  databaseId: string,
  cells: Array<{ propertyId: string; value: CellValue }>
): Promise<ApiResponse<DatabaseRow>> {
  return api.post<DatabaseRow>(`/databases/${databaseId}/rows`, { cells });
}

export async function updateRow(
  databaseId: string,
  rowId: string,
  cells: Array<{ propertyId: string; value: CellValue }>
): Promise<ApiResponse<DatabaseRow>> {
  return api.put<DatabaseRow>(`/databases/${databaseId}/rows/${rowId}`, { cells });
}

export async function deleteRow(
  databaseId: string,
  rowId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  return api.delete<{ deleted: boolean }>(`/databases/${databaseId}/rows/${rowId}`);
}
