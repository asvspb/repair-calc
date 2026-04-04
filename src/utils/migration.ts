/**
 * Миграция данных для существующих пользователей
 * Обнаруживает и устраняет дубликаты проектов
 */

import type { ProjectData } from '../types';
import { idMapper, IdMapper } from './idMapper';
import { logStart, logSuccess, logWarning, logDebug, logError } from './logger';
import { getAllRooms } from './projectObjects';

const MIGRATION_VERSION_KEY = 'repair-calc-migration-version';
const CURRENT_MIGRATION_VERSION = 1;

const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
} as const;

/**
 * Проверить, нужна ли миграция
 */
export function needsMigration(): boolean {
  const currentVersion = parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10);
  return currentVersion < CURRENT_MIGRATION_VERSION;
}

/**
 * Получить текущую версию миграции
 */
export function getMigrationVersion(): number {
  return parseInt(localStorage.getItem(MIGRATION_VERSION_KEY) || '0', 10);
}

/**
 * Запуск миграций
 */
export async function runMigrations(
  serverProjects: ProjectData[],
  onProgress?: (message: string) => void
): Promise<{ migrated: number; duplicatesRemoved: number }> {
  const currentVersion = getMigrationVersion();
  
  if (currentVersion >= CURRENT_MIGRATION_VERSION) {
    logDebug('Migration', 'Миграция не требуется');
    return { migrated: 0, duplicatesRemoved: 0 };
  }

  const startTime = logStart('Migration', 'Запуск миграций', { 
    from: currentVersion, 
    to: CURRENT_MIGRATION_VERSION 
  });

  let result = { migrated: 0, duplicatesRemoved: 0 };

  try {
    // Миграция v0 → v1: Обнаружение и маркировка дубликатов
    if (currentVersion < 1) {
      onProgress?.('Проверка проектов на дубликаты...');
      result = await migrateV0ToV1(serverProjects);
    }

    // Обновляем маркер версии
    localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_MIGRATION_VERSION));
    
    logSuccess('Migration', 'Миграция завершена', result, startTime);
  } catch (error) {
    logError('Migration', 'Ошибка миграции', error);
    throw error;
  }

  return result;
}

/**
 * Миграция v0 → v1: Обнаружение дубликатов
 */
async function migrateV0ToV1(serverProjects: ProjectData[]): Promise<{ migrated: number; duplicatesRemoved: number }> {
  logDebug('Migration', 'Миграция v0 → v1: Обнаружение дубликатов');

  // Загружаем локальные проекты
  const localProjectsData = localStorage.getItem(STORAGE_KEYS.PROJECTS);
  if (!localProjectsData) {
    logDebug('Migration', 'Нет локальных проектов для миграции');
    return { migrated: 0, duplicatesRemoved: 0 };
  }

  let localProjects: ProjectData[];
  try {
    localProjects = JSON.parse(localProjectsData) as ProjectData[];
  } catch {
    logWarning('Migration', 'Не удалось распарсить локальные проекты');
    return { migrated: 0, duplicatesRemoved: 0 };
  }

  // Ищем дубликаты: локальный проект с таким же именем, как серверный
  const duplicates: Array<{ local: ProjectData; server: ProjectData }> = [];
  const mappings: Array<{ localId: string; serverId: string }> = [];

  for (const local of localProjects) {
    // Пропускаем уже синхронизированные проекты
    if (IdMapper.isServerId(local.id)) continue;

    // Ищем похожий проект на сервере
    for (const server of serverProjects) {
      const similarity = calculateSimilarity(local, server);
      if (similarity > 0.8) {
        duplicates.push({ local, server });
        mappings.push({ localId: local.id, serverId: server.id });
        break; // Берём первый подходящий
      }
    }
  }

  if (duplicates.length === 0) {
    logDebug('Migration', 'Дубликаты не найдены');
    return { migrated: 0, duplicatesRemoved: 0 };
  }

  logDebug('Migration', `Найдено ${duplicates.length} дубликатов`);

  // Создаём маппинги для найденных дубликатов
  for (const { localId, serverId } of mappings) {
    idMapper.addMapping(localId, serverId);
  }

  // Удаляем локальные дубликаты из localStorage
  const duplicateLocalIds = new Set(duplicates.map(d => d.local.id));
  const cleanedProjects = localProjects.filter(p => !duplicateLocalIds.has(p.id));
  
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(cleanedProjects));

  // Обновляем активный проект если он был дубликатом
  const activeProjectId = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT);
  if (activeProjectId && duplicateLocalIds.has(activeProjectId)) {
    const mapping = mappings.find(m => m.localId === activeProjectId);
    if (mapping) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, mapping.serverId);
      logDebug('Migration', `Активный проект обновлен: ${activeProjectId} → ${mapping.serverId}`);
    }
  }

  logSuccess('Migration', `Удалено ${duplicates.length} дубликатов`, { mappings });

  return { migrated: mappings.length, duplicatesRemoved: duplicates.length };
}

/**
 * Расчёт схожести проектов (0-1)
 */
function calculateSimilarity(local: ProjectData, server: ProjectData): number {
  let score = 0;

  // Совпадение имени (основной критерий)
  if (local.name && server.name) {
    const localName = local.name.toLowerCase().trim();
    const serverName = server.name.toLowerCase().trim();

    if (localName === serverName) {
      score += 0.6;
    } else if (localName.includes(serverName) || serverName.includes(localName)) {
      score += 0.3;
    }
  }

  // Количество комнат (используем getAllRooms для поддержки objects структуры)
  const localRooms = getAllRooms(local);
  const serverRooms = getAllRooms(server);
  if (localRooms.length === serverRooms.length && localRooms.length > 0) {
    score += 0.2;
  }

  // Наличие города
  if (local.city && server.city && local.city.toLowerCase() === server.city.toLowerCase()) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

/**
 * Принудительный сброс миграции (для тестов)
 */
export function resetMigration(): void {
  localStorage.removeItem(MIGRATION_VERSION_KEY);
  idMapper.clear();
}