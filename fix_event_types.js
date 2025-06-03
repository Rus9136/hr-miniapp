const { Pool } = require('pg');

// PostgreSQL connection configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hr_tracker',
    user: process.env.DB_USER || 'hr_user',
    password: process.env.DB_PASSWORD || 'hr_secure_password',
};

async function fixEventTypes() {
    const pool = new Pool(dbConfig);
    
    try {
        console.log('🔧 Fixing event types based on time...\n');
        
        // Get all events with type 0 grouped by employee and date
        const result = await pool.query(`
            SELECT 
                employee_number,
                DATE(event_datetime) as event_date,
                COUNT(*) as event_count
            FROM time_events 
            WHERE event_type = '0'
            GROUP BY employee_number, DATE(event_datetime)
            ORDER BY employee_number, event_date
        `);
        
        console.log(`Found ${result.rows.length} employee-date combinations to process`);
        
        let updatedCount = 0;
        
        for (const row of result.rows) {
            // Get all events for this employee on this date
            const dayEvents = await pool.query(`
                SELECT id, event_datetime, 
                       EXTRACT(HOUR FROM event_datetime) as hour,
                       EXTRACT(MINUTE FROM event_datetime) as minute
                FROM time_events 
                WHERE employee_number = $1 
                AND DATE(event_datetime) = $2
                AND event_type = '0'
                ORDER BY event_datetime
            `, [row.employee_number, row.event_date]);
            
            if (dayEvents.rows.length === 0) continue;
            
            // Determine event types based on time
            if (dayEvents.rows.length === 1) {
                // Single event - check if morning or evening
                const hour = parseInt(dayEvents.rows[0].hour);
                if (hour < 12) {
                    // Morning event - mark as entry
                    await pool.query(`UPDATE time_events SET event_type = '1' WHERE id = $1`, [dayEvents.rows[0].id]);
                    updatedCount++;
                } else {
                    // Evening event - mark as exit
                    await pool.query(`UPDATE time_events SET event_type = '2' WHERE id = $1`, [dayEvents.rows[0].id]);
                    updatedCount++;
                }
            } else {
                // Multiple events - first is entry, last is exit
                // Mark first event as entry
                await pool.query(`UPDATE time_events SET event_type = '1' WHERE id = $1`, [dayEvents.rows[0].id]);
                updatedCount++;
                
                // Mark last event as exit
                const lastEvent = dayEvents.rows[dayEvents.rows.length - 1];
                await pool.query(`UPDATE time_events SET event_type = '2' WHERE id = $1`, [lastEvent.id]);
                updatedCount++;
                
                // Mark intermediate events as type 0 (keep as is)
                // These could be lunch breaks or temporary exits
            }
        }
        
        console.log(`\n✅ Updated ${updatedCount} events`);
        
        // Show statistics
        const stats = await pool.query(`
            SELECT event_type, COUNT(*) as count
            FROM time_events
            GROUP BY event_type
            ORDER BY event_type
        `);
        
        console.log('\n📊 Event type distribution:');
        stats.rows.forEach(row => {
            const typeName = row.event_type === '1' ? 'Entry' : 
                           row.event_type === '2' ? 'Exit' : 
                           'Unknown';
            console.log(`Type ${row.event_type} (${typeName}): ${row.count} events`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

// Run the script
fixEventTypes();