/**
 * Smoke-тесты фасада room.repo до распила (TASK-BATCH-022-r3).
 * Гарантируют: публичный контракт (6 репозиториев) не меняется при разбиении файла.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockExecute, mockQuery, mockGetConnection } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockQuery: vi.fn(),
  mockGetConnection: vi.fn(),
}));

const mockConnection = {
  beginTransaction: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
};

vi.mock('../../src/db/pool.js', () => ({
  execute: mockExecute,
  query: mockQuery,
  getConnection: mockGetConnection,
}));

import {
  RoomRepository,
  OpeningRepository,
  SubSectionRepository,
  SegmentRepository,
  ObstacleRepository,
  WallSectionRepository,
} from '../../src/db/repositories/room.repo.js';

describe('room.repo facade (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
    mockConnection.beginTransaction.mockResolvedValue(undefined);
    mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }]);
    mockConnection.commit.mockResolvedValue(undefined);
    mockConnection.rollback.mockResolvedValue(undefined);
    mockConnection.release.mockResolvedValue(undefined);
  });

  it('RoomRepository.findById возвращает комнату', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'room-1', name: 'Гостиная' }]);

    const room = await RoomRepository.findById('room-1');

    expect(room?.name).toBe('Гостиная');
    expect(mockQuery).toHaveBeenCalledWith(
      'SELECT * FROM rooms WHERE id = ? AND deleted_at IS NULL',
      ['room-1'],
    );
  });

  it('RoomRepository.delete помечает комнату удалённой', async () => {
    mockExecute.mockResolvedValueOnce({ affectedRows: 1 });

    await expect(RoomRepository.delete('room-1')).resolves.toBe(true);
  });

  it('RoomRepository.reorder выполняет UPDATE в транзакции', async () => {
    await RoomRepository.reorder('project-1', ['a', 'b']);

    expect(mockConnection.beginTransaction).toHaveBeenCalledOnce();
    expect(mockConnection.execute).toHaveBeenCalledTimes(2);
    expect(mockConnection.commit).toHaveBeenCalledOnce();
    expect(mockConnection.release).toHaveBeenCalledOnce();
  });

  it('OpeningRepository.findByRoomId делегирует запрос', async () => {
    mockQuery.mockResolvedValueOnce([{ id: 'op-1' }]);

    const openings = await OpeningRepository.findByRoomId('room-1');

    expect(openings).toHaveLength(1);
  });

  it('SubSectionRepository, SegmentRepository, ObstacleRepository, WallSectionRepository экспортированы', () => {
    for (const repo of [
      SubSectionRepository,
      SegmentRepository,
      ObstacleRepository,
      WallSectionRepository,
    ]) {
      expect(typeof repo.findById).toBe('function');
      expect(typeof repo.findByRoomId).toBe('function');
    }
  });
});
