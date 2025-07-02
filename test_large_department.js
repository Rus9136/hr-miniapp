const axios = require('axios');

async function testLargeDepartment() {
    try {
        console.log('=== Тестирование подразделения с большим количеством сотрудников ===\n');
        
        // Тестируем отчет без фильтров для понимания общей картины
        console.log('1. Общий отчет за неделю...');
        const generalParams = {
            dateFrom: '2025-07-01',
            dateTo: '2025-07-07'
        };
        
        const generalResponse = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params: generalParams });
        
        if (generalResponse.data.success) {
            // Группируем по подразделениям
            const deptStats = {};
            
            generalResponse.data.data.forEach(record => {
                const deptName = record.department_name || 'Без подразделения';
                if (!deptStats[deptName]) {
                    deptStats[deptName] = {
                        employees: new Set(),
                        records: 0,
                        totalPayroll: 0
                    };
                }
                deptStats[deptName].employees.add(record.table_number);
                deptStats[deptName].records++;
                deptStats[deptName].totalPayroll += record.daily_payroll;
            });
            
            // Найдем подразделения с наибольшим количеством сотрудников
            const sortedDepts = Object.entries(deptStats)
                .map(([name, stats]) => ({
                    name,
                    employeeCount: stats.employees.size,
                    records: stats.records,
                    totalPayroll: stats.totalPayroll
                }))
                .sort((a, b) => b.employeeCount - a.employeeCount);
            
            console.log('Топ-10 подразделений по количеству сотрудников:');
            sortedDepts.slice(0, 10).forEach((dept, index) => {
                console.log(`  ${index + 1}. ${dept.name}`);
                console.log(`     Сотрудников: ${dept.employeeCount}, Записей: ${dept.records}, Сумма: ${dept.totalPayroll.toFixed(2)} тенге`);
            });
            
            // Выберем подразделение с хорошим количеством сотрудников для тестирования
            const testDept = sortedDepts.find(d => d.employeeCount >= 5 && d.employeeCount <= 20);
            
            if (!testDept) {
                console.log('❌ Подходящее подразделение для тестирования не найдено');
                return;
            }
            
            console.log(`\n2. Тестируем подразделение: ${testDept.name}`);
            console.log(`   Ожидаем ${testDept.employeeCount} сотрудников`);
            
            // Получим код подразделения
            const deptResponse = await axios.get('http://localhost:3030/api/admin/departments');
            const department = deptResponse.data.find(d => d.object_name === testDept.name);
            
            if (!department) {
                console.log('❌ Не найден код подразделения');
                return;
            }
            
            console.log(`   Код подразделения: ${department.object_code}`);
            
            // Тестируем фильтр по подразделению
            console.log('\n3. Генерация отчета с фильтром по подразделению...');
            const filteredParams = {
                dateFrom: '2025-07-01',
                dateTo: '2025-07-07',
                department: department.object_code
            };
            
            const filteredResponse = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params: filteredParams });
            
            if (filteredResponse.data.success) {
                const filteredEmployees = new Set(filteredResponse.data.data.map(r => r.table_number));
                
                console.log(`✅ Отфильтрованный отчет:`);
                console.log(`   Записей: ${filteredResponse.data.data.length}`);
                console.log(`   Уникальных сотрудников: ${filteredEmployees.size}`);
                console.log(`   Итоговая сумма: ${filteredResponse.data.summary.total} тенге`);
                
                // Проверяем соответствие ожиданиям
                console.log(`\n4. Проверка корректности фильтрации:`);
                console.log(`   Ожидалось сотрудников: ${testDept.employeeCount}`);
                console.log(`   Получено сотрудников: ${filteredEmployees.size}`);
                console.log(`   Соответствие: ${filteredEmployees.size === testDept.employeeCount ? '✅' : `❌ (разница: ${Math.abs(filteredEmployees.size - testDept.employeeCount)})`}`);
                
                // Показываем всех сотрудников в отфильтрованном отчете
                console.log(`\n5. Все сотрудники в отчете:`);
                const employeeData = {};
                
                filteredResponse.data.data.forEach(record => {
                    if (!employeeData[record.table_number]) {
                        employeeData[record.table_number] = {
                            name: record.full_name,
                            shifts: 0,
                            totalPayroll: 0
                        };
                    }
                    employeeData[record.table_number].shifts++;
                    employeeData[record.table_number].totalPayroll += record.daily_payroll;
                });
                
                Object.entries(employeeData).forEach(([tableNum, data], index) => {
                    console.log(`   ${index + 1}. ${data.name} (${tableNum})`);
                    console.log(`      Смен: ${data.shifts}, ФОТ: ${data.totalPayroll.toFixed(2)} тенге`);
                });
                
                // Проверяем, что все записи из правильного подразделения
                const wrongDeptRecords = filteredResponse.data.data.filter(record => 
                    record.department_name !== testDept.name
                );
                
                if (wrongDeptRecords.length > 0) {
                    console.log(`\n⚠️ Найдено ${wrongDeptRecords.length} записей из других подразделений!`);
                } else {
                    console.log(`\n✅ Все записи из правильного подразделения`);
                }
                
            } else {
                console.log('❌ Ошибка генерации отфильтрованного отчета:', filteredResponse.data.error);
            }
            
        } else {
            console.log('❌ Ошибка генерации общего отчета:', generalResponse.data.error);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    }
}

testLargeDepartment();