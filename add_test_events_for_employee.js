const { Pool } = require('pg');

// PostgreSQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hr_tracker',
    user: process.env.DB_USER || 'hr_user',
    password: process.env.DB_PASSWORD || 'hr_secure_password',
};

async function addTestEvents() {
    const pool = new Pool(dbConfig);
    
    try {
        console.log('🚀 Adding test events for employee АП00-00228...\n');
        
        // Employee details
        const employeeNumber = 'АП00-00228';
        const objectCode = 'АП000010'; // From employee record
        
        // Generate 30 events for December 2024
        const events = [];
        const startDate = new Date('2024-12-01');
        
        // Generate events for 15 working days (2 events per day - entry and exit)
        for (let day = 0; day < 15; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + day);
            
            // Skip weekends
            if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                continue;
            }
            
            // Morning entry (8:30-9:00)
            const entryHour = 8;
            const entryMinute = 30 + Math.floor(Math.random() * 30);
            const entryTime = new Date(currentDate);
            entryTime.setHours(entryHour, entryMinute, 0, 0);
            
            events.push({
                employee_number: employeeNumber,
                object_code: objectCode,
                event_datetime: entryTime.toISOString(),
                event_type: '1' // Entry
            });
            
            // Evening exit (17:30-18:30)
            const exitHour = 17 + Math.floor(Math.random() * 2);
            const exitMinute = 30 + Math.floor(Math.random() * 30);
            const exitTime = new Date(currentDate);
            exitTime.setHours(exitHour, exitMinute, 0, 0);
            
            events.push({
                employee_number: employeeNumber,
                object_code: objectCode,
                event_datetime: exitTime.toISOString(),
                event_type: '2' // Exit
            });
        }
        
        // Insert events into database
        let insertedCount = 0;
        for (const event of events) {
            try {
                await pool.query(`
                    INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
                    VALUES ($1, $2, $3, $4)
                `, [event.employee_number, event.object_code, event.event_datetime, event.event_type]);
                insertedCount++;
            } catch (error) {
                console.error('Error inserting event:', error.message);
            }
        }
        
        console.log(`✅ Successfully added ${insertedCount} events for employee АП00-00228`);
        console.log(`📅 Period: ${startDate.toLocaleDateString()} - ${new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()}`);
        
        // Show sample of inserted data
        const result = await pool.query(`
            SELECT COUNT(*) as count, 
                   MIN(event_datetime) as first_event, 
                   MAX(event_datetime) as last_event
            FROM time_events 
            WHERE employee_number = $1
        `, [employeeNumber]);
        
        const stats = result.rows[0];
        console.log(`\n📊 Statistics:`);
        console.log(`Total events: ${stats.count}`);
        console.log(`First event: ${new Date(stats.first_event).toLocaleString()}`);
        console.log(`Last event: ${new Date(stats.last_event).toLocaleString()}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

// Run the script
addTestEvents();