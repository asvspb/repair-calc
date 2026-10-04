/**
 * Unit tests for syncPushSchema (спека SPEC-SYNC-V2 §3.4).
 * SYNC-V2: entity `object`, локальные `local-*` ID в id/entityId, `clientUpdatedAt` в data.
 */

import { describe, it, expect } from 'vitest';
import { syncPushSchema } from '../../src/middleware/validation.js';

const UUID = '11111111-1111-4111-8111-111111111111';

function makeChange(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID,
    timestamp: Date.now(),
    operation: 'update',
    entity: 'project',
    entityId: UUID,
    data: {},
    ...overrides,
  };
}

describe('syncPushSchema (SYNC-V2 §3.4)', () => {
  it('принимает entity object', () => {
    const parsed = syncPushSchema.parse({ changes: [makeChange({ entity: 'object' })] });
    expect(parsed.changes[0].entity).toBe('object');
  });

  it('принимает local-* ID в id и entityId', () => {
    const parsed = syncPushSchema.parse({
      changes: [makeChange({ id: 'local-abc', entityId: 'local-abc' })],
    });
    expect(parsed.changes[0].entityId).toBe('local-abc');
  });

  it('принимает clientUpdatedAt в data', () => {
    const parsed = syncPushSchema.parse({
      changes: [makeChange({ data: { clientUpdatedAt: '2026-01-01T00:00:00Z' } })],
    });
    expect(parsed.changes[0].data.clientUpdatedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('отвергает мусорный entityId (не UUID и не local-*)', () => {
    expect(() =>
      syncPushSchema.parse({ changes: [makeChange({ entityId: 'not-an-id' })] }),
    ).toThrow();
  });

  it('отвергает неизвестную entity', () => {
    expect(() => syncPushSchema.parse({ changes: [makeChange({ entity: 'galaxy' })] })).toThrow();
  });
});
