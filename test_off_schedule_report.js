#!/usr/bin/env node

/**
 * Test script for Off-Schedule Attendance Report
 * Tests various scenarios for the report functionality
 */

const API_BASE = 'http://localhost:3030/api/admin/reports';

async function testAPI(description, url) {
    console.log(`\n📋 Test: ${description}`);
    console.log(`🔗 URL: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            console.log(`❌ FAIL: HTTP ${response.status}`);
            console.log(`   Error: ${data.error || 'Unknown error'}`);
            return false;
        }

        console.log(`✅ PASS: HTTP ${response.status}`);
        console.log(`   Success: ${data.success}`);
        console.log(`   Date: ${data.date}`);
        console.log(`   Total records: ${data.totalCount}`);

        if (data.records && data.records.length > 0) {
            console.log(`   First record: ${data.records[0].employeeName} (${data.records[0].employeeNumber})`);
        }

        return true;
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Starting Off-Schedule Attendance Report Tests\n');
    console.log('='.repeat(60));

    const tests = [
        {
            description: 'Current date (2025-11-16)',
            url: `${API_BASE}/off-schedule-attendance?date=2025-11-16`
        },
        {
            description: 'Date with no events (2025-11-15)',
            url: `${API_BASE}/off-schedule-attendance?date=2025-11-15`
        },
        {
            description: 'Filter by department (Service hall)',
            url: `${API_BASE}/off-schedule-attendance?date=2025-11-16&department=00-000004`
        },
        {
            description: 'Invalid date format',
            url: `${API_BASE}/off-schedule-attendance?date=16-11-2025`
        },
        {
            description: 'Missing date parameter (should use today)',
            url: `${API_BASE}/off-schedule-attendance`
        }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        const result = await testAPI(test.description, test.url);
        if (result) {
            passed++;
        } else {
            failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between tests
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed (total: ${tests.length})`);

    if (failed === 0) {
        console.log('✅ All tests passed!');
    } else {
        console.log(`⚠️  ${failed} test(s) failed`);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
