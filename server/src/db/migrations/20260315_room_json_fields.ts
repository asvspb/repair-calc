import type { Knex } from 'knex';

/**
 * Добавление JSON-полей в таблицу rooms для хранения полных данных комнаты
 * Это позволяет быстро сохранять и загружать все данные комнаты без сложных JOIN
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms', (table) => {
    // JSON fields for full room data storage
    table.text('segments').nullable().comment('JSON: RoomSegment[]');
    table.text('obstacles').nullable().comment('JSON: Obstacle[]');
    table.text('wall_sections').nullable().comment('JSON: WallSection[]');
    table.text('sub_sections').nullable().comment('JSON: RoomSubSection[]');
    table.text('windows').nullable().comment('JSON: Opening[]');
    table.text('doors').nullable().comment('JSON: Opening[]');
    table.text('works').nullable().comment('JSON: WorkData[]');
    table.text('simple_mode_data').nullable().comment('JSON: SimpleModeData');
    table.text('extended_mode_data').nullable().comment('JSON: ExtendedModeData');
    table.text('advanced_mode_data').nullable().comment('JSON: AdvancedModeData');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('rooms', (table) => {
    table.dropColumn('segments');
    table.dropColumn('obstacles');
    table.dropColumn('wall_sections');
    table.dropColumn('sub_sections');
    table.dropColumn('windows');
    table.dropColumn('doors');
    table.dropColumn('works');
    table.dropColumn('simple_mode_data');
    table.dropColumn('extended_mode_data');
    table.dropColumn('advanced_mode_data');
  });
}