/**
 * Test script for payroll API with spaces handling
 * Tests various payroll formats from 1C
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3030/api';

// Test data with various payroll formats
const testEmployees = [
    {
        table_number: "АП00-00467",
        iin: "830909401891", 
        payroll: "371 838"  // String with regular spaces
    },
    {
        table_number: "АП00-00001",
        payroll: "1 250 500.50"  // String with spaces and decimal
    },
    {
        table_number: "АП00-00002",
        payroll: "750\u00A0000"  // String with non-breaking spaces
    },
    {
        table_number: "АП00-00003",
        payroll: 450000.75  // Normal float
    },
    {
        table_number: "АП00-00004",
        payroll: "500000"  // String without spaces
    },
    {
        table_number: "АП00-00005",
        payroll: "   800 000   "  // String with leading/trailing spaces
    },
    {
        table_number: "АП00-00006",
        payroll: ""  // Empty string (should be treated as undefined)
    },
    {
        table_number: "АП00-00007",
        payroll: "   "  // Only spaces (should be treated as undefined)
    },
    {
        // Invalid cases
        table_number: "АП00-00008",
        payroll: "abc123"  // Invalid string
    },
    {
        table_number: "АП00-00009", 
        payroll: "-100 000"  // Negative value
    }
];

async function testPayrollSpaces() {
    console.log('🧪 Testing payroll API with spaces handling...\n');
    
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
        
        // Analyze results
        console.log('\n📋 Test Analysis:');
        console.log(`   - Total received: ${result.statistics.totalReceived}`);
        console.log(`   - Total updated: ${result.statistics.totalUpdated}`);
        console.log(`   - Total skipped: ${result.statistics.totalSkipped}`);
        console.log(`   - Errors count: ${result.statistics.errorsCount}`);
        
        if (result.errors && result.errors.length > 0) {
            console.log('\n⚠️ Errors:');
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
        }
        
        // Expected results analysis
        console.log('\n🎯 Expected Results:');
        console.log('   ✅ Should succeed: АП00-00467 (371 838), АП00-00001 (1 250 500.50), АП00-00002 (750 000), АП00-00003 (450000.75), АП00-00004 (500000), АП00-00005 (800 000)');
        console.log('   ⚠️  Should skip: АП00-00006 (empty), АП00-00007 (spaces only) - treated as undefined');
        console.log('   ❌ Should fail: АП00-00008 (abc123), АП00-00009 (-100 000)');
        
    } catch (error) {
        console.error('❌ Test failed with exception:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on port 3030');
        }
    }
}

// Run the test
testPayrollSpaces();