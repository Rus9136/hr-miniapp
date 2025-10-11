const axios = require('axios');
const db = require('./backend/database_pg');

async function testPayrollAttendanceFinal() {
    try {
        console.log('=== Финальный тест API endpoint /api/admin/payroll/attendance ===\n');
        
        // 1. Создаем валидный UUID и обновляем БД
        const validUuid = '01712d5e-5123-45a2-9297-3df72eb084c7';
        
        // Найдем подразделение и обновим его UUID
        const department = await db.queryRow('SELECT id, object_code, object_name FROM departments LIMIT 1');
        if (department) {
            await db.query('UPDATE departments SET id_iiko = $1 WHERE id = $2', [validUuid, department.id]);
            console.log(`✅ Обновлен UUID для подразделения "${department.object_name}": ${validUuid}`);
        }
        
        // 2. Добавим тестового сотрудника с ФОТ
        const testEmployee = await db.queryRow(`
            INSERT INTO employees (object_code, table_number, full_name, payroll, status)
            VALUES ($1, 'TEST-001', 'Тестовый Сотрудник Иванович', 300000, 1)
            ON CONFLICT (table_number) 
            DO UPDATE SET payroll = 300000, object_code = $1
            RETURNING *
        `, [department.object_code]);
        
        console.log(`✅ Создан тестовый сотрудник: ${testEmployee.full_name} (ФОТ: ${testEmployee.payroll})`);
        
        // 3. Создаем тестовый график
        await db.query(`
            INSERT INTO work_schedules_1c (schedule_name, schedule_code, work_date, work_month, time_type, work_hours)
            VALUES 
                ('Тестовый график 8/2', 'TEST-001', '2025-07-03', '2025-07-01', 'РД', 8),
                ('Тестовый график 8/2', 'TEST-001', '2025-07-04', '2025-07-01', 'РД', 8),
                ('Тестовый график 8/2', 'TEST-001', '2025-07-05', '2025-07-01', 'РД', 8)
            ON CONFLICT (schedule_code, work_date) DO NOTHING
        `);
        
        // 4. Назначаем график сотруднику
        await db.query(`
            INSERT INTO employee_schedule_assignments (employee_id, employee_number, schedule_code, start_date)
            VALUES ($1, $2, 'TEST-001', '2025-07-01')
            ON CONFLICT DO NOTHING
        `, [testEmployee.id, testEmployee.table_number]);
        
        console.log('✅ Создан тестовый график и назначен сотруднику');
        
        // 5. Тестируем API
        console.log('\n🔍 Тестирование API...');
        
        const params = {
            department_id: validUuid,
            from_date: '2025-07-01',
            to_date: '2025-07-31'
        };
        
        console.log('Параметры запроса:', params);
        
        const response = await axios.get('http://localhost:3030/api/admin/payroll/attendance', {
            params: params
        });
        
        console.log('\n✅ Успешный ответ от API:');
        console.log(`Статус: ${response.status}`);
        console.log(`Найдено сотрудников: ${response.data.data.length}`);
        console.log(`Общее количество смен: ${response.data.summary.total_shifts}`);
        console.log(`Общий ФОТ: ${response.data.summary.total_payroll} тг`);
        
        if (response.data.data.length > 0) {
            const emp = response.data.data[0];
            console.log('\n📊 Данные сотрудника:');
            console.log(`- Имя: ${emp.employee_name}`);
            console.log(`- Табельный номер: ${emp.table_number}`);
            console.log(`- ФОТ за месяц: ${emp.payroll_total} тг`);
            console.log(`- Количество смен: ${emp.shifts.length}`);
            
            if (emp.shifts.length > 0) {
                console.log('\n📅 Смены:');
                emp.shifts.forEach(shift => {
                    console.log(`  ${shift.date}: ${shift.payroll_for_shift} тг (${shift.work_hours}ч, ${shift.schedule_name})`);
                });
            }
        }
        
        // 6. Тестируем валидацию
        console.log('\n🔍 Тестирование валидации...');
        
        // Тест без параметров
        try {
            await axios.get('http://localhost:3030/api/admin/payroll/attendance');
        } catch (error) {
            console.log('✅ Ошибка при отсутствии параметров:', error.response?.data?.error);
        }
        
        // Тест с неверным UUID
        try {
            await axios.get('http://localhost:3030/api/admin/payroll/attendance', {
                params: { department_id: 'not-a-uuid', from_date: '2025-07-01', to_date: '2025-07-31' }
            });
        } catch (error) {
            console.log('✅ Ошибка при неверном UUID:', error.response?.data?.error);
        }
        
        // Тест с неверными датами
        try {
            await axios.get('http://localhost:3030/api/admin/payroll/attendance', {
                params: { department_id: validUuid, from_date: '2025-07-31', to_date: '2025-07-01' }
            });
        } catch (error) {
            console.log('✅ Ошибка при неверном диапазоне дат:', error.response?.data?.error);
        }
        
        console.log('\n🎉 Все тесты пройдены успешно!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Ошибка:', error.response?.data || error.message);
        process.exit(1);
    }
}

testPayrollAttendanceFinal();