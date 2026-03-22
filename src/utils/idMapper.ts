/**
 * IdMapper — хранилище маппингов локальных ID на серверные UUID
 * Используется для предотвращения дублирования проектов при синхронизации
 */

const MAPPING_KEY = 'repair-calc-id-mappings';
const DEVICE_ID_KEY = 'device-id';

export interface IdMapping {
  localId: string;
  serverId: string;
  migratedAt: string; // ISO string
  deviceId?: string;
}

interface IdMappingStore {
  mappings: Record<string, IdMapping>;
  lastCleanup: string; // ISO string
  version: number;
}

const CURRENT_VERSION = 1;

/**
 * Класс для управления маппингами ID проектов
 * Singleton — используйте экспортируемый экземпляр `idMapper`
 */
class IdMapper {
  private mappings: Map<string, IdMapping> = new Map();
  private initialized = false;

  constructor() {
    this.load();
  }

  /**
   * Загрузка маппингов из localStorage
   */
  private load(): void {
    try {
      const data = localStorage.getItem(MAPPING_KEY);
      if (data) {
        const store = JSON.parse(data) as IdMappingStore;
        if (store.version === CURRENT_VERSION && store.mappings) {
          this.mappings = new Map(Object.entries(store.mappings));
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error('[IdMapper] Ошибка загрузки маппингов:', error);
      this.mappings = new Map();
      this.initialized = true;
    }
  }

  /**
   * Сохранение маппингов в localStorage
   */
  private save(): void {
    try {
      const store: IdMappingStore = {
        mappings: Object.fromEntries(this.mappings),
        lastCleanup: new Date().toISOString(),
        version: CURRENT_VERSION,
      };
      localStorage.setItem(MAPPING_KEY, JSON.stringify(store));
    } catch (error) {
      console.error('[IdMapper] Ошибка сохранения маппингов:', error);
    }
  }

  /**
   * Получить или создать ID устройства
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * Добавить маппинг локального ID на серверный
   */
  addMapping(localId: string, serverId: string): void {
    if (!localId || !serverId) {
      console.warn('[IdMapper] Попытка добавить пустой маппинг');
      return;
    }

    const mapping: IdMapping = {
      localId,
      serverId,
      migratedAt: new Date().toISOString(),
      deviceId: this.getDeviceId(),
    };

    this.mappings.set(localId, mapping);
    this.save();
    
    console.log('[IdMapper] Добавлен маппинг:', { localId, serverId });
  }

  /**
   * Получить серверный ID по локальному
   */
  getServerId(localId: string): string | null {
    return this.mappings.get(localId)?.serverId || null;
  }

  /**
   * Получить локальный ID по серверному
   */
  getLocalId(serverId: string): string | null {
    for (const mapping of this.mappings.values()) {
      if (mapping.serverId === serverId) {
        return mapping.localId;
      }
    }
    return null;
  }

  /**
   * Проверить наличие маппинга для локального ID
   */
  hasMapping(localId: string): boolean {
    return this.mappings.has(localId);
  }

  /**
   * Проверить наличие маппинга для серверного ID
   */
  hasServerId(serverId: string): boolean {
    return this.getLocalId(serverId) !== null;
  }

  /**
   * Удалить маппинг по локальному ID
   */
  removeMapping(localId: string): void {
    if (this.mappings.delete(localId)) {
      this.save();
      console.log('[IdMapper] Удалён маппинг:', { localId });
    }
  }

  /**
   * Получить все маппинги
   */
  getAllMappings(): IdMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * Получить количество маппингов
   */
  get size(): number {
    return this.mappings.size;
  }

  /**
   * Очистка старых маппингов (по умолчанию старше 90 дней)
   */
  cleanup(oldDays: number = 90): number {
    const now = Date.now();
    const maxAge = oldDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [localId, mapping] of this.mappings.entries()) {
      const age = now - new Date(mapping.migratedAt).getTime();
      if (age > maxAge) {
        this.mappings.delete(localId);
        removed++;
      }
    }

    if (removed > 0) {
      this.save();
      console.log(`[IdMapper] Очищено ${removed} старых маппингов`);
    }
    return removed;
  }

  /**
   * Полная очистка всех маппингов
   */
  clear(): void {
    this.mappings.clear();
    localStorage.removeItem(MAPPING_KEY);
    console.log('[IdMapper] Все маппинги очищены');
  }

  /**
   * Проверка, является ли ID серверным UUID
   */
  static isServerId(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Проверка, является ли ID локальным
   */
  static isLocalId(id: string): boolean {
    return id.startsWith('local-');
  }
}

// Singleton instance
export const idMapper = new IdMapper();

// Экспорт класса для использования статических методов
export { IdMapper };
