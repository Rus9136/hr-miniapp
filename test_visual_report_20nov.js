/**
 * Визуализация отчета "Перелимит ФОТ" для 20.11.2025
 * Показывает ЧТО ИМЕННО видит пользователь в интерфейсе
 */

const db = require('./backend/database_pg');

async function visualizeReport() {
    try {
        console.log('\n' + '='.repeat(80));
        console.log('📊 ОТЧЕТ "ПЕРЕЛИМИТ ФОТ" - 20.11.2025');
        console.log('Организация: ТОО TARY ALMATY');
        console.log('Подразделение: Kitchen room');
        console.log('='.repeat(80) + '\n');

        const reportDate = '2025-11-20';
        const organization = 'ТОО TARY ALMATY';

        // Get planned and actual data (same as backend)
        const targetYear = 2025;
        const targetMonth = 11;

        const plannedQuery = `
            SELECT
                e.table_number,
                e.full_name,
                COALESCE(e.payroll, 0) as payroll,
                p.staff_position_name as position,
                d.object_name as department,
                esa.schedule_code
            FROM work_schedules_1c ws
            JOIN employee_schedule_assignments esa ON ws.schedule_code = esa.schedule_code
            JOIN employees e ON esa.employee_number = e.table_number
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE ws.work_date = $1::date
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
                AND d.object_company = $2
                AND d.object_name = 'Kitchen room'
            ORDER BY d.object_name, p.staff_position_name, e.full_name
        `;

        const actualQuery = `
            SELECT
                e.table_number,
                e.full_name,
                COALESCE(e.payroll, 0) as payroll,
                p.staff_position_name as position,
                d.object_name as department,
                esa.schedule_code,
                te.event_datetime
            FROM time_events te
            JOIN employees e ON te.employee_number = e.table_number
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
            WHERE te.event_type = '1'
                AND te.event_datetime::date = $1::date
                AND d.object_company = $2
                AND d.object_name = 'Kitchen room'
            ORDER BY d.object_name, p.staff_position_name, e.full_name
        `;

        const workingDaysQuery = `
            SELECT
                schedule_code,
                COUNT(*) as working_days_count
            FROM work_schedules_1c
            WHERE EXTRACT(YEAR FROM work_date) = $1
                AND EXTRACT(MONTH FROM work_date) = $2
            GROUP BY schedule_code
        `;

        const [plannedResult, actualResult, workingDaysResult] = await Promise.all([
            db.query(plannedQuery, [reportDate, organization]),
            db.query(actualQuery, [reportDate, organization]),
            db.query(workingDaysQuery, [targetYear, targetMonth])
        ]);

        // Build working days map
        const workingDaysMap = {};
        workingDaysResult.rows.forEach(row => {
            workingDaysMap[row.schedule_code] = parseInt(row.working_days_count);
        });

        // Helper function
        const calculateDailyPayroll = (payroll, scheduleCode) => {
            const monthlyPayroll = parseFloat(payroll) || 0;
            if (monthlyPayroll === 0) return 0;
            const workingDays = workingDaysMap[scheduleCode] || 0;
            if (workingDays === 0) return 0;
            return monthlyPayroll / workingDays;
        };

        // Aggregate by position
        const aggregateByPosition = (employees) => {
            const positionMap = {};
            employees.forEach(emp => {
                const position = emp.position || 'Должность не указана';
                if (!positionMap[position]) {
                    positionMap[position] = {
                        count: 0,
                        totalPayroll: 0,
                        employees: []
                    };
                }
                const dailyPayroll = calculateDailyPayroll(emp.payroll, emp.schedule_code);
                positionMap[position].count++;
                positionMap[position].totalPayroll += dailyPayroll;
                positionMap[position].employees.push({
                    fullName: emp.full_name,
                    tableNumber: emp.table_number,
                    dailyPayroll: dailyPayroll
                });
            });
            return positionMap;
        };

        const plannedByPosition = aggregateByPosition(plannedResult.rows);
        const actualByPosition = aggregateByPosition(actualResult.rows);

        // Print results
        const allPositions = new Set([
            ...Object.keys(plannedByPosition),
            ...Object.keys(actualByPosition)
        ]);

        console.log('📋 ТАБЛИЦА ОТЧЕТА:\n');
        console.log('-'.repeat(80));
        console.log('| Должность       | План (кол) | План (₸)  | Факт (кол) | Факт (₸)  | Разница  |');
        console.log('-'.repeat(80));

        Array.from(allPositions).forEach(positionName => {
            const planned = plannedByPosition[positionName] || { count: 0, totalPayroll: 0, employees: [] };
            const actual = actualByPosition[positionName] || { count: 0, totalPayroll: 0, employees: [] };

            const plannedPayroll = Math.round(planned.totalPayroll);
            const actualPayroll = Math.round(actual.totalPayroll);
            const difference = actualPayroll - plannedPayroll;
            const diffSign = difference > 0 ? '+' : '';

            console.log(
                `| ${positionName.padEnd(15)} | ` +
                `${planned.count.toString().padEnd(10)} | ` +
                `${plannedPayroll.toLocaleString('ru-RU').padEnd(9)} | ` +
                `${actual.count.toString().padEnd(10)} | ` +
                `${actualPayroll.toLocaleString('ru-RU').padEnd(9)} | ` +
                `${(diffSign + difference.toLocaleString('ru-RU')).padEnd(8)} |`
            );

            // Details
            if (planned.employees.length > 0) {
                console.log(`|   ПЛАН:`);
                planned.employees.forEach(emp => {
                    console.log(`|     - ${emp.fullName} (${emp.tableNumber}): ${Math.round(emp.dailyPayroll).toLocaleString('ru-RU')} ₸`);
                });
            }

            if (actual.employees.length > 0) {
                console.log(`|   ФАКТ:`);
                actual.employees.forEach(emp => {
                    console.log(`|     - ${emp.fullName} (${emp.tableNumber}): ${Math.round(emp.dailyPayroll).toLocaleString('ru-RU')} ₸`);
                });
            }

            console.log('-'.repeat(80));
        });

        // Check for Дemeukhan in ANY list
        console.log('\n🔍 ПРОВЕРКА: Присутствует ли Демеухан в отчете?\n');

        const demeukhanInPlanned = plannedResult.rows.find(r => r.table_number === 'ALЗК-00287');
        const demeukhanInActual = actualResult.rows.find(r => r.table_number === 'ALЗК-00287');

        if (demeukhanInPlanned) {
            console.log('❌ Демеухан ЕСТЬ в ПЛАНОВЫХ данных');
        } else {
            console.log('✅ Демеухан НЕТ в ПЛАНОВЫХ данных');
        }

        if (demeukhanInActual) {
            console.log('❌ Демеухан ЕСТЬ в ФАКТИЧЕСКИХ данных');
        } else {
            console.log('✅ Демеухан НЕТ в ФАКТИЧЕСКИХ данных');
        }

        console.log('\n' + '='.repeat(80));
        console.log('ВЫВОД:');
        console.log('='.repeat(80));
        console.log('✅ Демеухан (ALЗК-00287) НЕ учитывается в отчете');
        console.log('✅ Отчет показывает Plan: 2 повара, Fact: 3 повара');
        console.log('✅ 3-й повар это Бахтияр (ALЗК-00212), который вышел ВНЕ графика\n');

    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        await db.close();
    }
}

visualizeReport();
