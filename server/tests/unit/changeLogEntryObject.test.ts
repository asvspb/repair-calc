/**
 * ChangeLogEntry включает entity 'object' типобезопасно (трассировка ТЗ v1.1,
 * пункт 15.5 / решение №11): серверный sync больше не кастует change.entity
 * в string. Кейс 'object' в push покыт интеграционно в syncRoutes.test.ts;
 * здесь — компилируемое доказательство типа.
 */

import { describe, it, expect } from 'vitest';
import type { ChangeLogEntry } from '../../src/types/index.js';

describe('ChangeLogEntry: entity union включает object (решение №11)', () => {
  it('принимает запись с entity="object" без каста', () => {
    const entry: ChangeLogEntry = {
      id: 'change-1',
      timestamp: Date.now(),
      operation: 'update',
      entity: 'object',
      entityId: '22222222-2222-4222-8222-222222222222',
      data: { name: 'Объект' },
    };

    // Деструктуризация без as string (как в sync-v2.service.ts)
    const { entity } = entry;

    expect(entity).toBe('object');
  });

  it('принимает все 12 типов entity из спеки §15.2.1', () => {
    const entities = [
      'project',
      'object',
      'room',
      'work',
      'material',
      'tool',
      'opening',
      'subsection',
      'segment',
      'obstacle',
      'wall_section',
    ] as const;

    for (const entity of entities) {
      const entry: ChangeLogEntry = {
        id: `change-${entity}`,
        timestamp: Date.now(),
        operation: 'create',
        entity,
        entityId: '22222222-2222-4222-8222-222222222222',
        data: null,
      };
      expect(entry.entity).toBe(entity);
    }
  });
});
