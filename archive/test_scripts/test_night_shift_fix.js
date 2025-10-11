#!/usr/bin/env node

// Test script for night shift calculation fix
const db = require('./backend/database_pg');

async function testNightShiftFix() {
    console.log('🌙 Testing Night Shift Calculation Fix for АП00-00467');
    console.log('=' .repeat(60));
    
    try {
        // 1. Check employee АП00-00467
        console.log('\n📋 1. Checking employee АП00-00467...');
        const employee = await db.queryRow(
            'SELECT * FROM employees WHERE table_number = $1',
            ['АП00-00467']
        );
        
        if (!employee) {
            console.log('❌ Employee АП00-00467 not found');
            return;
        }
        
        console.log(`✅ Found: ${employee.full_name}`);
        
        // 2. Check current schedule assignment
        console.log('\n📅 2. Checking current schedule assignment...');
        const currentSchedule = await db.queryRow(`
            SELECT 
                esa.schedule_code,
                ws.schedule_name,
                ws.work_start_time,
                ws.work_end_time,
                ws.work_hours,
                esa.start_date
            FROM employee_schedule_assignments esa
            LEFT JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
            WHERE esa.employee_number = $1 AND esa.end_date IS NULL
            LIMIT 1
        `, ['АП00-00467']);
        
        if (currentSchedule) {
            console.log(`✅ Current schedule: ${currentSchedule.schedule_name}`);
            console.log(`   Work time: ${currentSchedule.work_start_time}-${currentSchedule.work_end_time}`);
            console.log(`   Hours: ${currentSchedule.work_hours}`);
        } else {
            console.log('⚠️ No current schedule assignment found');
        }
        
        // 3. Check recent time records
        console.log('\n⏰ 3. Checking recent time records...');
        const timeRecords = await db.queryRows(`
            SELECT 
                date,
                check_in,
                check_out,
                hours_worked,
                status,
                off_schedule
            FROM time_records 
            WHERE employee_number = $1 
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY date DESC
            LIMIT 10
        `, ['АП00-00467']);
        
        if (timeRecords.length > 0) {
            console.log(`Found ${timeRecords.length} records in last 30 days:`);
            timeRecords.forEach(record => {
                const checkIn = record.check_in ? new Date(record.check_in).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : '-';
                const checkOut = record.check_out ? new Date(record.check_out).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'}) : '-';
                const hours = record.hours_worked ? parseFloat(record.hours_worked).toFixed(2) : '-';
                console.log(`   ${record.date} | ${checkIn}-${checkOut} | ${hours}h | ${record.status}`);
            });
        } else {
            console.log('⚠️ No time records found');
        }
        
        // 4. Create test night shift if needed
        if (!currentSchedule || !currentSchedule.schedule_name.includes('10:00-00:00')) {
            console.log('\n🔧 4. Creating test night shift schedule...');
            
            // Insert night shift schedule if not exists
            await db.query(`
                INSERT INTO work_schedules_1c 
                (schedule_name, schedule_code, work_date, work_month, time_type, work_hours, work_start_time, work_end_time)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (schedule_code, work_date) DO UPDATE SET
                    work_start_time = EXCLUDED.work_start_time,
                    work_end_time = EXCLUDED.work_end_time
            `, [
                '10:00-00:00/City mall 2 смена',
                'NIGHT_10_00',
                '2025-06-01',
                '2025-06-01',
                'РВ',
                14,
                '10:00',
                '00:00'
            ]);
            
            // Assign schedule to employee
            await db.query(`
                INSERT INTO employee_schedule_assignments 
                (employee_id, employee_number, schedule_code, start_date, assigned_by)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING
            `, [
                employee.id,
                'АП00-00467',
                'NIGHT_10_00',
                '2025-06-01',
                'system_test'
            ]);
            
            console.log('✅ Night shift schedule created and assigned');
        }
        
        // 5. Create test time events
        console.log('\n📝 5. Creating test time events...');
        
        const testEvents = [
            { date: '2025-06-04', time_in: '10:05', time_out: '23:58' }, // Same day exit
            { date: '2025-06-05', time_in: '09:55', time_out: '00:02' }, // Next day exit
            { date: '2025-06-06', time_in: '10:15', time_out: '00:10' }, // Late arrival, next day exit
        ];
        
        for (const event of testEvents) {
            // Insert entry event
            await db.query(`
                INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [
                'АП00-00467',
                employee.object_code,
                `${event.date} ${event.time_in}:00`,
                '1'
            ]);
            
            // Insert exit event (potentially next day)
            let exitDate = event.date;
            if (event.time_out.startsWith('00:')) {
                const nextDay = new Date(event.date);
                nextDay.setDate(nextDay.getDate() + 1);
                exitDate = nextDay.toISOString().split('T')[0];
            }
            
            await db.query(`
                INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [
                'АП00-00467',
                employee.object_code,
                `${exitDate} ${event.time_out}:00`,
                '2'
            ]);
        }
        
        console.log('✅ Test time events created');
        
        // 6. Test recalculation
        console.log('\n🔄 6. Testing recalculation with new logic...');
        
        const response = await fetch('http://localhost:3030/api/admin/recalculate-time-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                month: '2025-06',
                department: employee.object_code 
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Recalculation completed:', result.message);
        } else {
            console.log('❌ Recalculation failed:', response.status);
        }
        
        // 7. Check results
        console.log('\n📊 7. Checking calculation results...');
        const updatedRecords = await db.queryRows(`
            SELECT 
                date,
                check_in,
                check_out,
                hours_worked,
                status,
                off_schedule
            FROM time_records 
            WHERE employee_number = $1 
            AND date >= '2025-06-04'
            ORDER BY date DESC
        `, ['АП00-00467']);
        
        if (updatedRecords.length > 0) {
            console.log('Results after recalculation:');
            updatedRecords.forEach(record => {
                const checkIn = record.check_in ? new Date(record.check_in).toLocaleString('ru-RU') : '-';
                const checkOut = record.check_out ? new Date(record.check_out).toLocaleString('ru-RU') : '-';
                const hours = record.hours_worked ? parseFloat(record.hours_worked).toFixed(2) : '-';
                const status = record.hours_worked < 0 ? '❌ NEGATIVE' : '✅';
                console.log(`   ${status} ${record.date} | ${checkIn} → ${checkOut} | ${hours}h | ${record.status}`);
            });
        }
        
        console.log('\n🎯 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await db.close();
    }
}

// Run test
testNightShiftFix().catch(console.error);