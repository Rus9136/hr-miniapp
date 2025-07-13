const db = require('./backend/database_pg');

async function debugPayroll() {
    try {
        console.log('=== Отладка данных для payroll attendance ===\n');
        
        // 1. Проверяем назначения графиков
        const assignments = await db.queryRows(`
            SELECT * FROM employee_schedule_assignments 
            WHERE employee_number = 'TEST-001'
        `);
        console.log('1. Назначения графиков:', assignments);
        
        // 2. Проверяем графики
        const schedules = await db.queryRows(`
            SELECT * FROM work_schedules_1c 
            WHERE schedule_code = 'TEST-001'
            ORDER BY work_date
        `);
        console.log('\n2. Графики работы:', schedules);
        
        // 3. Проверяем сотрудника
        const employee = await db.queryRow(`
            SELECT * FROM employees 
            WHERE table_number = 'TEST-001'
        `);
        console.log('\n3. Сотрудник:', employee);
        
        // 4. Проверяем подразделение
        const department = await db.queryRow(`
            SELECT * FROM departments 
            WHERE id_iiko = '01712d5e-5123-45a2-9297-3df72eb084c7'::uuid
        `);
        console.log('\n4. Подразделение:', department);
        
        // 5. Тестируем запрос напрямую
        if (employee && department) {
            console.log('\n5. Тестирование основного запроса...');
            
            const query = `
                WITH department_employees AS (
                    SELECT DISTINCT
                        e.id as employee_id,
                        e.table_number,
                        e.full_name,
                        e.payroll,
                        e.object_code
                    FROM employees e
                    INNER JOIN departments d ON e.object_code = d.object_code
                    WHERE d.id_iiko = $1::uuid
                    AND e.status = 1
                    AND e.payroll IS NOT NULL
                    AND e.payroll > 0
                )
                SELECT * FROM department_employees
            `;
            
            const result = await db.queryRows(query, ['01712d5e-5123-45a2-9297-3df72eb084c7']);
            console.log('Сотрудники подразделения:', result);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

debugPayroll();