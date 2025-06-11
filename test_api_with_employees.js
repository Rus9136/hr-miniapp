const axios = require('axios');
const db = require('./backend/database_pg');

const API_BASE_URL = 'http://tco.aqnietgroup.com:5555/v1';

async function testWithRealEmployees() {
  console.log('Testing API with real employees from organization 241240023631\n');
  
  try {
    // Get some employees from this organization
    const employees = await db.queryRows(`
      SELECT table_number, full_name, object_bin
      FROM employees 
      WHERE object_bin = $1 AND status = 1
      LIMIT 5
    `, ['241240023631']);
    
    console.log(`Found ${employees.length} employees to test\n`);
    
    // Test each employee
    for (const emp of employees) {
      console.log(`Testing employee: ${emp.table_number} - ${emp.full_name}`);
      
      try {
        const params = {
          dateStart: '2025-06-01',
          dateStop: '2025-06-09',
          tableNumber: emp.table_number,
          objectBIN: emp.object_bin
        };
        
        console.log('  Request params:', params);
        
        const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
        console.log(`  Result: ${response.data.length} events`);
        
        if (response.data.length > 0) {
          console.log('  First event:', response.data[0]);
        }
      } catch (error) {
        console.log(`  Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Test without tableNumber but with objectBIN
    console.log('\nTesting without tableNumber (organization-wide):');
    try {
      const params = {
        dateStart: '2025-06-01',
        dateStop: '2025-06-09',
        objectBIN: '241240023631'
      };
      
      console.log('Request params:', params);
      const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
      console.log(`Result: ${response.data.length} events`);
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    process.exit();
  }
}

testWithRealEmployees();