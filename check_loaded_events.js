const db = require('./backend/database_pg');

async function checkLoadedEvents() {
  console.log('Checking loaded events for organization 241240023631\n');
  
  try {
    // 1. Check total events for organization
    const totalEvents = await db.queryRows(`
      SELECT COUNT(*) as count
      FROM time_events te
      JOIN employees e ON te.employee_number = e.table_number
      WHERE e.object_bin = $1
      AND te.event_datetime >= '2025-06-01'
      AND te.event_datetime <= '2025-06-09'
    `, ['241240023631']);
    
    console.log(`1. Total events for organization 241240023631 (June 1-9): ${totalEvents[0].count}`);
    
    // 2. Check events by date
    const eventsByDate = await db.queryRows(`
      SELECT DATE(te.event_datetime) as date, COUNT(*) as count
      FROM time_events te
      JOIN employees e ON te.employee_number = e.table_number
      WHERE e.object_bin = $1
      AND te.event_datetime >= '2025-06-01'
      AND te.event_datetime <= '2025-06-09'
      GROUP BY DATE(te.event_datetime)
      ORDER BY date
    `, ['241240023631']);
    
    console.log('\n2. Events by date:');
    eventsByDate.forEach(row => {
      console.log(`   ${row.date}: ${row.count} events`);
    });
    
    // 3. Check some specific employees
    const employeeEvents = await db.queryRows(`
      SELECT te.employee_number, e.full_name, COUNT(*) as event_count
      FROM time_events te
      JOIN employees e ON te.employee_number = e.table_number
      WHERE e.object_bin = $1
      AND te.event_datetime >= '2025-06-01'
      AND te.event_datetime <= '2025-06-09'
      GROUP BY te.employee_number, e.full_name
      ORDER BY event_count DESC
      LIMIT 10
    `, ['241240023631']);
    
    console.log('\n3. Top 10 employees by event count:');
    employeeEvents.forEach(emp => {
      console.log(`   ${emp.employee_number} - ${emp.full_name}: ${emp.event_count} events`);
    });
    
    // 4. Check time_records
    const timeRecords = await db.queryRows(`
      SELECT COUNT(*) as count
      FROM time_records tr
      JOIN employees e ON tr.employee_number = e.table_number
      WHERE e.object_bin = $1
      AND tr.date >= '2025-06-01'
      AND tr.date <= '2025-06-09'
    `, ['241240023631']);
    
    console.log(`\n4. Total time_records for organization (June 1-9): ${timeRecords[0].count}`);
    
    // 5. Check last upload time
    const lastEvents = await db.queryRows(`
      SELECT te.employee_number, MAX(te.created_at) as last_upload
      FROM time_events te
      JOIN employees e ON te.employee_number = e.table_number
      WHERE e.object_bin = $1
      GROUP BY te.employee_number
      ORDER BY last_upload DESC
      LIMIT 5
    `, ['241240023631']);
    
    console.log('\n5. Last upload times:');
    lastEvents.forEach(row => {
      console.log(`   ${row.employee_number}: ${row.last_upload}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkLoadedEvents();