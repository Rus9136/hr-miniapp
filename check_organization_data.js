const db = require('./backend/database_pg');

async function checkOrganizationData() {
  console.log('Checking organization data for BIN: 241240023631\n');
  
  try {
    // 1. Check employees with this BIN
    const employees = await db.queryRows(`
      SELECT table_number, full_name, object_bin, status
      FROM employees 
      WHERE object_bin = $1
      LIMIT 10
    `, ['241240023631']);
    
    console.log(`1. Employees with BIN 241240023631: ${employees.length}`);
    if (employees.length > 0) {
      console.log('   Sample employees:');
      employees.forEach(emp => {
        console.log(`   - ${emp.table_number}: ${emp.full_name} (status: ${emp.status})`);
      });
    }
    
    // 2. Check all unique BINs in employees table
    const allBins = await db.queryRows(`
      SELECT DISTINCT object_bin, COUNT(*) as count
      FROM employees
      GROUP BY object_bin
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('\n2. All unique BINs in employees table:');
    allBins.forEach(bin => {
      console.log(`   ${bin.object_bin}: ${bin.count} employees`);
    });
    
    // 3. Check time_events for this organization
    const events = await db.queryRows(`
      SELECT te.*, e.object_bin
      FROM time_events te
      JOIN employees e ON te.employee_number = e.table_number
      WHERE e.object_bin = $1
      AND te.event_datetime >= '2025-06-01'
      AND te.event_datetime <= '2025-06-09'
      LIMIT 10
    `, ['241240023631']);
    
    console.log(`\n3. Time events for BIN 241240023631 (June 1-9): ${events.length}`);
    
    // 4. Check recent time_events
    const recentEvents = await db.queryRows(`
      SELECT te.employee_number, te.event_datetime, e.object_bin, e.full_name
      FROM time_events te
      JOIN employees e ON te.employee_number = e.table_number
      WHERE te.event_datetime >= '2025-06-01'
      ORDER BY te.event_datetime DESC
      LIMIT 10
    `);
    
    console.log('\n4. Recent time events (all organizations):');
    recentEvents.forEach(event => {
      console.log(`   ${event.employee_number} (${event.object_bin}): ${event.event_datetime}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkOrganizationData();