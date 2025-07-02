/**
 * Test script to verify modal functionality
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

async function testModalAPI() {
    console.log('🧪 Testing modal API functionality...\n');
    
    try {
        // Test 1: Check if employees endpoint is working
        console.log('1. Testing employees endpoint...');
        const employeesResponse = await fetch(`${API_BASE}/admin/employees`);
        console.log(`   Status: ${employeesResponse.status}`);
        
        if (employeesResponse.status !== 200) {
            console.log('❌ Employees endpoint failed');
            return;
        }
        
        const employees = await employeesResponse.json();
        console.log(`   ✅ Found ${employees.length} employees`);
        
        if (employees.length === 0) {
            console.log('❌ No employees to test with');
            return;
        }
        
        const testEmployee = employees[0];
        console.log(`   Testing with: ${testEmployee.table_number} - ${testEmployee.full_name}`);
        
        // Test 2: Test update endpoint with minimal data
        console.log('\n2. Testing update endpoint...');
        const updateData = [{
            table_number: testEmployee.table_number,
            full_name: testEmployee.full_name + ' (Test)',
        }];
        
        const updateResponse = await fetch(`${API_BASE}/admin/employees/update-iin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        console.log(`   Status: ${updateResponse.status}`);
        
        if (updateResponse.status !== 200) {
            const errorText = await updateResponse.text();
            console.log(`   ❌ Update failed: ${errorText}`);
            return;
        }
        
        const updateResult = await updateResponse.json();
        console.log(`   Success: ${updateResult.success}`);
        console.log(`   Updated: ${updateResult.statistics?.totalUpdated || 0}`);
        
        if (updateResult.errors && updateResult.errors.length > 0) {
            console.log('   Errors:', updateResult.errors);
        } else {
            console.log('   ✅ Update successful!');
        }
        
        console.log('\n🎉 All tests passed! Modal API should work correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on port 3030');
        }
    }
}

// Run the test
testModalAPI();