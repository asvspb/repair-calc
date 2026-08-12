import Dexie, { type Table } from 'dexie';
import type { ProjectData } from '@shared/types';
import type { WorkTemplate } from '../../types/workTemplate';

export interface KeyValueEntry {
  key: string;
  value: unknown;
}

export class RepairCalcDB extends Dexie {
  projects!: Table<ProjectData, string>;
  workTemplates!: Table<WorkTemplate, string>;
  keyValueStore!: Table<KeyValueEntry, string>;

  constructor() {
    super('RepairCalcDB');

    this.version(1).stores({
      projects: 'id, updatedAt',
      workTemplates: 'id',
      keyValueStore: 'key',
    });
  }
}

export const db = new RepairCalcDB();
