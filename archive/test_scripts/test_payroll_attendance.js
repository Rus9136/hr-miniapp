const axios = require('axios');
const db = require('./backend/database_pg');

async function testPayrollAttendance() {
    try {
        console.log('=== Тестирование нового API endpoint /api/payroll/attendance ===\n');
        
        // 1. Найдем подразделение с id_iiko
        console.log('1. Поиск подразделения с id_iiko...');
        const departments = await db.queryRows(`
            SELECT id, object_code, object_name, id_iiko::text as id_iiko
            FROM departments 
            WHERE id_iiko IS NOT NULL
            LIMIT 5
        `);
        
        if (departments.length === 0) {
            console.log('❌ Нет подразделений с id_iiko. Добавляем тестовое значение...');
            
            // Находим любое подразделение и добавляем ему id_iiko
            const anyDept = await db.queryRow('SELECT id, object_code, object_name FROM departments LIMIT 1');
            if (anyDept) {
                const testUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
                await db.query(
                    'UPDATE departments SET id_iiko = $1 WHERE id = $2',
                    [testUuid, anyDept.id]
                );
                console.log(`✅ Добавлен id_iiko ${testUuid} для подразделения "${anyDept.object_name}"`);
                departments.push({ ...anyDept, id_iiko: testUuid });
            }
        } else {
            console.log(`Найдено ${departments.length} подразделений с id_iiko:`);
            departments.forEach(dept => {
                console.log(`  ${dept.object_code} - ${dept.object_name} (id_iiko: ${dept.id_iiko})`);
            });
        }
        
        if (departments.length === 0) {
            console.log('❌ Не удалось найти или создать подразделение для тестирования');
            return;
        }
        
        const testDepartment = departments[0];
        
        // 2. Проверяем сотрудников в этом подразделении
        console.log(`\n2. Проверка сотрудников в подразделении "${testDepartment.object_name}"...`);
        const employees = await db.queryRows(`
            SELECT e.table_number, e.full_name, e.payroll
            FROM employees e
            WHERE e.object_code = $1 
            AND e.status = 1 
            AND e.payroll IS NOT NULL 
            AND e.payroll > 0
            LIMIT 5
        `, [testDepartment.object_code]);
        
        console.log(`Найдено ${employees.length} сотрудников с ФОТ:`);
        employees.forEach(emp => {
            console.log(`  ${emp.table_number} - ${emp.full_name}: ${emp.payroll} тг`);
        });
        
        // 3. Проверяем графики для этих сотрудников
        if (employees.length > 0) {
            console.log('\n3. Проверка графиков сотрудников...');
            const schedules = await db.queryRows(`
                SELECT 
                    esa.employee_number,
                    esa.schedule_code,
                    COUNT(DISTINCT ws.work_date) as shift_count,
                    MIN(ws.work_date) as first_shift,
                    MAX(ws.work_date) as last_shift
                FROM employee_schedule_assignments esa
                INNER JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
                WHERE esa.employee_number IN (${employees.map((_, i) => `$${i + 1}`).join(',')})
                AND ws.time_type != 'В'
                GROUP BY esa.employee_number, esa.schedule_code
            `, employees.map(e => e.table_number));
            
            console.log(`Найдено ${schedules.length} назначений графиков`);
            schedules.forEach(sch => {
                console.log(`  ${sch.employee_number}: ${sch.shift_count} смен (${sch.first_shift} - ${sch.last_shift})`);
            });
        }
        
        // 4. Тестируем API endpoint
        console.log('\n4. Тестирование API endpoint...');
        
        const today = new Date();
        const fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const params = {
            department_id: testDepartment.id_iiko,
            from_date: fromDate.toISOString().split('T')[0],
            to_date: toDate.toISOString().split('T')[0]
        };
        
        console.log('Параметры запроса:', params);
        
        try {
            const response = await axios.get('http://localhost:3030/api/admin/payroll/attendance', {
                params: params
            });
            
            console.log('\n✅ Успешный ответ от API:');
            console.log(`Статус: ${response.status}`);
            console.log('Данные:', JSON.stringify(response.data, null, 2));
            
            if (response.data.data && response.data.data.length > 0) {
                console.log('\nПример данных сотрудника:');
                const firstEmployee = response.data.data[0];
                console.log(`Сотрудник: ${firstEmployee.employee_name} (${firstEmployee.table_number})`);
                console.log(`ФОТ за месяц: ${firstEmployee.payroll_total} тг`);
                console.log(`Количество смен: ${firstEmployee.shifts.length}`);
                if (firstEmployee.shifts.length > 0) {
                    console.log(`Первая смена: ${firstEmployee.shifts[0].date} - ${firstEmployee.shifts[0].payroll_for_shift} тг`);
                }
            }
            
        } catch (apiError) {
            if (apiError.response) {
                console.error('❌ Ошибка API:', apiError.response.status);
                console.error('Ответ:', apiError.response.data);
            } else {
                console.error('❌ Ошибка запроса:', apiError.message);
            }
        }
        
        // 5. Тестируем валидацию
        console.log('\n5. Тестирование валидации параметров...');
        
        // Тест без параметров
        try {
            await axios.get('http://localhost:3030/api/admin/payroll/attendance');
        } catch (error) {
            console.log('✅ Правильная ошибка при отсутствии параметров:', error.response?.data?.error);
        }
        
        // Тест с неверным UUID
        try {
            await axios.get('http://localhost:3030/api/admin/payroll/attendance', {
                params: {
                    department_id: 'not-a-uuid',
                    from_date: '2025-07-01',
                    to_date: '2025-07-31'
                }
            });
        } catch (error) {
            console.log('✅ Правильная ошибка при неверном UUID:', error.response?.data?.error);
        }
        
        // Тест с неверным форматом даты
        try {
            await axios.get('http://localhost:3030/api/admin/payroll/attendance', {
                params: {
                    department_id: testDepartment.id_iiko,
                    from_date: '01-07-2025',
                    to_date: '31-07-2025'
                }
            });
        } catch (error) {
            console.log('✅ Правильная ошибка при неверном формате даты:', error.response?.data?.error);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

testPayrollAttendance();