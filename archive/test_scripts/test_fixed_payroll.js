const axios = require('axios');

async function testFixedPayrollLogic() {
    try {
        console.log('=== Тестирование исправленной логики отчета по ФОТ ===\n');
        
        // Тестируем за июль 2025 (текущий месяц)
        const params = {
            dateFrom: '2025-07-01',
            dateTo: '2025-07-31'
        };
        
        console.log(`Тестирование отчета за период: ${params.dateFrom} - ${params.dateTo}`);
        
        const response = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params });
        
        if (response.data.success) {
            console.log(`\n✅ Отчет сгенерирован успешно!`);
            console.log(`Найдено записей: ${response.data.data.length}`);
            console.log(`Итоговая сумма: ${response.data.summary.total} тенге`);
            
            if (response.data.data.length > 0) {
                // Анализируем несколько записей
                console.log('\n📊 Анализ данных:');
                
                // Группируем по сотрудникам для анализа
                const employeeStats = {};
                
                response.data.data.forEach(record => {
                    const key = record.table_number;
                    if (!employeeStats[key]) {
                        employeeStats[key] = {
                            name: record.full_name,
                            shifts: [],
                            monthly_payroll: record.payroll,
                            shifts_count: record.shifts_count,
                            total_daily_payroll: 0
                        };
                    }
                    employeeStats[key].shifts.push({
                        date: record.work_date,
                        daily_payroll: record.daily_payroll,
                        work_hours: record.work_hours,
                        schedule: record.schedule_name
                    });
                    employeeStats[key].total_daily_payroll += record.daily_payroll;
                });
                
                // Показываем примеры
                const employees = Object.values(employeeStats).slice(0, 3);
                
                employees.forEach((emp, index) => {
                    console.log(`\n${index + 1}. ${emp.name}:`);
                    console.log(`   Месячная ЗП: ${emp.monthly_payroll.toLocaleString('ru-RU')} тенге`);
                    console.log(`   Смен в периоде: ${emp.shifts_count}`);
                    console.log(`   ФОТ на смену: ${(emp.monthly_payroll / emp.shifts_count).toFixed(2)} тенге`);
                    console.log(`   Общий ФОТ за период: ${emp.total_daily_payroll.toFixed(2)} тенге`);
                    console.log(`   Примеры смен:`);
                    emp.shifts.slice(0, 2).forEach(shift => {
                        console.log(`     ${shift.date}: ${shift.daily_payroll} тенге (${shift.work_hours}ч, ${shift.schedule})`);
                    });
                });
                
                // Проверяем правильность расчетов
                console.log('\n🔍 Проверка расчетов:');
                
                const firstEmployee = employees[0];
                const expectedDailyPayroll = firstEmployee.monthly_payroll / firstEmployee.shifts_count;
                const actualDailyPayroll = firstEmployee.shifts[0].daily_payroll;
                
                console.log(`Ожидаемый ФОТ на день: ${expectedDailyPayroll.toFixed(2)}`);
                console.log(`Фактический ФОТ на день: ${actualDailyPayroll.toFixed(2)}`);
                console.log(`Расчет корректен: ${Math.abs(expectedDailyPayroll - actualDailyPayroll) < 0.01 ? '✅' : '❌'}`);
                
                // Проверяем итоговую сумму
                const calculatedTotal = response.data.data.reduce((sum, row) => sum + row.daily_payroll, 0);
                const reportedTotal = parseFloat(response.data.summary.total);
                
                console.log(`\nИтоговая сумма:`);
                console.log(`Расчетная: ${calculatedTotal.toFixed(2)} тенге`);
                console.log(`В отчете: ${reportedTotal.toFixed(2)} тенге`);
                console.log(`Сумма корректна: ${Math.abs(calculatedTotal - reportedTotal) < 0.01 ? '✅' : '❌'}`);
                
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

testFixedPayrollLogic();