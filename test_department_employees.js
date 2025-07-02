const axios = require('axios');

async function testDepartmentEmployees() {
    try {
        console.log('=== Тестирование отображения всех сотрудников подразделения ===\n');
        
        // Сначала получим список подразделений
        console.log('1. Получение списка подразделений...');
        const deptResponse = await axios.get('http://localhost:3030/api/admin/departments');
        const departments = deptResponse.data;
        
        // Выберем подразделение с несколькими сотрудниками
        const testDept = departments.find(d => d.object_name && d.object_name.includes('MG'));
        
        if (!testDept) {
            console.log('❌ Тестовое подразделение не найдено');
            return;
        }
        
        console.log(`Тестируем подразделение: ${testDept.object_name} (${testDept.object_code})`);
        console.log(`Организация: ${testDept.object_company}\n`);
        
        // Проверим сколько сотрудников в этом подразделении
        console.log('2. Проверка количества сотрудников в подразделении...');
        const employeesResponse = await axios.get('http://localhost:3030/api/admin/employees');
        const deptEmployees = employeesResponse.data.filter(emp => emp.object_code === testDept.object_code);
        console.log(`Всего сотрудников в подразделении: ${deptEmployees.length}`);
        
        if (deptEmployees.length > 0) {
            console.log('Примеры сотрудников:');
            deptEmployees.slice(0, 5).forEach((emp, index) => {
                console.log(`  ${index + 1}. ${emp.full_name} (${emp.table_number}) - ФОТ: ${emp.payroll || 'не указан'}`);
            });
        }
        
        // Тестируем отчет по ФОТ для этого подразделения
        console.log('\n3. Генерация отчета по ФОТ для подразделения...');
        const params = {
            dateFrom: '2025-07-01',
            dateTo: '2025-07-07',
            department: testDept.object_code
        };
        
        const payrollResponse = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params });
        
        if (payrollResponse.data.success) {
            console.log(`✅ Отчет сгенерирован успешно!`);
            console.log(`Найдено записей в отчете: ${payrollResponse.data.data.length}`);
            console.log(`Итоговая сумма: ${payrollResponse.data.summary.total} тенге`);
            
            // Анализируем уникальных сотрудников в отчете
            const uniqueEmployees = new Set();
            const employeeData = {};
            
            payrollResponse.data.data.forEach(record => {
                uniqueEmployees.add(record.table_number);
                if (!employeeData[record.table_number]) {
                    employeeData[record.table_number] = {
                        name: record.full_name,
                        department: record.department_name,
                        shifts: 0,
                        totalPayroll: 0
                    };
                }
                employeeData[record.table_number].shifts++;
                employeeData[record.table_number].totalPayroll += record.daily_payroll;
            });
            
            console.log(`Уникальных сотрудников в отчете: ${uniqueEmployees.size}`);
            
            if (uniqueEmployees.size > 0) {
                console.log('\nСотрудники в отчете:');
                Object.entries(employeeData).slice(0, 10).forEach(([tableNum, data], index) => {
                    console.log(`  ${index + 1}. ${data.name} (${tableNum})`);
                    console.log(`     Подразделение: ${data.department}`);
                    console.log(`     Смен: ${data.shifts}, Итого ФОТ: ${data.totalPayroll.toFixed(2)} тенге`);
                });
                
                if (uniqueEmployees.size > 10) {
                    console.log(`     ... и еще ${uniqueEmployees.size - 10} сотрудников`);
                }
            }
            
            // Проверим, что все записи действительно из нужного подразделения
            const wrongDeptRecords = payrollResponse.data.data.filter(record => 
                !record.department_name || !record.department_name.includes('MG')
            );
            
            if (wrongDeptRecords.length > 0) {
                console.log(`\n⚠️ Найдено ${wrongDeptRecords.length} записей из других подразделений:`);
                wrongDeptRecords.slice(0, 3).forEach(record => {
                    console.log(`  ${record.full_name} - ${record.department_name}`);
                });
            } else {
                console.log('\n✅ Все записи из правильного подразделения');
            }
            
        } else {
            console.log('❌ Ошибка генерации отчета:', payrollResponse.data.error);
        }
        
        // Сравним с отчетом без фильтров
        console.log('\n4. Сравнение с общим отчетом...');
        const generalResponse = await axios.get('http://localhost:3030/api/admin/reports/payroll', {
            params: { dateFrom: '2025-07-01', dateTo: '2025-07-07' }
        });
        
        if (generalResponse.data.success) {
            const generalUniqueEmployees = new Set(generalResponse.data.data.map(r => r.table_number));
            console.log(`Сотрудников в общем отчете: ${generalUniqueEmployees.size}`);
            console.log(`Сотрудников в отчете по подразделению: ${uniqueEmployees.size}`);
            console.log(`Фильтр работает корректно: ${uniqueEmployees.size < generalUniqueEmployees.size ? '✅' : '❌'}`);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    }
}

testDepartmentEmployees();