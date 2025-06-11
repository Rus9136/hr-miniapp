const axios = require('axios');

const API_BASE_URL = 'http://tco.aqnietgroup.com:5555/v1';

async function testAPI() {
  console.log('Testing external API...\n');
  
  // Test 1: Get employees from organization
  try {
    console.log('1. Testing /staff endpoint for organization 241240023631:');
    const staffResponse = await axios.get(`${API_BASE_URL}/staff`, {
      params: { objectBIN: '241240023631' }
    });
    console.log(`   Found ${staffResponse.data.length} employees`);
    if (staffResponse.data.length > 0) {
      console.log(`   First employee:`, staffResponse.data[0]);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 2: Get events for a specific date range
  try {
    console.log('\n2. Testing /event/filter endpoint:');
    const params = {
      dateStart: '2025-06-01',
      dateStop: '2025-06-09',
      objectBIN: '241240023631'
    };
    console.log('   Request params:', params);
    
    const eventResponse = await axios.get(`${API_BASE_URL}/event/filter`, { params });
    console.log(`   Response status: ${eventResponse.status}`);
    console.log(`   Found ${eventResponse.data.length} events`);
    if (eventResponse.data.length > 0) {
      console.log(`   First event:`, eventResponse.data[0]);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
    if (error.response) {
      console.log(`   Response status: ${error.response.status}`);
      console.log(`   Response data:`, error.response.data);
    }
  }
  
  // Test 3: Get events for a specific employee
  try {
    console.log('\n3. Testing /event/filter with specific employee:');
    const params = {
      dateStart: '2025-06-01',
      dateStop: '2025-06-09',
      tableNumber: 'АП00-00358', // Example employee number
      objectBIN: '241240023631'
    };
    console.log('   Request params:', params);
    
    const eventResponse = await axios.get(`${API_BASE_URL}/event/filter`, { params });
    console.log(`   Found ${eventResponse.data.length} events`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 4: Check all date formats
  console.log('\n4. Testing different date formats:');
  const dateFormats = [
    { dateStart: '2025-06-01', dateStop: '2025-06-09' },
    { dateStart: '01.06.2025', dateStop: '09.06.2025' },
    { dateStart: '2025-06-01T00:00:00', dateStop: '2025-06-09T23:59:59' },
    { dateStart: '01-06-2025', dateStop: '09-06-2025' }
  ];
  
  for (const format of dateFormats) {
    try {
      const params = { ...format, objectBIN: '241240023631' };
      console.log(`   Testing format:`, params);
      const response = await axios.get(`${API_BASE_URL}/event/filter`, { params });
      console.log(`   Result: ${response.data.length} events`);
      if (response.data.length > 0) break; // Stop if we found a working format
    } catch (error) {
      console.log(`   Error: ${error.message}`);
    }
  }
}

testAPI().catch(console.error);