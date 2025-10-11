/**
 * Test script for employee edit functionality
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

async function testEmployeeEdit() {
    console.log('🧪 Testing employee edit functionality...\n');
    
    try {
        console.log('1. Loading employees list...');
        const employeesResponse = await fetch(`${API_BASE}/admin/employees`);
        const employees = await employeesResponse.json();
        
        if (employees.length === 0) {
            console.log('❌ No employees found to test with');
            return;
        }
        
        const testEmployee = employees[0];
        console.log(`✅ Found test employee: ${testEmployee.table_number} - ${testEmployee.full_name}`);
        
        console.log('\n2. Testing employee update...');
        const updateData = [{
            table_number: testEmployee.table_number,
            full_name: testEmployee.full_name + ' (Обновлено)',
            iin: testEmployee.iin || '123456789012',
            payroll: (testEmployee.payroll || 0) + 1000
        }];
        
        const updateResponse = await fetch(`${API_BASE}/admin/employees/update-iin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        const updateResult = await updateResponse.json();
        
        console.log('📊 Update Result:');
        console.log(`   Status: ${updateResponse.status}`);
        console.log(`   Success: ${updateResult.success}`);
        console.log(`   Updated: ${updateResult.statistics?.totalUpdated || 0}`);
        
        if (updateResult.errors && updateResult.errors.length > 0) {
            console.log('\n⚠️ Errors:');
            updateResult.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        } else {
            console.log('\n✅ Employee update successful!');
        }
        
        console.log('\n3. Verifying update...');
        const verifyResponse = await fetch(`${API_BASE}/admin/employees`);
        const updatedEmployees = await verifyResponse.json();
        const updatedEmployee = updatedEmployees.find(emp => emp.table_number === testEmployee.table_number);
        
        if (updatedEmployee) {
            console.log('✅ Employee found after update:');
            console.log(`   Full name: ${updatedEmployee.full_name}`);
            console.log(`   IIN: ${updatedEmployee.iin}`);
            console.log(`   Payroll: ${updatedEmployee.payroll}`);
        } else {
            console.log('❌ Employee not found after update');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on port 3030');
        }
    }
}

// Run the test
testEmployeeEdit();