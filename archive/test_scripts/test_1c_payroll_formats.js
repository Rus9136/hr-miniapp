/**
 * Test script for 1C payroll formats
 * Tests real-world scenarios from 1C system
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

// Real 1C-like test data
const test1CEmployees = [
    {
        "iin": "880204400849",
        "table_number": "АП00-00467",
        "payroll": "371 838"  // Original format from the user's example
    },
    {
        "iin": "123456789012",
        "table_number": "АП00-00001", 
        "payroll": "1 500 000.25"  // Large salary with decimal
    },
    {
        "iin": "987654321098",
        "table_number": "АП00-00002",
        "payroll": "250\u00A0000"  // Non-breaking spaces
    },
    {
        "table_number": "АП00-00003",
        "payroll": "50000"  // Without spaces
    },
    {
        "table_number": "АП00-00004", 
        "payroll": 450000.75  // Direct number from API
    },
    {
        "table_number": "АП00-00005",
        "payroll": "  75 000  "  // Leading/trailing spaces
    }
];

async function test1CPayrollFormats() {
    console.log('🏢 Testing 1C payroll formats...\n');
    
    console.log('📋 Test data:');
    test1CEmployees.forEach((emp, index) => {
        console.log(`   ${index + 1}. ${emp.table_number}: "${emp.payroll}" (${typeof emp.payroll})`);
    });
    
    try {
        const response = await fetch(`${API_BASE}/admin/employees/update-iin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(test1CEmployees)
        });
        
        const result = await response.json();
        
        console.log('\n📊 API Response:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Updated: ${result.statistics.totalUpdated}/${result.statistics.totalReceived}`);
        console.log(`   Errors: ${result.statistics.errorsCount}`);
        
        if (result.errors && result.errors.length > 0) {
            console.log('\n❌ Errors:');
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        } else {
            console.log('\n✅ All payroll formats processed successfully!');
        }
        
        // Test specific employee
        console.log('\n🔍 Checking database values...');
        
        const checkResponse = await fetch(`${API_BASE}/admin/employees`);
        const employees = await checkResponse.json();
        
        const testEmployees = employees.filter(emp => 
            ['АП00-00467', 'АП00-00001', 'АП00-00002', 'АП00-00003', 'АП00-00004', 'АП00-00005']
            .includes(emp.table_number)
        );
        
        testEmployees.forEach(emp => {
            console.log(`   ${emp.table_number}: ${emp.payroll} (${emp.full_name})`);
        });
        
        console.log('\n💡 Expected conversions:');
        console.log('   "371 838" → 371838.00');
        console.log('   "1 500 000.25" → 1500000.25');
        console.log('   "250 000" → 250000.00');
        console.log('   "50000" → 50000.00');
        console.log('   450000.75 → 450000.75');
        console.log('   "  75 000  " → 75000.00');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
test1CPayrollFormats();