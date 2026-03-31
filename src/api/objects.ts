/**
 * Objects API client
 * API endpoints для работы с объектами недвижимости
 */

import { fetchJson } from './httpClient';

// Types
export interface ApiObject {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  city: string | null;
  address: string | null;
  use_ai_pricing: boolean;
  last_ai_price_update: string | null;
  version: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ApiObjectWithRooms extends ApiObject {
  rooms: any[];
}

// ═══════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════

/**
 * Создание объекта в проекте
 */
export async function createObject(
  projectId: string,
  data: {
    name: string;
    city?: string;
    address?: string;
    use_ai_pricing?: boolean;
  }
): Promise<{ status: string; data: ApiObject }> {
  return fetchJson(`/api/projects/${projectId}/objects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Список всех объектов пользователя
 */
export async function getObjects(): Promise<{ status: string; data: ApiObject[] }> {
  return fetchJson('/api/objects');
}

/**
 * Получение объекта с комнатами
 */
export async function getObject(id: string): Promise<{ status: string; data: ApiObjectWithRooms }> {
  return fetchJson(`/api/objects/${id}`);
}

/**
 * Обновление объекта
 */
export async function updateObject(
  id: string,
  data: {
    name?: string;
    city?: string | null;
    address?: string | null;
    use_ai_pricing?: boolean;
    last_ai_price_update?: string | null;
    sort_order?: number;
  }
): Promise<{ status: string; data: ApiObject }> {
  return fetchJson(`/api/objects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Удаление объекта
 */
export async function deleteObject(id: string): Promise<{ status: string; message: string }> {
  return fetchJson(`/api/objects/${id}`, {
    method: 'DELETE',
  });
}
