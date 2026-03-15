import { query, execute } from '../pool.js';
import type { RowDataPacket } from 'mysql2/promise';

export interface CalculatedTotals {
  project_id: string;
  total_area: number | null;
  total_works: number | null;
  total_materials: number | null;
  total_tools: number | null;
  grand_total: number | null;
  calculated_at: Date;
}

export class CalculatedTotalsRepository {
  /**
   * Сохранить или обновить рассчитанные итоги проекта
   */
  static async upsert(
    projectId: string,
    data: {
      total_area: number;
      total_works: number;
      total_materials: number;
      total_tools: number;
      grand_total: number;
    }
  ): Promise<CalculatedTotals> {
    await execute(
      `INSERT INTO calculated_totals 
        (project_id, total_area, total_works, total_materials, total_tools, grand_total, calculated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
        total_area = VALUES(total_area),
        total_works = VALUES(total_works),
        total_materials = VALUES(total_materials),
        total_tools = VALUES(total_tools),
        grand_total = VALUES(grand_total),
        calculated_at = CURRENT_TIMESTAMP`,
      [
        projectId,
        data.total_area,
        data.total_works,
        data.total_materials,
        data.total_tools,
        data.grand_total,
      ]
    );

    const result = await this.findByProjectId(projectId);
    if (!result) {
      throw new Error(`Failed to retrieve calculated totals for project ${projectId}`);
    }
    return result;
  }

  /**
   * Получить рассчитанные итоги по проекту
   */
  static async findByProjectId(projectId: string): Promise<CalculatedTotals | null> {
    const rows = await query<(CalculatedTotals & RowDataPacket)[]>(
      `SELECT * FROM calculated_totals WHERE project_id = ?`,
      [projectId]
    );

    return rows[0] || null;
  }

  /**
   * Удалить рассчитанные итоги проекта
   */
  static async deleteByProjectId(projectId: string): Promise<boolean> {
    const result = await execute(
      `DELETE FROM calculated_totals WHERE project_id = ?`,
      [projectId]
    );

    return result.affectedRows > 0;
  }
}
