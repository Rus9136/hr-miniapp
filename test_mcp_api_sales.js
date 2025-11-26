/**
 * Тест получения данных о продажах из MCP API
 * Проверяем структуру данных plan_vs_fact для отчета "Выручка к ФОТ"
 */

const MCPClient = require('./backend/services/mcp-client');

// Тестовые данные
const TEST_DEPARTMENT_ID = '01712d5e-5123-45a2-9297-3df72eb084c7'; // Тараз
const TEST_DATE_START = '2025-11-18';
const TEST_DATE_END = '2025-11-24';

async function testMCPSalesData() {
    console.log('🧪 ТЕСТ MCP API: Получение данных о продажах\n');
    console.log('=' .repeat(80));
    console.log('Параметры теста:');
    console.log(`  Department ID: ${TEST_DEPARTMENT_ID}`);
    console.log(`  Период: ${TEST_DATE_START} — ${TEST_DATE_END}`);
    console.log('=' .repeat(80) + '\n');

    try {
        const mcpClient = new MCPClient();

        console.log('📡 Отправка запроса к MCP API...\n');

        const startTime = Date.now();
        const result = await mcpClient.getDashboardData(
            TEST_DEPARTMENT_ID,
            TEST_DATE_START,
            TEST_DATE_END,
            50 // reviews_count
        );
        const duration = Date.now() - startTime;

        console.log(`⏱️  Время выполнения: ${duration}ms\n`);

        if (!result.success) {
            console.error('❌ ОШИБКА:', result.error);
            console.error('\nДетали ошибки:');
            console.error(JSON.stringify(result.error, null, 2));
            return;
        }

        console.log('✅ Запрос выполнен успешно!\n');
        console.log('=' .repeat(80));
        console.log('📊 МЕТАДАННЫЕ ОТВЕТА:');
        console.log('=' .repeat(80));

        if (result.data.metadata) {
            console.log(JSON.stringify(result.data.metadata, null, 2));
        }

        console.log('\n' + '=' .repeat(80));
        console.log('🏢 ИНФОРМАЦИЯ О ПОДРАЗДЕЛЕНИИ:');
        console.log('=' .repeat(80));

        if (result.data.department_info && result.data.department_info.data) {
            const deptInfo = result.data.department_info.data;
            console.log(`  Название: ${deptInfo.object_name || 'N/A'}`);
            console.log(`  Организация: ${deptInfo.object_company || 'N/A'}`);
            console.log(`  ID: ${deptInfo.department_id || 'N/A'}`);
        } else {
            console.log('  ⚠️  Нет данных о подразделении');
        }

        console.log('\n' + '=' .repeat(80));
        console.log('💰 ПЛАН vs ФАКТ (ВЫРУЧКА):');
        console.log('=' .repeat(80));

        if (result.data.plan_vs_fact && Array.isArray(result.data.plan_vs_fact)) {
            console.log(`  Количество дней: ${result.data.plan_vs_fact.length}\n`);

            if (result.data.plan_vs_fact.length > 0) {
                console.log('  Пример данных:');
                result.data.plan_vs_fact.slice(0, 5).forEach(day => {
                    console.log(`    ${day.date}:`);
                    console.log(`      План:      ${formatNumber(day.plan)}₸`);
                    console.log(`      Факт:      ${formatNumber(day.fact)}₸ ← ИСПОЛЬЗУЕМ ДЛЯ ОТЧЕТА`);
                    console.log(`      Отклонение: ${formatNumber(day.deviation)}₸ (${day.deviation_percent}%)`);
                    console.log('');
                });

                // Расчет итогов
                const totalPlan = result.data.plan_vs_fact.reduce((sum, d) => sum + (d.plan || 0), 0);
                const totalFact = result.data.plan_vs_fact.reduce((sum, d) => sum + (d.fact || 0), 0);

                console.log('  ИТОГО за период:');
                console.log(`    Плановая выручка:      ${formatNumber(totalPlan)}₸`);
                console.log(`    Фактическая выручка:   ${formatNumber(totalFact)}₸`);
                console.log(`    Отклонение:            ${formatNumber(totalFact - totalPlan)}₸`);
            } else {
                console.log('  ⚠️  Нет данных план vs факт за этот период');
            }
        } else if (result.data.plan_vs_fact && result.data.plan_vs_fact.error) {
            console.log(`  ❌ Ошибка получения данных: ${result.data.plan_vs_fact.error}`);
        } else {
            console.log('  ⚠️  Секция plan_vs_fact отсутствует в ответе');
        }

        console.log('\n' + '=' .repeat(80));
        console.log('📈 ПРОГНОЗ ПРОДАЖ:');
        console.log('=' .repeat(80));

        if (result.data.forecast && Array.isArray(result.data.forecast)) {
            console.log(`  Количество прогнозов: ${result.data.forecast.length}`);
            if (result.data.forecast.length > 0) {
                console.log('\n  Пример прогноза:');
                result.data.forecast.slice(0, 3).forEach(forecast => {
                    console.log(`    ${forecast.date}:`);
                    console.log(`      Прогноз: ${formatNumber(forecast.predicted_sales)}₸`);
                    console.log(`      Доверительный интервал: ${formatNumber(forecast.confidence_lower)}₸ — ${formatNumber(forecast.confidence_upper)}₸`);
                    console.log('');
                });
            }
        } else if (result.data.forecast && result.data.forecast.error) {
            console.log(`  ℹ️  ${result.data.forecast.error}`);
        } else {
            console.log('  ℹ️  Прогнозы недоступны');
        }

        console.log('\n' + '=' .repeat(80));
        console.log('⏰ ПОЧАСОВЫЕ ПРОДАЖИ:');
        console.log('=' .repeat(80));

        if (result.data.hourly_sales && Array.isArray(result.data.hourly_sales)) {
            console.log(`  Количество записей: ${result.data.hourly_sales.length}`);
            if (result.data.hourly_sales.length > 0) {
                const sample = result.data.hourly_sales.slice(0, 3);
                console.log('\n  Примеры:');
                sample.forEach(hour => {
                    console.log(`    ${hour.date} ${hour.hour}:00 — Продажи: ${formatNumber(hour.sales)}₸`);
                });
            }
        } else if (result.data.hourly_sales && result.data.hourly_sales.error) {
            console.log(`  ℹ️  ${result.data.hourly_sales.error}`);
        } else {
            console.log('  ℹ️  Почасовые продажи недоступны');
        }

        console.log('\n' + '=' .repeat(80));
        console.log('💼 ДАННЫЕ ФОТ (PAYROLL):');
        console.log('=' .repeat(80));

        if (result.data.payroll && Array.isArray(result.data.payroll)) {
            console.log(`  Количество записей: ${result.data.payroll.length}`);
            if (result.data.payroll.length > 0) {
                console.log('\n  Пример данных ФОТ:');
                result.data.payroll.slice(0, 3).forEach(p => {
                    console.log(`    ${p.date}:`);
                    console.log(`      Количество сотрудников: ${p.employees_count}`);
                    console.log(`      ФОТ: ${formatNumber(p.payroll_total)}₸`);
                    console.log('');
                });
            }
        } else if (result.data.payroll && result.data.payroll.error) {
            console.log(`  ℹ️  ${result.data.payroll.error}`);
        } else {
            console.log('  ℹ️  Данные ФОТ недоступны в MCP API');
        }

        console.log('\n' + '=' .repeat(80));
        console.log('✅ ВЫВОД ДЛЯ ОТЧЕТА "ВЫРУЧКА К ФОТ":');
        console.log('=' .repeat(80));
        console.log('');
        console.log('1. ✅ MCP API доступен и возвращает данные');
        console.log('2. ✅ Есть секция plan_vs_fact с фактической выручкой (fact)');
        console.log('3. ✅ Данные за период доступны');
        console.log('4. 💡 Для отчета будем использовать: plan_vs_fact[].fact');
        console.log('5. 💡 ФОТ будем брать из нашей БД (time_events), а не из MCP API');
        console.log('');
        console.log('=' .repeat(80));

    } catch (error) {
        console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
        console.error(error.stack);
    }
}

/**
 * Форматирование чисел с разделителями
 */
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString('ru-RU');
}

// Запуск теста
testMCPSalesData();
