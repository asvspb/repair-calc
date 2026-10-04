/**
 * Тесты pull-слияния LWW (спека SPEC-SYNC-V2 §3.1–§3.3, batch (в)):
 * - сервер новее / клиент новее / ничья (tie-break §3.2);
 * - локальная не dirty → сервер безусловно;
 * - удалено на сервере: dirty → сохраняется (пересоздастся пушем), не dirty → удаляется;
 * - resolvedDirty / deletedLocally / conflictsResolved.
 */

import { describe, it, expect, vi } from 'vitest';
import { mergePull, serverWinsLww } from '../../src/api/storage/syncMerge';
import type { ProjectData } from '../../src/types';
import type { DirtyMap } from '../../src/store/types';

vi.mock('../../src/utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  logDebug: vi.fn(),
  logStart: vi.fn(() => 0),
  logSuccess: vi.fn(),
}));

const uuid = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

function room(id: string, updatedAt?: string) {
  return {
    id,
    name: `Room ${id}`,
    geometryMode: 'simple' as const,
    length: 5,
    width: 4,
    height: 2.7,
    segments: [],
    obstacles: [],
    wallSections: [],
    subSections: [],
    windows: [],
    doors: [],
    works: [],
    updatedAt,
  };
}

function obj(id: string, rooms: ReturnType<typeof room>[], updatedAt?: string) {
  return { id, projectId: 'p', name: `Object ${id}`, rooms, updatedAt };
}

function project(id: string, objects: ReturnType<typeof obj>[], updatedAt?: string): ProjectData {
  return { id, name: `Project ${id}`, objects, updatedAt };
}

const emptyDirty = (): DirtyMap => ({ project: {}, object: {}, room: {} });

describe('serverWinsLww (§3.1 + tie-break §3.2)', () => {
  it('локальная новее → сервер не побеждает', () => {
    expect(serverWinsLww('2026-01-02T00:00:00Z', '2026-01-01T00:00:00Z', uuid(1), uuid(1))).toBe(
      false,
    );
  });

  it('сервер новее → сервер побеждает', () => {
    expect(serverWinsLww('2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', uuid(1), uuid(1))).toBe(
      true,
    );
  });

  it('ничья: равные id → сервер (<=, §3.1)', () => {
    expect(serverWinsLww('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z', uuid(1), uuid(1))).toBe(
      true,
    );
  });

  it('ничья: больший лексикографически id побеждает', () => {
    expect(serverWinsLww('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z', uuid(9), uuid(1))).toBe(
      false,
    );
    expect(serverWinsLww('2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z', uuid(1), uuid(9))).toBe(
      true,
    );
  });
});

describe('mergePull — матрица конфликтов (§3.1)', () => {
  it('локальная не dirty → принимается серверная версия', () => {
    const server = project(
      uuid(1),
      [obj(uuid(11), [room(uuid(21))], '2026-01-03T00:00:00Z')],
      '2026-01-03T00:00:00Z',
    );
    const local = [
      project(
        uuid(1),
        [obj(uuid(11), [room(uuid(21))], '2026-01-01T00:00:00Z')],
        '2026-01-01T00:00:00Z',
      ),
    ];

    const result = mergePull([server], local, emptyDirty());

    expect(result.projects[0].name).toBe(server.name);
    expect(result.conflictsResolved).toBe(0);
    expect(result.resolvedDirty).toHaveLength(0);
  });

  it('локальная dirty и новее → остаётся локальная, dirty не снимается', () => {
    const server = project(uuid(1), [], '2026-01-03T00:00:00Z');
    const local = [project(uuid(1), [], '2026-01-05T00:00:00Z')];
    const dirty = emptyDirty();
    dirty.project[uuid(1)] = { updatedAt: '2026-01-05T00:00:00Z', op: 'upsert' };

    const result = mergePull([server], local, dirty);

    expect(result.projects[0].name).toBe(local[0].name);
    expect(result.resolvedDirty).toHaveLength(0);
    expect(result.conflictsResolved).toBe(0);
  });

  it('локальная dirty и старее → LWW: сервер затирает, dirty снята, счётчик инкремент', () => {
    const server = project(uuid(1), [], '2026-01-05T00:00:00Z');
    const local = [project(uuid(1), [], '2026-01-03T00:00:00Z')];
    const dirty = emptyDirty();
    dirty.project[uuid(1)] = { updatedAt: '2026-01-03T00:00:00Z', op: 'upsert' };

    const result = mergePull([server], local, dirty);

    expect(result.projects[0].name).toBe(server.name);
    expect(result.resolvedDirty).toEqual([{ entityKind: 'project', entityId: uuid(1) }]);
    expect(result.conflictsResolved).toBe(1);
  });

  it('ничья по updatedAt у dirty-сущности → сервер побеждает (§3.1 <=)', () => {
    const ts = '2026-01-05T00:00:00Z';
    const server = project(uuid(1), [], ts);
    const local = [project(uuid(1), [], ts)];
    const dirty = emptyDirty();
    dirty.project[uuid(1)] = { updatedAt: ts, op: 'upsert' };

    const result = mergePull([server], local, dirty);

    expect(result.projects[0].name).toBe(server.name);
    expect(result.conflictsResolved).toBe(1);
  });
});

