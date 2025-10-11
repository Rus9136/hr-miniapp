const axios = require('axios');
const db = require('./backend/database_pg');

async function testPayrollReport() {
    try {
        console.log('=== Тестирование отчета по ФОТ ===\n');
        
        // 1. Проверяем данные для отчета
        console.log('1. Проверка наличия данных для отчета...');
        
        const employees = await db.queryRows(`
            SELECT e.table_number, e.full_name, e.payroll, d.object_name as department
            FROM employees e
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE e.payroll IS NOT NULL
            LIMIT 5
        `);
        
        console.log(`Найдено ${employees.length} сотрудников с ФОТ:`);
        employees.forEach(emp => {
            console.log(`  ${emp.table_number} - ${emp.full_name}: ${emp.payroll} тенге (${emp.department || 'без подразделения'})`);
        });
        
        // 2. Проверяем назначения графиков
        console.log('\n2. Проверка назначений графиков...');
        
        const assignments = await db.queryRows(`
            SELECT COUNT(DISTINCT employee_number) as emp_count,
                   COUNT(*) as total_assignments,
                   MIN(start_date) as min_date,
                   MAX(start_date) as max_date
            FROM employee_schedule_assignments
        `);
        
        if (assignments[0].total_assignments > 0) {
            console.log(`Найдено ${assignments[0].total_assignments} назначений для ${assignments[0].emp_count} сотрудников`);
            console.log(`Период: с ${assignments[0].min_date} по ${assignments[0].max_date}`);
        } else {
            console.log('❌ Нет назначений графиков!');
        }
        
        // 3. Тестируем API эндпоинт
        console.log('\n3. Тестирование API эндпоинта...');
        
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const params = {
            dateFrom: firstDay.toISOString().split('T')[0],
            dateTo: lastDay.toISOString().split('T')[0]
        };
        
        console.log(`Запрос отчета за период: ${params.dateFrom} - ${params.dateTo}`);
        
        try {
            const response = await axios.get('http://localhost:3030/api/admin/reports/payroll', {
                params: params
            });
            
            console.log('\nОтвет API:');
            console.log(`Статус: ${response.status}`);
            console.log(`Найдено записей: ${response.data.data?.length || 0}`);
            console.log(`Итоговая сумма: ${response.data.summary?.total || 0} тенге`);
            
            if (response.data.data && response.data.data.length > 0) {
                console.log('\nПримеры данных:');
                response.data.data.slice(0, 3).forEach(row => {
                    console.log(`  ${row.work_date} | ${row.full_name} | ${row.daily_payroll} тенге`);
                });
            }
            
        } catch (apiError) {
            console.error('❌ Ошибка при вызове API:', apiError.response?.data || apiError.message);
        }
        
        // 4. Проверяем сотрудников с графиками и ФОТ
        console.log('\n4. Проверка сотрудников с графиками и ФОТ...');
        
        const readyEmployees = await db.queryRows(`
            SELECT COUNT(DISTINCT e.table_number) as count
            FROM employees e
            INNER JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
            WHERE e.payroll IS NOT NULL
        `);
        
        console.log(`Сотрудников с ФОТ и назначенными графиками: ${readyEmployees[0].count}`);
        
        process.exit(0);
    } catch (error) {
        console.error('Ошибка:', error);
        process.exit(1);
    }
}

testPayrollReport();