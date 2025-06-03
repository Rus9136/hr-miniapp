const { Pool } = require('pg');

// PostgreSQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hr_tracker',
    user: process.env.DB_USER || 'hr_user',
    password: process.env.DB_PASSWORD || 'hr_secure_password',
};

async function clearTimeTables() {
    const pool = new Pool(dbConfig);
    
    try {
        console.log('🧹 Starting to clear time tables...\n');
        
        // Clear time_events table
        console.log('Clearing time_events table...');
        const timeEventsResult = await pool.query('DELETE FROM time_events');
        console.log(`✅ Deleted ${timeEventsResult.rowCount || 0} records from time_events\n`);
        
        // Clear time_records table
        console.log('Clearing time_records table...');
        const timeRecordsResult = await pool.query('DELETE FROM time_records');
        console.log(`✅ Deleted ${timeRecordsResult.rowCount || 0} records from time_records\n`);
        
        console.log('🎉 Successfully cleared both tables!');
        
    } catch (error) {
        console.error('❌ Error clearing tables:', error);
    } finally {
        await pool.end();
    }
}

// Run the script
clearTimeTables();