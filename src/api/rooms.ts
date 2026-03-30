/**
 * API клиент для работы с комнатами
 */

import type { RoomData, Opening, RoomSegment, Obstacle, WallSection, RoomSubSection, WorkData } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3993';

export class RoomsApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'RoomsApiError';
  }
}

interface ApiRoom {
  id: string;
  project_id: string;
  name: string;
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
 * Преобразование комнаты из клиентского формата в API для сохранения
 */
function clientToApiRoom(room: RoomData): Partial<ApiRoom> {
  return {
    name: room.name,
    geometry_mode: room.geometryMode,
    length: room.length,
    width: room.width,
    height: room.height,
    segments: JSON.stringify(room.segments || []),
    obstacles: JSON.stringify(room.obstacles || []),
    wall_sections: JSON.stringify(room.wallSections || []),
    sub_sections: JSON.stringify(room.subSections || []),
    windows: JSON.stringify(room.windows || []),
    doors: JSON.stringify(room.doors || []),
    works: JSON.stringify(room.works || []),
    simple_mode_data: room.simpleModeData ? JSON.stringify(room.simpleModeData) : null,
    extended_mode_data: room.extendedModeData ? JSON.stringify(room.extendedModeData) : null,
    advanced_mode_data: room.advancedModeData ? JSON.stringify(room.advancedModeData) : null,
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

const DEFAULT_TIMEOUT = 30000; // 30 секунд

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
      throw new RoomsApiError(
        data.message || 'Произошла ошибка',
        response.status
      );
    }

    return data;
  } catch (error) {
    if (error instanceof RoomsApiError) {
      throw error;
    }
    // Обработка timeout/abort
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RoomsApiError(
        'Превышено время ожидания запроса',
        408
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Создание комнаты на сервере
 */
export async function createRoom(projectId: string, room: RoomData): Promise<{ status: string; data: ApiRoom }> {
  return fetchJson<{ status: string; data: ApiRoom }>(`/api/projects/${projectId}/rooms`, {
    method: 'POST',
    body: JSON.stringify(clientToApiRoom(room)),
  });
}

/**
 * Обновление комнаты на сервере
 */
export async function updateRoom(roomId: string, room: RoomData): Promise<{ status: string; data: ApiRoom }> {
  return fetchJson<{ status: string; data: ApiRoom }>(`/api/rooms/${roomId}`, {
    method: 'PUT',
    body: JSON.stringify(clientToApiRoom(room)),
  });
}

/**
 * Удаление комнаты с сервера
 */
export async function deleteRoom(roomId: string): Promise<{ status: string; message: string }> {
  return fetchJson<{ status: string; message: string }>(`/api/rooms/${roomId}`, {
    method: 'DELETE',
  });
}

/**
 * Получение комнаты с сервера
 */
export async function getRoom(roomId: string): Promise<{ status: string; data: ApiRoom }> {
  return fetchJson<{ status: string; data: ApiRoom }>(`/api/rooms/${roomId}`);
}

/**
 * Синхронизация комнаты - создание или обновление
 */
export async function syncRoom(projectId: string, room: RoomData, existingRoomIds: Set<string>): Promise<RoomData> {
  const isExisting = existingRoomIds.has(room.id);
  
  // Преобразуем ID комнаты если это локальный ID
  const roomToSend = { ...room };
  
  if (isExisting) {
    // Обновляем существующую комнату
    await updateRoom(room.id, roomToSend);
    return roomToSend;
  } else {
    // Создаём новую комнату
    const response = await createRoom(projectId, roomToSend);
    const newRoom = apiToClientRoom(response.data);
    return newRoom;
  }
}

export { apiToClientRoom, clientToApiRoom };