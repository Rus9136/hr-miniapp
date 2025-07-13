const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'hr_user',
        password: process.env.DB_PASSWORD || 'hr_secure_password',
        database: process.env.DB_NAME || 'hr_tracker'
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Read migration file
        const migrationPath = path.join(__dirname, '014_add_trade_point_to_departments.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Running migration: 014_add_trade_point_to_departments.sql');
        await client.query(migrationSQL);
        
        console.log('Migration completed successfully!');
        
        // Verify the column was added
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'departments' 
            AND column_name = 'trade_point';
        `);
        
        if (result.rows.length > 0) {
            console.log('Verification: trade_point column added successfully');
            console.log('Column details:', result.rows[0]);
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();