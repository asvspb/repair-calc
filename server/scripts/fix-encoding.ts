/**
 * Script for fixing MySQL encoding for existing tables
 * Converts all text columns to utf8mb4 for proper Cyrillic support
 * 
 * Usage: npx tsx scripts/fix-encoding.ts
 */

import { pool } from '../src/db/pool.js';

const TABLES = [
  'users',
  'projects',
  'rooms',
  'works',
  'materials',
  'tools',
  'openings',
  'room_subsections',
  'room_segments',
  'room_obstacles',
  'wall_sections',
  'ai_requests',
  'audit_log',
  // Update service tables
  'price_sources',
  'price_catalog',
  'price_history',
  'update_jobs',
  'update_job_items',
  'update_job_params',
  'update_job_locks',
  'update_webhooks',
  'scheduler_config',
  'update_logs',
  'ab_tests',
  'ab_test_results',
  'ab_test_daily_stats',
];

async function fixEncoding() {
  console.log('🔧 Starting encoding fix for MySQL tables...\n');
  
  const results = {
    success: [] as string[],
    failed: [] as Array<{ table: string; error: string }>,
    skipped: [] as string[],
  };
  
  for (const table of TABLES) {
    try {
      // Check if table exists
      const [exists] = await pool.execute<any[]>(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [table]);
      
      if (exists.length === 0) {
        console.log(`⊘ Skipped: ${table} (table does not exist)`);
        results.skipped.push(table);
        continue;
      }
      
      // Get current charset
      const [currentCharset] = await pool.execute<any[]>(`
        SELECT CCSA.character_set_name 
        FROM information_schema.TABLES T
        JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY CCSA 
        ON T.TABLE_COLLATION = CCSA.COLLATION_NAME
        WHERE T.TABLE_SCHEMA = DATABASE() AND T.TABLE_NAME = ?
      `, [table]);
      
      const current = currentCharset[0]?.character_set_name || 'unknown';
      
      // Convert table to utf8mb4
      await pool.execute(`
        ALTER TABLE \`${table}\`
        CONVERT TO CHARACTER SET utf8mb4
        COLLATE utf8mb4_unicode_ci
      `);
      
      console.log(`✅ ${table}: ${current} → utf8mb4`);
      results.success.push(table);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${table}: failed - ${errorMessage}`);
      results.failed.push({ table, error: errorMessage });
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`  ✅ Success: ${results.success.length}`);
  console.log(`  ⊘ Skipped: ${results.skipped.length}`);
  console.log(`  ❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed tables:');
    results.failed.forEach(({ table, error }) => {
      console.log(`  - ${table}: ${error}`);
    });
  }
  
  // Verify connection charset
  console.log('\n🔍 Verifying connection charset...');
  const [connectionCharset] = await pool.execute<any[]>(
    "SELECT @@character_set_connection as charset"
  );
  console.log(`Connection charset: ${connectionCharset[0].charset}`);
  
  const [serverCharset] = await pool.execute<any[]>(
    "SELECT @@character_set_server as charset"
  );
  console.log(`Server charset: ${serverCharset[0].charset}`);
  
  await pool.end();
  
  console.log('\n🎉 Encoding fix completed!');
  
  // Exit with error code if any failures
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

// Run the script
fixEncoding().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
