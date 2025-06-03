const fs = require('fs');
const path = require('path');
const { pool } = require('../backend/database_pg');

async function runMigration(migrationFile) {
  console.log(`\n🚀 Running migration: ${migrationFile}`);
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    await pool.query(sql);
    
    console.log(`✅ Migration ${migrationFile} completed successfully`);
  } catch (error) {
    console.error(`❌ Error running migration ${migrationFile}:`, error.message);
    throw error;
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('❌ Please specify a migration file to run');
    console.log('Usage: node migrations/run_migration.js <migration_file>');
    console.log('Example: node migrations/run_migration.js 002_work_schedules.sql');
    process.exit(1);
  }
  
  try {
    await runMigration(migrationFile);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration };