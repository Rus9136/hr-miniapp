const axios = require('axios');
const db = require('./backend/database_pg');

const API_BASE_URL = 'http://tco.aqnietgroup.com:5555/v1';

async function testBulkLoad() {
  console.log('Testing bulk load simulation for organization 241240023631\n');
  
  try {
    // Get 10 employees from this organization
    const employees = await db.queryRows(`
      SELECT table_number, full_name, object_bin
      FROM employees 
      WHERE object_bin = $1 AND status = 1
      LIMIT 10
    `, ['241240023631']);
    
    console.log(`Testing with ${employees.length} employees\n`);
    
    let totalEvents = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (const emp of employees) {
      try {
        const params = {
          dateStart: '2025-06-01',
          dateStop: '2025-06-09',
          tableNumber: emp.table_number,
          objectBIN: emp.object_bin
        };
        
        const response = await axios.get(`${API_BASE_URL}/event/filter`, { 
          params,
          timeout: 10000 // 10 second timeout
        });
        
        const events = response.data || [];
        totalEvents += events.length;
        successCount++;
        
        console.log(`✓ ${emp.table_number}: ${events.length} events`);
        
      } catch (error) {
        errorCount++;
        console.log(`✗ ${emp.table_number}: Error - ${error.message}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n--- Summary ---');
    console.log(`Success: ${successCount}/${employees.length}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total events: ${totalEvents}`);
    console.log(`Average events per employee: ${(totalEvents / successCount).toFixed(1)}`);
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    process.exit();
  }
}

testBulkLoad();