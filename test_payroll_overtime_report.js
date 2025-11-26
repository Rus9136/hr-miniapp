/**
 * Test script for Payroll Overtime Report endpoint
 * Tests the /api/admin/reports/payroll-overtime endpoint
 */

const http = require('http');

const TEST_ORGANIZATION = 'ТОО Madlen Group';
const TEST_DATE = '2025-06-09';

console.log('🧪 Testing Payroll Overtime Report Endpoint\n');
console.log(`Organization: ${TEST_ORGANIZATION}`);
console.log(`Date: ${TEST_DATE}\n`);

const options = {
    hostname: 'localhost',
    port: 3030,
    path: `/api/admin/reports/payroll-overtime?organization=${encodeURIComponent(TEST_ORGANIZATION)}&date=${TEST_DATE}`,
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

console.log(`Request URL: http://${options.hostname}:${options.port}${options.path}\n`);

const req = http.request(options, (res) => {
    console.log(`Response Status: ${res.statusCode}`);
    console.log(`Response Headers:`, res.headers);
    console.log('');

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const jsonData = JSON.parse(data);
            console.log('✅ Response JSON (formatted):\n');
            console.log(JSON.stringify(jsonData, null, 2));

            // Validation
            console.log('\n📊 Validation:');
            console.log(`- Success: ${jsonData.success}`);
            console.log(`- Departments count: ${jsonData.departments ? jsonData.departments.length : 0}`);
            console.log(`- Total planned payroll: ${jsonData.totalSummary?.plannedPayroll || 0}₸`);
            console.log(`- Total actual payroll: ${jsonData.totalSummary?.actualPayroll || 0}₸`);
            console.log(`- Difference: ${jsonData.totalSummary?.difference || 0}₸`);

            if (jsonData.departments && jsonData.departments.length > 0) {
                console.log('\n✅ Test PASSED: Found departments data');

                jsonData.departments.forEach((dept, index) => {
                    console.log(`\n  Department ${index + 1}: ${dept.departmentName}`);
                    console.log(`  - Planned: ${dept.summary.plannedCount} employees, ${dept.summary.plannedPayroll}₸`);
                    console.log(`  - Actual: ${dept.summary.actualCount} employees, ${dept.summary.actualPayroll}₸`);
                    console.log(`  - Difference: ${dept.summary.difference}₸ (${dept.summary.differencePercent}%)`);

                    if (dept.positions && dept.positions.length > 0) {
                        console.log(`  - Positions breakdown:`);
                        dept.positions.forEach(pos => {
                            console.log(`    * ${pos.positionName || 'Не указано'}:`);
                            console.log(`      Plan: ${pos.planned.count} ppl, ${pos.planned.payroll}₸`);
                            console.log(`      Actual: ${pos.actual.count} ppl, ${pos.actual.payroll}₸`);
                            console.log(`      Diff: ${pos.difference}₸`);
                        });
                    }
                });
            } else {
                console.log('\n⚠️ Test WARNING: No departments data found (departments array is empty)');
                console.log('   This could mean:');
                console.log('   1. No employees scheduled for this date');
                console.log('   2. No employees actually came to work');
                console.log('   3. Organization name mismatch in database');
            }

        } catch (error) {
            console.error('❌ Failed to parse JSON response:', error.message);
            console.log('Raw response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Request failed:', error.message);
});

req.end();
