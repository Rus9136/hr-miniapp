// Test script for 1C work schedules import
const API_BASE_URL = 'http://localhost:3030/api';

// Sample test data in the format that 1C will send
const testData = {
    "ДатаВыгрузки": "2025-06-04T13:05:05",
    "КоличествоГрафиков": 2,
    "Графики": [
        {
            "НаименованиеГрафика": "05:00-17:00/MG 1 смена",
            "КодГрафика": "76c06530-1aad-11f0-90de-3cecef8cc60b",
            "РабочиеДни": [
                {
                    "Дата": "2025-01-03",
                    "Месяц": "2025-01-01",
                    "ВидУчетаВремени": "Рабочее время",
                    "ДополнительноеЗначение": 11
                },
                {
                    "Дата": "2025-01-04",
                    "Месяц": "2025-01-01",
                    "ВидУчетаВремени": "Рабочее время",
                    "ДополнительноеЗначение": 11
                },
                {
                    "Дата": "2025-01-07",
                    "Месяц": "2025-01-01",
                    "ВидУчетаВремени": "Рабочее время",
                    "ДополнительноеЗначение": 11
                },
                {
                    "Дата": "2025-01-08",
                    "Месяц": "2025-01-01",
                    "ВидУчетаВремени": "Рабочее время",
                    "ДополнительноеЗначение": 11
                }
            ]
        },
        {
            "НаименованиеГрафика": "08:00-20:00/Ночная смена",
            "КодГрафика": "87d17641-2bbe-22f1-91ef-4dfdg09dd71c",
            "РабочиеДни": [
                {
                    "Дата": "2025-01-03",
                    "Месяц": "2025-01-01",
                    "ВидУчетаВремени": "Рабочее время",
                    "ДополнительноеЗначение": 12
                },
                {
                    "Дата": "2025-01-04",
                    "Месяц": "2025-01-01",
                    "ВидУчетаВремени": "Рабочее время",
                    "ДополнительноеЗначение": 12
                }
            ]
        }
    ]
};

async function testImport() {
    try {
        console.log('🧪 Testing 1C schedules import...');
        console.log('📤 Sending test data:', JSON.stringify(testData, null, 2));

        const response = await fetch(`${API_BASE_URL}/admin/schedules/import-1c`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        console.log('📥 Response status:', response.status);
        
        const result = await response.json();
        console.log('📥 Response data:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ Import successful!');
            console.log('📊 Statistics:', result.statistics);
            
            // Test getting the imported data
            await testGet();
        } else {
            console.log('❌ Import failed:', result.error);
        }

    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

async function testGet() {
    try {
        console.log('\n🔍 Testing data retrieval...');

        // Test getting all 1C schedules
        const listResponse = await fetch(`${API_BASE_URL}/admin/schedules/1c/list`);
        const schedulesList = await listResponse.json();
        
        console.log('📋 Schedules list:');
        schedulesList.forEach(schedule => {
            console.log(`  - ${schedule.schedule_name} (${schedule.schedule_code}): ${schedule.work_days_count} work days`);
        });

        // Test getting detailed data for first schedule
        if (schedulesList.length > 0) {
            const firstSchedule = schedulesList[0];
            const detailResponse = await fetch(`${API_BASE_URL}/admin/schedules/1c?scheduleCode=${firstSchedule.schedule_code}`);
            const detailData = await detailResponse.json();
            
            console.log(`\n📄 Details for "${firstSchedule.schedule_name}":`);
            console.log('📊 Statistics:', detailData.statistics);
            console.log('🗓️ Work days:', detailData.schedules.length);
        }

    } catch (error) {
        console.error('❌ Get test error:', error);
    }
}

async function testValidation() {
    try {
        console.log('\n🛡️ Testing validation...');

        // Test with invalid data
        const invalidData = {
            "ДатаВыгрузки": "2025-06-04T13:05:05",
            "КоличествоГрафиков": 1,
            "Графики": [] // Empty array
        };

        const response = await fetch(`${API_BASE_URL}/admin/schedules/import-1c`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invalidData)
        });

        const result = await response.json();
        
        if (response.status === 400 && !result.success) {
            console.log('✅ Validation working correctly:', result.error);
        } else {
            console.log('❌ Validation test failed:', result);
        }

    } catch (error) {
        console.error('❌ Validation test error:', error);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting 1C import API tests...\n');
    
    await testImport();
    await testValidation();
    
    console.log('\n✅ All tests completed!');
}

// Check if this script is being run directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testImport, testGet, testValidation, runAllTests };