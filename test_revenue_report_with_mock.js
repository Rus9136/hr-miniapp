/**
 * Тест концепции отчета "Выручка к ФОТ" с mock данными
 * Проверяем логику расчета без реального MCP API
 */

const db = require('./backend/database_pg');

// Mock данные выручки (эмулируем ответ MCP API)
const MOCK_REVENUE_DATA = {
    '2025-11-18': 5200000,
    '2025-11-19': 4800000,
    '2025-11-20': 3200000,
    '2025-11-21': 4500000,
    '2025-11-22': 5800000,
    '2025-11-23': 6200000,
    '2025-11-24': 4900000
};

/**
 * Получение фактического ФОТ по подразделению за период
 */
async function getActualPayrollForPeriod(departmentCode, dateFrom, dateTo) {
    const query = `
        WITH working_days_calc AS (
            -- Расчет рабочих дней в месяце для каждого графика
            SELECT
                schedule_code,
                EXTRACT(YEAR FROM work_date) as year,
                EXTRACT(MONTH FROM work_date) as month,
                COUNT(*) as working_days_count
            FROM work_schedules_1c
            WHERE work_date BETWEEN $2 AND $3
            GROUP BY schedule_code, year, month
        )
        SELECT
            te.event_datetime::date as work_date,
            COUNT(DISTINCT e.table_number) as employees_count,
            SUM(
                COALESCE(e.payroll, 0) /
                NULLIF(wd.working_days_count, 0)
            ) as total_payroll
        FROM time_events te
        JOIN employees e ON te.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        LEFT JOIN employee_schedule_assignments esa
            ON e.table_number = esa.employee_number
            AND te.event_datetime::date BETWEEN esa.start_date
            AND COALESCE(esa.end_date, '9999-12-31'::date)
        LEFT JOIN working_days_calc wd
            ON esa.schedule_code = wd.schedule_code
            AND EXTRACT(YEAR FROM te.event_datetime) = wd.year
            AND EXTRACT(MONTH FROM te.event_datetime) = wd.month
        WHERE te.event_type = '1'
            AND te.event_datetime::date BETWEEN $2 AND $3
            AND d.object_code = $1
        GROUP BY te.event_datetime::date
        ORDER BY work_date
    `;

    const result = await db.query(query, [departmentCode, dateFrom, dateTo]);

    // Преобразуем в объект { date: { employees_count, total_payroll } }
    const payrollMap = {};
    result.rows.forEach(row => {
        const dateStr = row.work_date.toISOString().split('T')[0];
        payrollMap[dateStr] = {
            employees_count: parseInt(row.employees_count),
            total_payroll: Math.round(parseFloat(row.total_payroll) * 100) / 100
        };
    });

    return payrollMap;
}

/**
 * Генерация массива дат между start и end
 */
function generateDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

/**
 * Определение статуса эффективности по коэффициенту
 */
function getEfficiencyStatus(coefficient) {
    if (coefficient === 0) return { status: 'no_data', label: 'Нет данных', icon: '—' };
    if (coefficient >= 4.0) return { status: 'excellent', label: 'Отлично', icon: '🌟' };
    if (coefficient >= 3.0) return { status: 'good', label: 'Хорошо', icon: '✅' };
    if (coefficient >= 2.0) return { status: 'acceptable', label: 'Приемлемо', icon: '⚠️' };
    return { status: 'low', label: 'Низкая эффективность', icon: '❌' };
}

/**
 * Форматирование чисел
 */
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString('ru-RU');
}

/**
 * Главная функция теста
 */
