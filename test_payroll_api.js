/**
 * Test script for the updated /api/admin/employees/update-iin endpoint
 * Tests both IIN and payroll functionality
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

// Test data
const testEmployees = [
    {
        table_number: "АП00-00001",
        iin: "123456789012",
        payroll: 500000.50
    },
    {
        table_number: "АП00-00002", 
        iin: "987654321098",
        payroll: 750000.00
    },
    {
        // Only payroll update
        table_number: "АП00-00003",
        payroll: 650000.25
    },
    {
        // Only IIN update
        table_number: "АП00-00004",
        iin: "555666777888"
    },
    {
        // Invalid IIN format
        table_number: "АП00-00005",
        iin: "123abc789012",
        payroll: 400000.00
    },
    {
        // Invalid payroll (negative)
        table_number: "АП00-00006",
        iin: "111222333444",
        payroll: -100000
    },
    {
        // Missing table_number
        iin: "999888777666",
        payroll: 300000.00
    }
];

async function testPayrollAPI() {
    console.log('🧪 Testing payroll API endpoint...\n');
    
    try {
        const response = await fetch(`${API_BASE}/admin/employees/update-iin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testEmployees)
        });
        
        const result = await response.json();
        
        console.log('📊 Response Status:', response.status);
        console.log('📊 Response Body:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('\n✅ API Test PASSED');
            console.log(`   - Total received: ${result.statistics.totalReceived}`);
            console.log(`   - Total processed: ${result.statistics.totalProcessed}`);
            console.log(`   - Total updated: ${result.statistics.totalUpdated}`);
            console.log(`   - Total skipped: ${result.statistics.totalSkipped}`);
            console.log(`   - Errors count: ${result.statistics.errorsCount}`);
            
            if (result.errors && result.errors.length > 0) {
                console.log('\n⚠️ Errors encountered:');
                result.errors.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error}`);
                });
            }
        } else {
            console.log('\n❌ API Test FAILED');
            console.log('   Error:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Test failed with exception:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on port 3030');
        }
    }
}

// Example request body for documentation
const exampleRequestBody = [
    {
        "table_number": "АП00-00001",
        "iin": "123456789012",
        "payroll": 500000.50
    },
    {
        "table_number": "АП00-00002",
        "payroll": 750000.00
        // IIN is optional
    },
    {
        "table_number": "АП00-00003",
        "iin": "987654321098"
        // payroll is optional
    }
];

console.log('📋 Example Request Body for API:');
console.log(JSON.stringify(exampleRequestBody, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

// Run the test
testPayrollAPI();