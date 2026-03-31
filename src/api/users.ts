/**
 * Users API client
 * API endpoints для работы с профилем пользователя
 */

import { fetchJson } from './httpClient';

// Types
export interface ApiUser {
  id: string;
  email: string;
  name: string | null;
  is_premium: boolean;
  premium_expires_at: string | null;
  limits: {
    max_objects_per_project: number;
    max_projects: number;
    max_rooms_per_object: number;
  };
}

// ═══════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════

/**
 * Получение профиля текущего пользователя
 */
export async function getUserMe(): Promise<{ status: string; data: ApiUser }> {
  return fetchJson('/api/users/me');
}

/**
 * Обновление профиля пользователя
 */
export async function updateUserMe(data: {
  name?: string;
}): Promise<{ status: string; data: ApiUser }> {
  return fetchJson('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
