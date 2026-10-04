/**
 * Тесты ExportPanel (TASK-BATCH-013-split-ui): рендер двух кнопок экспорта,
 * вызов StorageManager с передачей проектов, скачивание через Blob/createObjectURL.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportPanel } from '../../../src/components/backup/ExportPanel';
import type { ProjectData } from '../../../src/types';

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    exportToJSON: vi.fn(() => '{"projects":[]}'),
    exportToCSV: vi.fn(() => 'name\nTest'),
  },
}));

vi.mock('../../../src/utils/storage', () => ({
  StorageManager: storageMock,
}));

const createProject = (id: string, name: string): ProjectData =>
  ({ id, name, objects: [] }) as unknown as ProjectData;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('ExportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
  });

  afterAll(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('рендерит кнопки JSON-бэкапа и CSV-экспорта', () => {
    render(<ExportPanel projects={[createProject('p1', 'Проект')]} activeProjectId="p1" />);

    expect(screen.getByTestId('export-json-btn')).toBeInTheDocument();
    expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
    expect(screen.getByText('Сохранить бэкап (JSON)')).toBeInTheDocument();
    expect(screen.getByText('Экспорт в Excel (CSV)')).toBeInTheDocument();
  });

  it('кнопка JSON вызывает exportToJSON с проектами и активным проектом', () => {
    const projects = [createProject('p1', 'Проект'), createProject('p2', 'Дача')];
    render(<ExportPanel projects={projects} activeProjectId="p2" />);

    fireEvent.click(screen.getByTestId('export-json-btn'));

    expect(storageMock.exportToJSON).toHaveBeenCalledWith(projects, 'p2');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('кнопка CSV вызывает exportToCSV только с проектами', () => {
    const projects = [createProject('p1', 'Проект')];
    render(<ExportPanel projects={projects} activeProjectId="p1" />);

    fireEvent.click(screen.getByTestId('export-csv-btn'));

    expect(storageMock.exportToCSV).toHaveBeenCalledWith(projects);
  });
});
