const fs = require('fs');
const path = require('path');
const db = require('../backend/database_pg');

async function runPayrollMigration() {
    console.log('🚀 Starting payroll migration...');
    
    try {
        // Read migration file
        const migrationPath = path.join(__dirname, '011_add_payroll_to_employees.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📄 Migration SQL loaded');
        console.log('Executing migration...');
        
        // Execute migration
        await db.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify the column was added
        const checkQuery = `
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'employees' AND column_name = 'payroll'
        `;
        
        const result = await db.queryRow(checkQuery);
        
        if (result) {
            console.log('✅ Payroll column verified:', result);
        } else {
            console.error('❌ Payroll column not found after migration');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runPayrollMigration()
        .then(() => {
            console.log('Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = runPayrollMigration;