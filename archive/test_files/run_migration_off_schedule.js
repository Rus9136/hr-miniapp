const fs = require('fs');
const path = require('path');
const db = require('./backend/database_pg');

async function runMigration() {
    try {
        console.log('Starting migration: Add off_schedule column to time_records...');
        
        // Read migration file
        const migrationPath = path.join(__dirname, 'migrations', '007_add_off_schedule_column.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute migration
        await db.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Test the new column
        console.log('Testing new column...');
        const testResult = await db.queryRows(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'time_records' AND column_name = 'off_schedule'
        `);
        
        if (testResult.length > 0) {
            console.log('✅ New column details:', testResult[0]);
        } else {
            console.log('❌ Column was not created properly');
        }
        
        // Check existing records count
        const recordsCount = await db.queryRows('SELECT COUNT(*) as count FROM time_records');
        console.log(`📊 Total time_records: ${recordsCount[0].count}`);
        
        // Check off_schedule distribution
        const offScheduleStats = await db.queryRows(`
            SELECT 
                off_schedule,
                COUNT(*) as count 
            FROM time_records 
            GROUP BY off_schedule
        `);
        console.log('📊 Off-schedule distribution:', offScheduleStats);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();