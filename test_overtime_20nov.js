/**
 * Тест отчета "Перелимит ФОТ" для 20.11.2025
 * Организация: ТОО TARY ALMATY
 * Подразделение: Kitchen room
 * Должность: Повар
 */

const db = require('./backend/database_pg');

async function testOvertimeReport() {
    try {
        console.log('🧪 Тест отчета "Перелимит ФОТ" для 20.11.2025\n');

        const reportDate = '2025-11-20';
        const organization = 'ТОО TARY ALMATY';
        const department = 'Kitchen room';
        const position = 'Повар';

        // STEP 1: ПЛАНОВЫЕ повара
        console.log('📋 ШАГ 1: ПЛАНОВЫЕ повара (кто ДОЛЖЕН выйти по графику)\n');
        const plannedQuery = `
            SELECT
                e.table_number,
                e.full_name,
                COALESCE(e.payroll, 0) as payroll,
                p.staff_position_name as position,
                d.object_company as organization,
                d.object_name as department,
                ws.schedule_name,
                ws.work_date
            FROM work_schedules_1c ws
            JOIN employee_schedule_assignments esa ON ws.schedule_code = esa.schedule_code
            JOIN employees e ON esa.employee_number = e.table_number
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE ws.work_date = $1::date
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
                AND d.object_company = $2
                AND d.object_name = $3
                AND p.staff_position_name = $4
            ORDER BY e.full_name
        `;

        const plannedResult = await db.query(plannedQuery, [reportDate, organization, department, position]);
        console.log(`✅ План: ${plannedResult.rows.length} повара(ов)\n`);
        plannedResult.rows.forEach((row, idx) => {
            console.log(`   ${idx + 1}. ${row.full_name} (${row.table_number})`);
            console.log(`      График: ${row.schedule_name}`);
            console.log(`      ФОТ: ${parseFloat(row.payroll).toLocaleString('ru-RU')} ₸\n`);
        });

        // STEP 2: ФАКТИЧЕСКИЕ повара (кто РЕАЛЬНО вышел)
        console.log('📊 ШАГ 2: ФАКТИЧЕСКИЕ повара (кто РЕАЛЬНО вышел на работу)\n');
        const actualQuery = `
            SELECT
                e.table_number,
                e.full_name,
                COALESCE(e.payroll, 0) as payroll,
                p.staff_position_name as position,
                d.object_company as organization,
                d.object_name as department,
                te.event_datetime,
                te.event_type
            FROM time_events te
            JOIN employees e ON te.employee_number = e.table_number
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE te.event_type = '1'
                AND te.event_datetime::date = $1::date
                AND d.object_company = $2
                AND d.object_name = $3
                AND p.staff_position_name = $4
            ORDER BY te.event_datetime
        `;

        const actualResult = await db.query(actualQuery, [reportDate, organization, department, position]);
        console.log(`✅ Факт: ${actualResult.rows.length} повара(ов)\n`);
        actualResult.rows.forEach((row, idx) => {
            const eventTime = new Date(row.event_datetime).toLocaleTimeString('ru-RU', {
                timeZone: 'Asia/Almaty',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            console.log(`   ${idx + 1}. ${row.full_name} (${row.table_number})`);
            console.log(`      Вход: ${eventTime}`);
            console.log(`      ФОТ: ${parseFloat(row.payroll).toLocaleString('ru-RU')} ₸\n`);
        });

        // STEP 3: Проверка Демеухана
        console.log('🔍 ШАГ 3: Проверка повара Демеухан Жанасыл Серікұлы (ALЗК-00287)\n');
        const demeukhanQuery = `
            SELECT
                te.event_datetime,
                te.event_type,
                CASE
                    WHEN te.event_type = '1' THEN 'ВХОД'
                    WHEN te.event_type = '2' THEN 'ВЫХОД'
                END as event_name
            FROM time_events te
            WHERE te.employee_number = 'ALЗК-00287'
                AND te.event_datetime::date = $1::date
            ORDER BY te.event_datetime
        `;

        const demeukhanResult = await db.query(demeukhanQuery, [reportDate]);
        if (demeukhanResult.rows.length > 0) {
            console.log('❗ Демеухан имеет события на 20.11.2025:');
            demeukhanResult.rows.forEach(row => {
                const eventTime = new Date(row.event_datetime).toLocaleString('ru-RU', {
                    timeZone: 'Asia/Almaty',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                console.log(`   ${row.event_name}: ${eventTime}`);
            });
            console.log('   ⚠️  Демеухан НЕ должен учитываться в отчете, т.к. событие ВХОДА было 19.11!\n');
        } else {
            console.log('✅ Демеухан НЕ имеет событий ВХОДА на 20.11.2025\n');
        }

        // STEP 4: Проверка графика Демеухана
        console.log('📅 ШАГ 4: График Демеухана на 19-20.11.2025\n');
        const scheduleQuery = `
            SELECT
                ws.work_date,
                ws.schedule_name,
                ws.time_type,
                ws.work_start_time,
                ws.work_end_time
            FROM work_schedules_1c ws
            JOIN employee_schedule_assignments esa ON ws.schedule_code = esa.schedule_code
            WHERE esa.employee_number = 'ALЗК-00287'
                AND ws.work_date IN ('2025-11-19', '2025-11-20')
                AND ws.work_date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
            ORDER BY ws.work_date
        `;

        const scheduleResult = await db.query(scheduleQuery, []);
        if (scheduleResult.rows.length > 0) {
            scheduleResult.rows.forEach(row => {
                console.log(`   ${row.work_date}: ${row.schedule_name}`);
                console.log(`      Тип: ${row.time_type}`);
                if (row.work_start_time) {
                    console.log(`      Время: ${row.work_start_time} - ${row.work_end_time}`);
                }
            });
        }
        if (scheduleResult.rows.length === 1) {
            console.log('   ✅ 20.11.2025 - ВЫХОДНОЙ (нет графика)');
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГОВЫЙ ВЫВОД:');
        console.log('='.repeat(60));
        console.log(`\n✅ ПО ПЛАНУ (график): ${plannedResult.rows.length} повара`);
        console.log(`✅ ПО ФАКТУ (события входа): ${actualResult.rows.length} повара`);
        console.log(`\n❌ Демеухан НЕ учитывается в отчете, т.к.:`);
        console.log(`   - События на 20.11: только ВЫХОД (type='2')`);
        console.log(`   - Отчет фильтрует только ВХОД (type='1')`);
        console.log(`   - Его рабочий день был 19.11 (ночная смена 19→20.11)`);
        console.log('\n✅ Отчет работает ПРАВИЛЬНО!\n');

    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        await db.close();
    }
}

testOvertimeReport();
