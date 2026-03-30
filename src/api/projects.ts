/**
 * API клиент для работы с проектами
 */

import type { ProjectData, RoomData } from '../types';
import { logApiRequest, logApiSuccess, logApiError, logDebug } from '../utils/logger';

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
    version: apiProject.version,
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

const DEFAULT_TIMEOUT = 30000; // 30 секунд

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method || 'GET';
  const startTime = logApiRequest(method, endpoint, options.body ? JSON.parse(options.body as string) : undefined);
  
  const url = `${API_BASE}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
    logDebug('API', 'Токен авторизации добавлен в заголовки');
  } else {
    logDebug('API', 'Токен авторизации отсутствует');
  }

  // Создаём AbortController для timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      // При 401 пробуем обновить токен и повторить запрос
      if (response.status === 401 && endpoint !== '/api/auth/refresh') {
        logDebug('API', 'Получен 401, пробуем обновить токен');
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // Повторяем запрос с новым токеном
          const newToken = localStorage.getItem('token');
          if (newToken) {
            defaultHeaders['Authorization'] = `Bearer ${newToken}`;
          }
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...defaultHeaders,
              ...options.headers,
            },
          });
          const retryData = await retryResponse.json();
          if (!retryResponse.ok) {
            const error = new ProjectsApiError(
              retryData.message || 'Произошла ошибка',
              retryResponse.status
            );
            logApiError(method, endpoint, startTime, { 
              status: retryResponse.status, 
              message: retryData.message 
            });
            throw error;
          }
          logApiSuccess(method, endpoint, startTime, retryData);
          return retryData;
        }
      }
      
      const error = new ProjectsApiError(
        data.message || 'Произошла ошибка',
        response.status
      );
      logApiError(method, endpoint, startTime, { 
        status: response.status, 
        message: data.message,
        error: data 
      });
      throw error;
    }

    logApiSuccess(method, endpoint, startTime, data);
    return data;
  } catch (error) {
    if (error instanceof ProjectsApiError) {
      throw error;
    }
    // Обработка timeout/abort
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new ProjectsApiError(
        'Превышено время ожидания запроса',
        408
      );
      logApiError(method, endpoint, startTime, { timeout: true });
      throw timeoutError;
    }
    logApiError(method, endpoint, startTime, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Попытка обновления токена при 401 ошибке
 * Возвращает true если токен успешно обновлен
 */
async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    logDebug('API', 'Refresh token отсутствует, невозможно обновить');
    // Очищаем невалидные токены
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      logDebug('API', 'Не удалось обновить токен');
      // Очищаем невалидные токены
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      return false;
    }

    const data = await response.json();
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    logDebug('API', 'Токен успешно обновлен');
    return true;
  } catch (error) {
    logDebug('API', 'Ошибка при обновлении токена', error);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return false;
  }
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

/**
 * Синхронизация - получение всех проектов с комнатами
 */
export async function syncPull(): Promise<{ 
  status: string; 
  data: { 
    projects: (ApiProject & { rooms: ApiRoom[] })[]; 
    timestamp: number 
  } 
}> {
  return fetchJson<{ 
    status: string; 
    data: { 
      projects: (ApiProject & { rooms: ApiRoom[] })[]; 
      timestamp: number 
    } 
  }>('/api/sync/pull');
}

// Экспорт утилит для использования в других модулях
export { apiToClientProject, clientToApiProject };
