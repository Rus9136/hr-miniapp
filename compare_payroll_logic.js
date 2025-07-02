const axios = require('axios');

async function comparePayrollLogic() {
    try {
        console.log('=== Сравнение старой и новой логики отчета по ФОТ ===\n');
        
        // Тестируем за небольшой период для наглядности
        const params = {
            dateFrom: '2025-07-01',
            dateTo: '2025-07-03'  // 3 дня
        };
        
        console.log(`Тестирование за период: ${params.dateFrom} - ${params.dateTo} (3 дня)\n`);
        
        const response = await axios.get('http://localhost:3030/api/admin/reports/payroll', { params });
        
        if (response.data.success) {
            console.log('✅ Новая логика (ИСПРАВЛЕНА):');
            console.log(`Найдено записей: ${response.data.data.length}`);
            console.log(`Итоговая сумма: ${response.data.summary.total} тенге`);
            
            // Анализируем данные
            const employeeStats = {};
            let totalActualShifts = 0;
            
            response.data.data.forEach(record => {
                const key = record.table_number;
                if (!employeeStats[key]) {
                    employeeStats[key] = {
                        name: record.full_name,
                        monthly_payroll: record.payroll,
                        actual_shifts_in_period: 0,
                        total_shifts_for_calculation: record.shifts_count,
                        total_daily_payroll: 0
                    };
                }
                employeeStats[key].actual_shifts_in_period++;
                employeeStats[key].total_daily_payroll += record.daily_payroll;
                totalActualShifts++;
            });
            
            const employeeCount = Object.keys(employeeStats).length;
            const avgShiftsPerEmployee = totalActualShifts / employeeCount;
            
            console.log(`Уникальных сотрудников: ${employeeCount}`);
            console.log(`Общее количество смен: ${totalActualShifts}`);
            console.log(`Среднее смен на сотрудника: ${avgShiftsPerEmployee.toFixed(1)}`);
            
            // Показываем примеры расчетов
            console.log('\n📊 Примеры расчетов (новая логика):');
            Object.values(employeeStats).slice(0, 2).forEach((emp, index) => {
                const dailyPayroll = emp.monthly_payroll / emp.total_shifts_for_calculation;
                console.log(`${index + 1}. ${emp.name}:`);
                console.log(`   Месячная ЗП: ${emp.monthly_payroll.toLocaleString('ru-RU')} тенге`);
                console.log(`   Смен в выбранном периоде (факт): ${emp.actual_shifts_in_period}`);
                console.log(`   Смен для расчета ФОТ: ${emp.total_shifts_for_calculation}`);
                console.log(`   ФОТ на день: ${dailyPayroll.toFixed(2)} тенге`);
                console.log(`   Итого за период: ${emp.total_daily_payroll.toFixed(2)} тенге`);
            });
            
            console.log('\n🔍 Что было бы при старой логике:');
            console.log(`❌ Старая логика создавала бы фиктивные записи:`);
            console.log(`   - По 3 календарных дня для каждого сотрудника = ${employeeCount * 3} записей`);
            console.log(`   - ФОТ на день считался как месячная_ЗП / календарные_дни_в_месяце`);
            console.log(`   - Результат: искаженные данные с фиктивными сменами`);
            
            console.log('\n✅ Новая логика (ПРАВИЛЬНАЯ):');
            console.log(`   - Только реальные смены из графиков: ${totalActualShifts} записей`);
            console.log(`   - ФОТ на день = месячная_ЗП / количество_смен_в_периоде`);
            console.log(`   - Результат: точные данные без фиктивных смен`);
            
            // Проверяем математику
            const calculatedTotal = response.data.data.reduce((sum, row) => sum + row.daily_payroll, 0);
            console.log(`\n🧮 Проверка математики:`);
            console.log(`Расчетная сумма: ${calculatedTotal.toFixed(2)} тенге`);
            console.log(`Сумма в отчете: ${response.data.summary.total} тенге`);
            console.log(`Расхождение: ${Math.abs(calculatedTotal - parseFloat(response.data.summary.total)).toFixed(2)} тенге`);
            
        } else {
            console.log('❌ Ошибка в отчете:', response.data.error);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    }
}

comparePayrollLogic();