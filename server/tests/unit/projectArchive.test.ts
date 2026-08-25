/**
 * Unit-тесты архива проектов (T1): атомарная архивация (delete), findArchived*,
 * restore, hardDelete. BLOCKING-тест идентичности штампов — без него merge невозможен
 * (docs/plan-project-archive.md §5).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockExecute, mockQuery, mockTransaction, connExecute, connQuery } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockQuery: vi.fn(),
  mockTransaction: vi.fn(),
  connExecute: vi.fn(),
  connQuery: vi.fn(),
}));

vi.mock('../../src/db/pool.js', () => ({
  execute: mockExecute,
  query: mockQuery,
  transaction: mockTransaction,
}));

import { ProjectRepository } from '../../src/db/repositories/project.repo.js';

// conn-моки: внутри transaction() используется TransactionConnection —
// conn.query возвращает массив-обёртку [rows], conn.execute — [{affectedRows}]
mockTransaction.mockImplementation(cb => cb({ execute: connExecute, query: connQuery }));

describe('ProjectRepository archive (T1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('delete() — атомарная архивация', () => {
    describe('BLOCKING: идентичность штампов архивации', () => {
      it('все три UPDATE получают ОДИН экземпляр Date; нет CURRENT_TIMESTAMP; проект первым', async () => {
        connExecute.mockResolvedValue([{ affectedRows: 1 }]);

        const result = await ProjectRepository.delete('project-1');

        expect(result).toBe(true);
        expect(connExecute).toHaveBeenCalledTimes(3);

        const calls = connExecute.mock.calls;
        // Порядок: проект первым, затем объекты, затем комнаты
        expect(String(calls[0][0])).toMatch(/UPDATE projects/);
        expect(String(calls[1][0])).toMatch(/UPDATE objects/);
        expect(String(calls[2][0])).toMatch(/UPDATE rooms/);

        // Единый JS-штамп: один и тот же экземпляр Date во всех трёх вызовах
        const stamp = calls[0][1][0];
        expect(stamp).toBeInstanceOf(Date);
        expect(calls[1][1][0]).toBe(stamp);
        expect(calls[2][1][0]).toBe(stamp);

        // Ни один SQL архивации не использует CURRENT_TIMESTAMP
        for (const call of calls) {
          expect(String(call[0])).not.toContain('CURRENT_TIMESTAMP');
        }
      });
    });

    it('проект уже архивный (affectedRows = 0): false, объекты/комнаты не трогаются', async () => {
      connExecute.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await ProjectRepository.delete('project-1');

      expect(result).toBe(false);
      expect(connExecute).toHaveBeenCalledTimes(1);
      expect(String(connExecute.mock.calls[0][0])).toMatch(/UPDATE projects/);
    });

    it('успех: true и три UPDATE с общим штампом', async () => {
      connExecute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await ProjectRepository.delete('project-1');

      expect(result).toBe(true);
      expect(connExecute).toHaveBeenCalledTimes(3);
      const stamps = connExecute.mock.calls.map(c => c[1][0]);
      expect(stamps[0]).toBe(stamps[1]);
      expect(stamps[0]).toBe(stamps[2]);
    });
  });

  describe('restore()', () => {
    it('проект не найден: not_found, conn.execute не вызывался', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await ProjectRepository.restore('project-1', 'user-1');

      expect(result).toEqual({ status: 'not_found' });
      expect(connExecute).not.toHaveBeenCalled();
    });

    it('проект активен (deleted_at = null): not_archived, conn.execute не вызывался', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'project-1', user_id: 'user-1', name: 'P1', deleted_at: null },
      ]);

      const result = await ProjectRepository.restore('project-1', 'user-1');

      expect(result).toEqual({ status: 'not_archived' });
      expect(connExecute).not.toHaveBeenCalled();
    });

    it('архивный проект: дети по subquery-штампу, штамп проекта снимается последним, ответ restored', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'project-1',
          user_id: 'user-1',
          name: 'P1',
          deleted_at: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      connExecute.mockResolvedValue([{ affectedRows: 1 }]);
      // findByIdWithObjects (top-level query): findByIdAndUserId → objects → rooms
      mockQuery.mockResolvedValueOnce([{ id: 'project-1', user_id: 'user-1', name: 'P1' }]);
      mockQuery.mockResolvedValueOnce([
        { id: 'obj-1', project_id: 'project-1', user_id: 'user-1', name: 'Объект' },
      ]);
      mockQuery.mockResolvedValueOnce([{ id: 'room-1', object_id: 'obj-1', name: 'Комната' }]);

      const result = await ProjectRepository.restore('project-1', 'user-1');

      expect(result.status).toBe('restored');
      if (result.status === 'restored') {
        expect(result.project.objects).toHaveLength(1);
      }

      expect(connExecute).toHaveBeenCalledTimes(3);
      const sqls = connExecute.mock.calls.map(c => String(c[0]));
      // Дети — сравнение колонка-с-колонкой через subquery (не JS Date параметром)
      expect(sqls[0]).toMatch(/UPDATE objects/);
      expect(sqls[0]).toContain('deleted_at = (SELECT deleted_at FROM projects');
      expect(sqls[1]).toMatch(/UPDATE rooms/);
      expect(sqls[1]).toContain('deleted_at = (SELECT deleted_at FROM projects');
      // Снятие штампа проекта — ПОСЛЕДНИМ (subquery выше должен читать архивный проект)
      expect(sqls[2]).toMatch(/UPDATE projects\s+SET deleted_at = NULL/);
    });
  });

  describe('hardDelete()', () => {
    it('проект не найден: not_found, conn.execute (DELETE) не вызывался', async () => {
      connQuery.mockResolvedValueOnce([[]]);

      const result = await ProjectRepository.hardDelete('project-1', 'user-1');

      expect(result).toEqual({ status: 'not_found' });
      expect(connExecute).not.toHaveBeenCalled();
    });

    it('проект активен: not_archived, conn.execute (DELETE) не вызывался', async () => {
      connQuery.mockResolvedValueOnce([
        [{ id: 'project-1', user_id: 'user-1', name: 'P1', deleted_at: null }],
      ]);

      const result = await ProjectRepository.hardDelete('project-1', 'user-1');

      expect(result).toEqual({ status: 'not_archived' });
      expect(connExecute).not.toHaveBeenCalled();
    });

    it('архивный проект: счётчики до DELETE, DELETE выполнен, audit-INSERT с counts', async () => {
      connQuery.mockResolvedValueOnce([
        [{ id: 'project-1', user_id: 'user-1', name: 'P1', deleted_at: new Date() }],
      ]);
      connQuery.mockResolvedValueOnce([[{ count: '3' }]]);
      connQuery.mockResolvedValueOnce([[{ count: '5' }]]);
      connExecute.mockResolvedValue([{ affectedRows: 1 }]);

      const result = await ProjectRepository.hardDelete('project-1', 'user-1');

      expect(result).toEqual({ status: 'deleted', deleted: { objects: 3, rooms: 5 } });

      // Счётчики посчитаны ДО DELETE: counts = connQuery #2/#3, DELETE = connExecute #1
      expect(connQuery).toHaveBeenCalledTimes(3);
      expect(connQuery.mock.invocationCallOrder[1]).toBeLessThan(
        connExecute.mock.invocationCallOrder[0],
      );
      expect(connQuery.mock.invocationCallOrder[2]).toBeLessThan(
        connExecute.mock.invocationCallOrder[0],
      );

      expect(connExecute).toHaveBeenCalledTimes(2);
      expect(String(connExecute.mock.calls[0][0])).toMatch(/^DELETE FROM projects/);
      expect(String(connExecute.mock.calls[1][0])).toMatch(/^INSERT INTO audit_log/);

      const auditSql = String(connExecute.mock.calls[1][0]);
      expect(auditSql).toContain('project.permanent_delete');
      const auditValues = connExecute.mock.calls[1][1];
      expect(auditValues[1]).toBe('user-1'); // user_id
      expect(auditValues[2]).toBe('project-1'); // entity_id
      expect(JSON.parse(auditValues[3])).toEqual({ name: 'P1', objects: 3, rooms: 5 });
    });
  });

  describe('findArchivedByUserId()', () => {
    it('SQL фильтрует deleted_at IS NOT NULL; counts смаплены из строки в числа', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          id: 'p1',
          user_id: 'user-1',
          name: 'P1',
          city: null,
          use_ai_pricing: false,
          last_ai_price_update: null,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: new Date('2026-01-02T00:00:00Z'),
          objects_count: '2',
          rooms_count: '7',
        },
        {
          id: 'p2',
          user_id: 'user-1',
          name: 'P2',
          city: null,
          use_ai_pricing: false,
          last_ai_price_update: null,
          version: 1,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: new Date('2026-01-01T00:00:00Z'),
          objects_count: '0',
          rooms_count: '0',
        },
      ]);

      const result = await ProjectRepository.findArchivedByUserId('user-1');

      const sql = String(mockQuery.mock.calls[0][0]);
      expect(sql).toContain('deleted_at IS NOT NULL');
      expect(sql).toContain('ORDER BY p.deleted_at DESC');
      expect(result).toHaveLength(2);
      expect(result[0].objectsCount).toBe(2);
      expect(result[0].roomsCount).toBe(7);
      expect(result[1].objectsCount).toBe(0);
      expect(result[1].roomsCount).toBe(0);
      expect(result[0]).not.toHaveProperty('objects_count');
      expect(result[0]).toHaveProperty('objectsCount');
    });
  });

  describe('findArchivedByIdAndUserId()', () => {
    it('возвращает проект только из архива', async () => {
      mockQuery.mockResolvedValueOnce([
        { id: 'p1', user_id: 'user-1', name: 'P1', deleted_at: new Date() },
      ]);

      const result = await ProjectRepository.findArchivedByIdAndUserId('p1', 'user-1');

      expect(result?.id).toBe('p1');
      expect(String(mockQuery.mock.calls[0][0])).toContain('deleted_at IS NOT NULL');
    });

    it('активный проект не находится', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await ProjectRepository.findArchivedByIdAndUserId('p1', 'user-1');

      expect(result).toBeNull();
    });
  });
});
