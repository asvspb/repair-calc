/**
 * API клиент для работы с проектами
 */

import type { ProjectData, RoomData } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3993';

export class ProjectsApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'ProjectsApiError';
  }
}

interface ApiProject {
  id: string;
  user_id: string;
  name: string;
  city: string | null;
  use_ai_pricing: boolean;
  last_ai_price_update: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  rooms?: ApiRoom[];
}

interface ApiRoom {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  geometry_mode: 'simple' | 'extended' | 'advanced';
  length: number;
  width: number;
  height: number;
  segments: string | null;
  obstacles: string | null;
  wall_sections: string | null;
  sub_sections: string | null;
  windows: string | null;
  doors: string | null;
  works: string | null;
  simple_mode_data: string | null;
  extended_mode_data: string | null;
  advanced_mode_data: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Преобразование проекта из API формата в клиентский
 */
function apiToClientProject(apiProject: ApiProject): ProjectData {
  return {
    id: apiProject.id,
    name: apiProject.name,
    city: apiProject.city || undefined,
    useAiPricing: apiProject.use_ai_pricing,
    lastAiPriceUpdate: apiProject.last_ai_price_update || undefined,
    rooms: (apiProject.rooms || []).map(apiToClientRoom),
  };
}

/**
 * Преобразование комнаты из API формата в клиентский
 */
function apiToClientRoom(apiRoom: ApiRoom): RoomData {
  return {
    id: apiRoom.id,
    name: apiRoom.name,
    geometryMode: apiRoom.geometry_mode,
    length: apiRoom.length,
    width: apiRoom.width,
    height: apiRoom.height,
    segments: parseJSON(apiRoom.segments, []),
    obstacles: parseJSON(apiRoom.obstacles, []),
    wallSections: parseJSON(apiRoom.wall_sections, []),
    subSections: parseJSON(apiRoom.sub_sections, []),
    windows: parseJSON(apiRoom.windows, []),
    doors: parseJSON(apiRoom.doors, []),
    works: parseJSON(apiRoom.works, []),
    simpleModeData: parseJSON(apiRoom.simple_mode_data, undefined),
    extendedModeData: parseJSON(apiRoom.extended_mode_data, undefined),
    advancedModeData: parseJSON(apiRoom.advanced_mode_data, undefined),
  };
}

/**
 * Преобразование проекта из клиентского формата в API
 */
function clientToApiProject(project: ProjectData, userId: string): Partial<ApiProject> {
  return {
    name: project.name,
    city: project.city || null,
    use_ai_pricing: project.useAiPricing || false,
    last_ai_price_update: project.lastAiPriceUpdate || null,
  };
}

/**
 * Безопасный парсинг JSON
 */
function parseJSON<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ProjectsApiError(
      data.message || 'Произошла ошибка',
      response.status
    );
  }

  return data;
}

/**
 * Получение списка проектов пользователя
 */
export async function getProjects(): Promise<{ status: string; data: ApiProject[] }> {
  return fetchJson<{ status: string; data: ApiProject[] }>('/api/projects');
}

/**
 * Получение проекта по ID с комнатами
 */
export async function getProject(id: string): Promise<{ status: string; data: ApiProject & { rooms: ApiRoom[] } }> {
  return fetchJson<{ status: string; data: ApiProject & { rooms: ApiRoom[] } }>(`/api/projects/${id}`);
}

/**
 * Создание нового проекта
 */
export async function createProject(data: { name: string; city?: string; use_ai_pricing?: boolean }): Promise<{ status: string; data: ApiProject }> {
  return fetchJson<{ status: string; data: ApiProject }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Обновление проекта
 */
export async function updateProject(
  id: string,
  data: { name?: string; city?: string | null; use_ai_pricing?: boolean; last_ai_price_update?: string | null }
): Promise<{ status: string; data: ApiProject }> {
  return fetchJson<{ status: string; data: ApiProject }>(`/api/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Удаление проекта
 */
export async function deleteProject(id: string): Promise<{ status: string; message: string }> {
  return fetchJson<{ status: string; message: string }>(`/api/projects/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Обновление настроек AI для проекта
 */
export async function updateAiSettings(
  id: string,
  data: { use_ai_pricing: boolean; city?: string }
): Promise<{ status: string; data: ApiProject }> {
  return fetchJson<{ status: string; data: ApiProject }>(`/api/projects/${id}/ai-settings`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Экспорт утилит для использования в других модулях
export { apiToClientProject, clientToApiProject };