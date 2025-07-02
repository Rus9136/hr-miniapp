#!/usr/bin/env node

// Run migration 008: Add hours breakdown columns
const db = require('./backend/database_pg');
const fs = require('fs');

async function runMigration() {
    console.log('🔄 Running migration 008: Add hours breakdown columns');
    
    try {
        // Read and execute migration SQL
        const migrationSQL = fs.readFileSync('./migrations/008_add_hours_breakdown.sql', 'utf8');
        
        console.log('Executing migration SQL...');
        await db.query(migrationSQL);
        
        console.log('✅ Migration 008 completed successfully');
        
        // Verify the changes
        const result = await db.queryRow(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'time_records' 
            AND column_name IN ('planned_hours', 'actual_hours', 'overtime_hours', 'has_lunch_break', 'is_scheduled_workday')
            ORDER BY column_name
        `);
        
        if (result) {
            console.log('✅ New columns verified in database');
        }
        
        // Check updated records count
        const updatedCount = await db.queryRow(`
            SELECT COUNT(*) as count 
            FROM time_records 
            WHERE planned_hours IS NOT NULL
        `);
        
        console.log(`📊 Updated ${updatedCount.count} existing records with default values`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

runMigration();