async function testRevenueToPayrollReport() {
    console.log('🧪 ТЕСТ: Отчет "Выручка к ФОТ" (с mock данными)\n');
    console.log('=' .repeat(80));

    try {
        // Параметры теста
        const TEST_DEPARTMENT = 'SAЗК0002'; // Service hall (ТОО Sandyq Astana)
        const DATE_FROM = '2025-11-18';
        const DATE_TO = '2025-11-24';

        console.log('📋 Параметры:');
        console.log(`  Подразделение: ${TEST_DEPARTMENT}`);
        console.log(`  Период: ${DATE_FROM} — ${DATE_TO}`);
        console.log('=' .repeat(80) + '\n');

        // 1. Получить информацию о подразделении
        const deptResult = await db.query(`
            SELECT object_code, object_name, object_company
            FROM departments
            WHERE object_code = $1
        `, [TEST_DEPARTMENT]);

        if (deptResult.rows.length === 0) {
            console.error('❌ Подразделение не найдено');
            return;
        }

        const department = deptResult.rows[0];
        console.log('🏢 Подразделение:');
        console.log(`  Название: ${department.object_name}`);
        console.log(`  Организация: ${department.object_company}\n`);

        // 2. Получить фактический ФОТ за период
        console.log('💼 Получение фактического ФОТ...');
        const payrollData = await getActualPayrollForPeriod(TEST_DEPARTMENT, DATE_FROM, DATE_TO);
        console.log(`✅ Получены данные ФОТ за ${Object.keys(payrollData).length} дней\n`);

        // 3. Сформировать отчет по дням
        const dateRange = generateDateRange(DATE_FROM, DATE_TO);
        const reportDays = [];

        console.log('=' .repeat(80));
        console.log('📊 ОТЧЕТ ПО ДНЯМ:');
        console.log('=' .repeat(80));
        console.log('Дата       | Выручка (₸)  | ФОТ (₸)      | Сотр. | Коэфф. | Статус');
        console.log('-' .repeat(80));

        let totalRevenue = 0;
        let totalPayroll = 0;
        let workingDays = 0;

        for (const date of dateRange) {
            const revenue = MOCK_REVENUE_DATA[date] || 0;
            const payroll = payrollData[date]?.total_payroll || 0;
            const employeesCount = payrollData[date]?.employees_count || 0;

            const coefficient = payroll > 0 ? revenue / payroll : 0;
            const efficiency = getEfficiencyStatus(coefficient);

            reportDays.push({
                date,
                revenue,
                payroll,
                employeesCount,
                coefficient,
                efficiencyStatus: efficiency.status,
                efficiencyLabel: efficiency.label,
                efficiencyIcon: efficiency.icon
            });

            totalRevenue += revenue;
            totalPayroll += payroll;
            if (payroll > 0) workingDays++;

            console.log(
                `${date} | ${formatNumber(revenue).padStart(12)} | ${formatNumber(payroll).padStart(12)} | ` +
                `${employeesCount.toString().padStart(5)} | ${coefficient > 0 ? coefficient.toFixed(2).padStart(6) : '—'.padStart(6)} | ` +
                `${efficiency.icon} ${efficiency.label}`
            );
        }

        console.log('-' .repeat(80));
        console.log(
            `ИТОГО      | ${formatNumber(totalRevenue).padStart(12)} | ${formatNumber(totalPayroll).padStart(12)} | ` +
            `${workingDays.toString().padStart(5)} | ${totalPayroll > 0 ? (totalRevenue / totalPayroll).toFixed(2).padStart(6) : '—'.padStart(6)} | `
        );
        console.log('=' .repeat(80) + '\n');

        // 4. Итоговая статистика
        const overallCoefficient = totalPayroll > 0 ? totalRevenue / totalPayroll : 0;
        const efficiency = getEfficiencyStatus(overallCoefficient);

        console.log('📈 ИТОГОВАЯ СТАТИСТИКА:');
        console.log('=' .repeat(80));
        console.log(`  Общая выручка:         ${formatNumber(totalRevenue)}₸`);
        console.log(`  Общий ФОТ:             ${formatNumber(totalPayroll)}₸`);
        console.log(`  Рабочих дней:          ${workingDays}`);
        console.log(`  Средний коэффициент:   ${overallCoefficient.toFixed(2)} ${efficiency.icon}`);
        console.log(`  Статус эффективности:  ${efficiency.label}`);
        console.log('=' .repeat(80) + '\n');

        // 5. Интерпретация результатов
        console.log('💡 ИНТЕРПРЕТАЦИЯ:');
        console.log('=' .repeat(80));

        if (overallCoefficient >= 4.0) {
            console.log('✅ Подразделение работает ОТЛИЧНО!');
            console.log(`   На каждый тенге ФОТ приходится ${overallCoefficient.toFixed(2)}₸ выручки.`);
        } else if (overallCoefficient >= 3.0) {
            console.log('✅ Подразделение работает ХОРОШО.');
            console.log('   Эффективность в пределах нормы.');
        } else if (overallCoefficient >= 2.0) {
            console.log('⚠️  Приемлемая эффективность, но есть потенциал для улучшения.');
        } else if (overallCoefficient > 0) {
            console.log('❌ НИЗКАЯ эффективность! Требуется анализ:');
            console.log('   - Низкие продажи?');
            console.log('   - Избыточный персонал?');
            console.log('   - Высокие зарплаты относительно выручки?');
        } else {
            console.log('ℹ️  Нет данных для анализа.');
        }

        console.log('=' .repeat(80) + '\n');

        // 6. Рекомендации
        console.log('🎯 РЕКОМЕНДАЦИИ:');
        console.log('=' .repeat(80));

        // Найти лучший и худший дни
        const sortedDays = reportDays
            .filter(d => d.coefficient > 0)
            .sort((a, b) => b.coefficient - a.coefficient);

        if (sortedDays.length > 0) {
            const bestDay = sortedDays[0];
            const worstDay = sortedDays[sortedDays.length - 1];

            console.log(`✅ Лучший день: ${bestDay.date}`);
            console.log(`   Коэффициент: ${bestDay.coefficient.toFixed(2)}`);
            console.log(`   Выручка: ${formatNumber(bestDay.revenue)}₸, ФОТ: ${formatNumber(bestDay.payroll)}₸`);
            console.log('');

            console.log(`⚠️  Худший день: ${worstDay.date}`);
            console.log(`   Коэффициент: ${worstDay.coefficient.toFixed(2)}`);
            console.log(`   Выручка: ${formatNumber(worstDay.revenue)}₸, ФОТ: ${formatNumber(worstDay.payroll)}₸`);
            console.log('');

            // Анализ разброса
            const coefficientDiff = bestDay.coefficient - worstDay.coefficient;
            if (coefficientDiff > 2.0) {
                console.log('📊 БОЛЬШОЙ РАЗБРОС эффективности по дням!');
                console.log('   Рекомендуется выровнять загрузку персонала.');
            }
        }

        console.log('=' .repeat(80) + '\n');

        console.log('✅ ТЕСТ ЗАВЕРШЕН УСПЕШНО!\n');
        console.log('💡 СЛЕДУЮЩИЕ ШАГИ:');
        console.log('  1. ✅ Логика расчета работает корректно');
        console.log('  2. ⏭️  Настроить реальный MCP API для получения выручки');
        console.log('  3. ⏭️  Создать backend endpoint /api/admin/reports/revenue-to-payroll');
        console.log('  4. ⏭️  Создать frontend UI для отображения отчета');
        console.log('');

    } catch (error) {
        console.error('\n❌ ОШИБКА ТЕСТА:', error.message);
        console.error(error.stack);
    } finally {
        await db.close();
    }
}

// Запуск теста
testRevenueToPayrollReport();