describe('mergePull — комнаты и объекты', () => {
  it('dirty-комната старее → сервер затирает комнату, объект остаётся', () => {
    const server = project(uuid(1), [
      obj(uuid(11), [room(uuid(21), '2026-01-05T00:00:00Z')], '2026-01-05T00:00:00Z'),
    ]);
    const local = [
      project(uuid(1), [
        obj(uuid(11), [room(uuid(21), '2026-01-03T00:00:00Z')], '2026-01-03T00:00:00Z'),
      ]),
    ];
    const dirty = emptyDirty();
    dirty.room[uuid(21)] = { updatedAt: '2026-01-03T00:00:00Z', op: 'upsert' };
    dirty.object[uuid(11)] = { updatedAt: '2026-01-03T00:00:00Z', op: 'upsert' };

    const result = mergePull([server], local, dirty);

    expect(result.projects[0].objects[0].rooms[0].updatedAt).toBe('2026-01-05T00:00:00Z');
    expect(result.resolvedDirty.map(e => e.entityId).sort()).toEqual([uuid(11), uuid(21)].sort());
    expect(result.conflictsResolved).toBe(2);
  });

  it('dirty-комната новее → комната локальная, но не-dirty объект принимается серверный (с локальной комнатой)', () => {
    const server = project(uuid(1), [
      obj(uuid(11), [room(uuid(21), '2026-01-03T00:00:00Z')], '2026-01-03T00:00:00Z'),
    ]);
    const local = [
      project(uuid(1), [
        obj(uuid(11), [room(uuid(21), '2026-01-05T00:00:00Z')], '2026-01-05T00:00:00Z'),
      ]),
    ];
    const dirty = emptyDirty();
    dirty.room[uuid(21)] = { updatedAt: '2026-01-05T00:00:00Z', op: 'upsert' };

    const result = mergePull([server], local, dirty);

    expect(result.projects[0].objects[0].rooms[0].updatedAt).toBe('2026-01-05T00:00:00Z');
    expect(result.resolvedDirty).toHaveLength(0);
  });
});

describe('mergePull — удалено на сервере (§3.3, без tombstones)', () => {
  it('не dirty → удаляется локально (deletedLocally)', () => {
    const local = [project(uuid(1), [])];

    const result = mergePull([], local, emptyDirty());

    expect(result.projects).toHaveLength(0);
    expect(result.deletedLocally).toEqual([{ entityKind: 'project', entityId: uuid(1) }]);
  });

  it('dirty → сохраняется локально (пересоздастся пушем)', () => {
    const local = [project(uuid(1), [])];
    const dirty = emptyDirty();
    dirty.project[uuid(1)] = { updatedAt: '2026-01-05T00:00:00Z', op: 'upsert' };

    const result = mergePull([], local, dirty);

    expect(result.projects).toHaveLength(1);
    expect(result.deletedLocally).toHaveLength(0);
  });

  it('не dirty объект, отсутствующий в pull → удаляется вместе с деревом', () => {
    const server = project(uuid(1), [], '2026-01-05T00:00:00Z');
    const local = [project(uuid(1), [obj(uuid(11), [])], '2026-01-03T00:00:00Z')];

    const result = mergePull([server], local, emptyDirty());

    expect(result.projects[0].objects).toHaveLength(0);
    expect(result.deletedLocally).toEqual([{ entityKind: 'object', entityId: uuid(11) }]);
  });
});
