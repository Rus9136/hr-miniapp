const axios = require('axios');

async function testSpecificPeriod() {
    try {
        console.log('=== Тестирование на конкретном периоде (первая неделя июля) ===\n');
        
        // Тестируем за первую неделю июля 2025
        const params = {
            dateFrom: '2025-07-01',
            dateTo: '2025-07-07'
        };
        
        console.log(`Тестирование отчета за период: ${params.dateFrom} - ${params.dateTo}`);
        
        const response = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params });
        
        if (response.data.success) {
            console.log(`\n✅ Отчет сгенерирован успешно!`);
            console.log(`Найдено записей: ${response.data.data.length}`);
            console.log(`Итоговая сумма: ${response.data.summary.total} тенге`);
            
            if (response.data.data.length > 0) {
                // Группируем по сотрудникам
                const employeeStats = {};
                
                response.data.data.forEach(record => {
                    const key = record.table_number;
                    if (!employeeStats[key]) {
                        employeeStats[key] = {
                            name: record.full_name,
                            department: record.department_name,
                            shifts_in_week: 0,
                            monthly_payroll: record.payroll,
                            total_shifts_in_period: record.shifts_count,
                            weekly_payroll_total: 0,
                            shifts: []
                        };
                    }
                    employeeStats[key].shifts_in_week++;
                    employeeStats[key].weekly_payroll_total += record.daily_payroll;
                    employeeStats[key].shifts.push({
                        date: record.work_date,
                        daily_payroll: record.daily_payroll,
                        work_hours: record.work_hours
                    });
                });
                
                console.log('\n📊 Детальный анализ для первых 3 сотрудников:');
                
                Object.values(employeeStats).slice(0, 3).forEach((emp, index) => {
                    console.log(`\n${index + 1}. ${emp.name} (${emp.department})`);
                    console.log(`   Месячная ЗП: ${emp.monthly_payroll.toLocaleString('ru-RU')} тенге`);
                    console.log(`   Всего смен в выбранном периоде: ${emp.total_shifts_in_period}`);
                    console.log(`   ФОТ на смену: ${(emp.monthly_payroll / emp.total_shifts_in_period).toFixed(2)} тенге`);
                    console.log(`   Смен за неделю: ${emp.shifts_in_week}`);
                    console.log(`   ФОТ за неделю: ${emp.weekly_payroll_total.toFixed(2)} тенге`);
                    console.log(`   Смены по дням:`);
                    emp.shifts.forEach(shift => {
                        console.log(`     ${shift.date}: ${shift.daily_payroll} тенге (${shift.work_hours}ч)`);
                    });
                    
                    // Проверяем корректность для этого сотрудника
                    const expectedDaily = emp.monthly_payroll / emp.total_shifts_in_period;
                    const actualDaily = emp.shifts[0].daily_payroll;
                    const expectedWeekly = expectedDaily * emp.shifts_in_week;
                    
                    console.log(`   Проверка: ожидаемая недельная сумма = ${expectedWeekly.toFixed(2)} тенге`);
                    console.log(`   Проверка: фактическая недельная сумма = ${emp.weekly_payroll_total.toFixed(2)} тенге`);
                    console.log(`   Расчет корректен: ${Math.abs(expectedWeekly - emp.weekly_payroll_total) < 0.01 ? '✅' : '❌'}`);
                });
                
                // Общая проверка
                const totalEmployees = Object.keys(employeeStats).length;
                const totalShifts = response.data.data.length;
                const avgShiftsPerEmployee = totalShifts / totalEmployees;
                
                console.log(`\n📈 Общая статистика:`);
                console.log(`Уникальных сотрудников: ${totalEmployees}`);
                console.log(`Общее количество смен: ${totalShifts}`);
                console.log(`Среднее смен на сотрудника за неделю: ${avgShiftsPerEmployee.toFixed(1)}`);
                
            } else {
                console.log('⚠️ Нет данных для анализа');
            }
            
        } else {
            console.log('❌ Ошибка в отчете:', response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    }
}

testSpecificPeriod();