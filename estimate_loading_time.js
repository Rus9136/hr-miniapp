const axios = require('axios');
const db = require('./backend/database_pg');

async function estimateLoadingTime() {
  console.log('Estimating loading time for organization 241240023631\n');
  
  try {
    // Get employee count
    const employees = await db.queryRows(`
      SELECT COUNT(*) as count
      FROM employees 
      WHERE object_bin = $1 AND status = 1
    `, ['241240023631']);
    
    const employeeCount = employees[0].count;
    console.log(`Total employees: ${employeeCount}`);
    
    // Test API response time for a few employees
    const testEmployees = await db.queryRows(`
      SELECT table_number
      FROM employees 
      WHERE object_bin = $1 AND status = 1
      LIMIT 5
    `, ['241240023631']);
    
    console.log('\nTesting API response times...');
    let totalTime = 0;
    let totalEvents = 0;
    
    for (const emp of testEmployees) {
      const startTime = Date.now();
      
      try {
        const params = {
          dateStart: '2025-06-01',
          dateStop: '2025-06-10',
          tableNumber: emp.table_number,
          objectBIN: '241240023631'
        };
        
        const response = await axios.get('http://tco.aqnietgroup.com:5555/v1/event/filter', { params });
        const events = response.data || [];
        
        const endTime = Date.now();
        const requestTime = endTime - startTime;
        
        totalTime += requestTime;
        totalEvents += events.length;
        
        console.log(`  ${emp.table_number}: ${events.length} events in ${requestTime}ms`);
        
      } catch (error) {
        console.log(`  ${emp.table_number}: Error - ${error.message}`);
      }
      
      // Simulate the 100ms delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const avgRequestTime = totalTime / testEmployees.length;
    const avgEvents = totalEvents / testEmployees.length;
    
    console.log('\n--- Estimates ---');
    console.log(`Average request time: ${avgRequestTime.toFixed(0)}ms`);
    console.log(`Average events per employee: ${avgEvents.toFixed(1)}`);
    console.log(`Delay between requests: 100ms`);
    
    // Calculate total time
    const totalRequestTime = (avgRequestTime + 100) * employeeCount; // Request time + delay
    const totalMinutes = totalRequestTime / (1000 * 60);
    
    console.log(`\nEstimated total loading time: ${totalMinutes.toFixed(1)} minutes`);
    console.log(`Expected total events: ${(avgEvents * employeeCount).toFixed(0)}`);
    
    if (totalMinutes > 5) {
      console.log('\n⚠️  WARNING: Loading time exceeds current 5-minute timeout!');
      console.log('   Consider increasing timeout or loading smaller batches.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

estimateLoadingTime();