/**
 * Priority Queue Utils - Приоритизация элементов для обновления
 * UPDATE_SERVICE_SPEC v1.1 - Фаза 8.4.4
 */

import { subDays, isBefore } from 'date-fns';
import type { PriceCatalog } from '../../db/repositories/priceCatalog.repo.js';
import type { PriceCategory } from '../../db/repositories/priceCatalog.repo.js';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export interface PrioritizedItem {
  name: string;
  category: PriceCategory;
  city: string;
  unit?: string;
  existingPrice?: PriceCatalog;
  priorityScore: number;
  priorityReasons: string[];
}

export interface PriorityScore {
  score: number;
  reasons: string[];
}

export type JobPriority = 'high' | 'normal' | 'low';

export const JOB_PRIORITY_VALUES: Record<JobPriority, number> = {
  high: 1000,
  normal: 500,
  low: 100,
};

// ═══════════════════════════════════════════════════════
// ПРИОРИТИЗАЦИЯ ЭЛЕМЕНТОВ
// ═══════════════════════════════════════════════════════

/**
 * Вычисляет приоритет элемента для обновления
 * 
 * Приоритет (чем выше score, тем раньше обрабатывается):
 * - 100: Нет записи в БД (новый элемент)
 * - 80: Просрочено (valid_until < NOW)
 * - 60: Устарело (>7 дней с последнего обновления)
 * - 40: Низкий confidence (< 0.5)
 * - 30: Требует проверки (requires_review)
 * - 20: Плановое обновление (базовый приоритет)
 */
export function calculateItemPriority(item: {
  name: string;
  category: PriceCategory;
  city: string;
  existingPrice?: PriceCatalog | null;
}): PriorityScore {
  let score = 0;
  const reasons: string[] = [];

  const { existingPrice } = item;

  // 1. Нет записи в БД — наивысший приоритет
  if (!existingPrice) {
    score += 100;
    reasons.push('Новый элемент (нет в БД)');
  } else {
    // 2. Просрочено (valid_until < NOW)
    if (existingPrice.valid_until && isBefore(existingPrice.valid_until, new Date())) {
      score += 80;
      reasons.push(`Просрочено (valid_until: ${existingPrice.valid_until.toISOString()})`);
    }

    // 3. Устарело (>7 дней с последнего обновления)
    if (existingPrice.updated_at) {
      const weekAgo = subDays(new Date(), 7);
      if (isBefore(existingPrice.updated_at, weekAgo)) {
        score += 60;
        const daysOld = Math.floor(
          (Date.now() - existingPrice.updated_at.getTime()) / (1000 * 60 * 60 * 24)
        );
        reasons.push(`Устарело (${daysOld} дней)`);
      }
    }

    // 4. Низкий confidence (< 0.5)
    if (existingPrice.confidence_score !== null && existingPrice.confidence_score < 0.5) {
      score += 40;
      reasons.push(`Низкий confidence (${existingPrice.confidence_score.toFixed(2)})`);
    }

    // 5. Требует проверки (requires_review) — определяется из price_history
    // Этот флаг проверяется отдельно при наличии истории
  }

  // 6. Плановое обновление (базовый приоритет)
  if (score === 0) {
    score = 20;
    reasons.push('Плановое обновление');
  }

  return { score, reasons };
}

/**
 * Добавляет приоритеты к элементам и сортирует по убыванию приоритета
 */
export function prioritizeItems<T extends { name: string; category: PriceCategory; city: string }>(
  items: T[],
  getExistingPrice: (item: T) => PriceCatalog | null | undefined
): PrioritizedItem[] {
  const prioritized = items.map(item => {
    const existingPrice = getExistingPrice(item);
    const { score, reasons } = calculateItemPriority({
      name: item.name,
      category: item.category,
      city: item.city,
      existingPrice,
    });

    return {
      ...item,
      existingPrice: existingPrice || undefined,
      priorityScore: score,
      priorityReasons: reasons,
    };
  });

  // Сортировка по убыванию приоритета
  return prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Группирует элементы по приоритетным категориям для батчевой обработки
 */
export function groupByPriorityCategory(
  items: PrioritizedItem[]
): {
  critical: PrioritizedItem[];   // score >= 80
  high: PrioritizedItem[];       // score 60-79
  normal: PrioritizedItem[];     // score 30-59
  low: PrioritizedItem[];        // score < 30
} {
  return {
    critical: items.filter(i => i.priorityScore >= 80),
    high: items.filter(i => i.priorityScore >= 60 && i.priorityScore < 80),
    normal: items.filter(i => i.priorityScore >= 30 && i.priorityScore < 60),
    low: items.filter(i => i.priorityScore < 30),
  };
}

// ═══════════════════════════════════════════════════════
// ПРИОРИТИЗАЦИЯ ЗАДАЧ (JOBS)
// ═══════════════════════════════════════════════════════

/**
 * Сравнивает приоритеты задач для сортировки очереди
 */
export function compareJobPriority(
  a: { priority?: JobPriority; createdAt: Date },
  b: { priority?: JobPriority; createdAt: Date }
): number {
  const priorityA = JOB_PRIORITY_VALUES[a.priority || 'normal'];
  const priorityB = JOB_PRIORITY_VALUES[b.priority || 'normal'];

  // Сначала по приоритету (выше приоритет = раньше)
  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }

  // При равном приоритете — по времени создания (раньше = раньше)
  return a.createdAt.getTime() - b.createdAt.getTime();
}

/**
 * Простая приоритетная очередь для задач
 */
export class JobPriorityQueue {
  private queue: Array<{
    id: string;
    priority: JobPriority;
    createdAt: Date;
    data: unknown;
  }> = [];

  enqueue(id: string, priority: JobPriority, data: unknown): void {
    this.queue.push({
      id,
      priority,
      createdAt: new Date(),
      data,
    });
    this.sort();
  }

  dequeue(): { id: string; priority: JobPriority; data: unknown } | undefined {
    const item = this.queue.shift();
    return item ? { id: item.id, priority: item.priority, data: item.data } : undefined;
  }

  peek(): { id: string; priority: JobPriority; data: unknown } | undefined {
    const item = this.queue[0];
    return item ? { id: item.id, priority: item.priority, data: item.data } : undefined;
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
  }

  getAll(): Array<{ id: string; priority: JobPriority; createdAt: Date }> {
    return this.queue.map(({ id, priority, createdAt }) => ({ id, priority, createdAt }));
  }

  private sort(): void {
    this.queue.sort(compareJobPriority);
  }
}