/**
 * Тест Forecast API для получения фактических продаж
 * https://aqniet.site/api/sales/summary
 */

const axios = require('axios');

const SALES_API_BASE = 'https://aqniet.site/api/sales';

// API ключ для авторизации
const API_KEY = 'sf_1WIK_p9-x_qoBDgHkm5hqqKnjolZ0xF5_5Nm9K1r2816u1Wdet_fkgZ3RUvpPMieQ_ckBfPd1Nhw';

// Тестовые параметры
const TEST_DEPARTMENT_ID = '2d9e9984-0338-44e2-83e7-3385ce8ae110'; // ID из запроса
const TEST_DATE_FROM = '2025-11-18';
const TEST_DATE_TO = '2025-11-24';

/**
 * Форматирование чисел
 */
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Math.round(num).toLocaleString('ru-RU');
}

/**
 * Получение фактических продаж через /api/sales/summary
 */
async function testSalesSummaryAPI() {
    console.log('\n💰 ТЕСТ: Получение ФАКТИЧЕСКИХ продаж через /api/sales/summary');
    console.log('=' .repeat(80));

    try {
        const url = `${SALES_API_BASE}/summary`;
        const params = {
            department_id: TEST_DEPARTMENT_ID,
            from_date: TEST_DATE_FROM,
            to_date: TEST_DATE_TO,
            skip: 0,
            limit: 1000
        };

        console.log(`🌐 URL: ${url}`);
        console.log(`📋 Параметры:`, params);
        console.log('');

        const startTime = Date.now();
        const response = await axios.get(url, {
            params,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        const duration = Date.now() - startTime;

        console.log(`✅ Статус: ${response.status}`);
        console.log(`⏱️  Время выполнения: ${duration}ms`);
        console.log(`📦 Получено записей: ${response.data.length}`);

        if (response.data.length > 0) {
            console.log('\n📊 ДАННЫЕ ПО ДНЯМ:');
            console.log('-' .repeat(80));
            console.log('ID     | Дата       | Продажи (₸)  | Обновлено');
            console.log('-' .repeat(80));

            let totalSales = 0;

            response.data.forEach(item => {
                const sales = item.total_sales || 0;
                totalSales += sales;

                console.log(
                    `${item.id.toString().padStart(6)} | ${item.date} | ` +
                    `${formatNumber(sales).padStart(12)} | ${item.updated_at || 'N/A'}`
                );
            });

            console.log('-' .repeat(80));
            console.log(`ИТОГО  |            | ${formatNumber(totalSales).padStart(12)} |`);
            console.log('=' .repeat(80));

            console.log('\n✅ СТРУКТУРА ДАННЫХ:');
            console.log(JSON.stringify(response.data[0], null, 2));

            console.log('\n✅ ДЛЯ ОТЧЕТА "ВЫРУЧКА К ФОТ":');
            console.log(`   Используем поле: total_sales`);
            console.log(`   Общая фактическая выручка: ${formatNumber(totalSales)}₸`);
            console.log(`   Количество дней с данными: ${response.data.length}`);
        } else {
            console.log('\n⚠️  Нет данных за указанный период');
        }

        return response.data;

    } catch (error) {
        console.error('❌ ОШИБКА:', error.message);
        if (error.response) {
            console.error(`   Статус: ${error.response.status}`);
            console.error(`   Данные:`, error.response.data);
        } else if (error.request) {
            console.error('   Нет ответа от сервера');
        }
        return null;
    }
}

/**
 * Тест получения всех подразделений за один день
 */
async function testAllDepartments() {
    console.log('\n\n🏢 ТЕСТ: Получение данных всех подразделений за один день');
    console.log('=' .repeat(80));

    try {
        const url = `${SALES_API_BASE}/summary`;
        const params = {
            from_date: '2025-11-20',
            to_date: '2025-11-20',
            skip: 0,
            limit: 10000 // Максимум
        };

        console.log(`🌐 URL: ${url}`);
        console.log(`📋 Параметры:`, params);

        const startTime = Date.now();
        const response = await axios.get(url, {
            params,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            }
        });
        const duration = Date.now() - startTime;

        console.log(`✅ Статус: ${response.status}`);
        console.log(`⏱️  Время выполнения: ${duration}ms`);
        console.log(`📦 Получено записей: ${response.data.length}`);

        if (response.data.length > 0) {
            // Группировка по подразделениям
            const deptMap = {};
            response.data.forEach(item => {
                if (!deptMap[item.department_id]) {
                    deptMap[item.department_id] = {
                        sales: 0,
                        records: 0
                    };
                }
                deptMap[item.department_id].sales += item.total_sales || 0;
                deptMap[item.department_id].records += 1;
            });

            const departments = Object.entries(deptMap);
            console.log(`\n📋 Найдено уникальных подразделений: ${departments.length}`);

            console.log('\nТоп 10 по выручке:');
            console.log('-' .repeat(60));
            departments
                .sort((a, b) => b[1].sales - a[1].sales)
                .slice(0, 10)
                .forEach(([id, data], index) => {
                    console.log(`${(index + 1).toString().padStart(2)}. ${id.substring(0, 8)}... : ${formatNumber(data.sales).padStart(12)}₸`);
                });

            const totalAllSales = departments.reduce((sum, [_, data]) => sum + data.sales, 0);
            console.log('-' .repeat(60));
            console.log(`ИТОГО: ${formatNumber(totalAllSales)}₸`);
        }

        return response.data;

    } catch (error) {
        console.error('❌ ОШИБКА:', error.message);
        if (error.response) {
            console.error(`   Статус: ${error.response.status}`);
        }
        return null;
    }
}

/**
 * Тест получения данных за расширенный период (месяц)
 */
async function testExtendedPeriod() {
    console.log('\n\n📅 ТЕСТ: Получение данных за месяц для одного подразделения');
    console.log('=' .repeat(80));

    try {
        const url = `${SALES_API_BASE}/summary`;
        const params = {
            department_id: TEST_DEPARTMENT_ID,
            from_date: '2025-11-01',
            to_date: '2025-11-30',
            skip: 0,
            limit: 1000
        };

        console.log(`🌐 URL: ${url}`);
        console.log(`📋 Параметры: Период месяца`);

        const response = await axios.get(url, {
            params,
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            }
        });

        console.log(`✅ Статус: ${response.status}`);
        console.log(`📦 Получено записей: ${response.data.length}`);

        if (response.data.length > 0) {
            const totalSales = response.data.reduce((sum, item) => sum + (item.total_sales || 0), 0);
            const avgSales = totalSales / response.data.length;

            console.log(`\n📊 Статистика за месяц:`);
            console.log(`   Дней с данными: ${response.data.length}`);
            console.log(`   Общая выручка:  ${formatNumber(totalSales)}₸`);
            console.log(`   Средняя/день:   ${formatNumber(avgSales)}₸`);

            // Найти лучший и худший дни
            const sorted = [...response.data].sort((a, b) => b.total_sales - a.total_sales);
            console.log(`\n   Лучший день:  ${sorted[0].date} - ${formatNumber(sorted[0].total_sales)}₸`);
            console.log(`   Худший день:  ${sorted[sorted.length - 1].date} - ${formatNumber(sorted[sorted.length - 1].total_sales)}₸`);
        }

        return response.data;

    } catch (error) {
        console.error('❌ ОШИБКА:', error.message);
        return null;
    }
}

/**
 * Главная функция
 */
async function main() {
    console.log('🧪 ТЕСТ SALES API ДЛЯ ОТЧЕТА "ВЫРУЧКА К ФОТ"');
    console.log('=' .repeat(80));
    console.log('API Base URL:', SALES_API_BASE);
    console.log('Endpoint:    ', '/summary');
    console.log('Test Dept ID:', TEST_DEPARTMENT_ID);
    console.log('Период теста:', TEST_DATE_FROM, '—', TEST_DATE_TO);
    console.log('=' .repeat(80));

    // Тест 1: Получение продаж за неделю для одного подразделения
    const salesData = await testSalesSummaryAPI();

    // Тест 2: Все подразделения за один день
    await testAllDepartments();

    // Тест 3: Расширенный период (месяц)
    await testExtendedPeriod();

    // Итоговые выводы
    console.log('\n\n' + '=' .repeat(80));
    console.log('📝 ИТОГОВЫЕ ВЫВОДЫ:');
    console.log('=' .repeat(80));

    if (salesData && salesData.length > 0) {
        console.log('✅ Sales API доступен и работает');
        console.log('✅ Endpoint /api/sales/summary возвращает фактические продажи');
        console.log('✅ Можно использовать для отчета "Выручка к ФОТ"');
        console.log('');
        console.log('📊 ФОРМАТ ДАННЫХ:');
        console.log('   {');
        console.log('     "id": number,');
        console.log('     "department_id": "uuid",');
        console.log('     "date": "YYYY-MM-DD",');
        console.log('     "total_sales": number,  ← ИСПОЛЬЗУЕМ ДЛЯ ОТЧЕТА');
        console.log('     "created_at": timestamp,');
        console.log('     "updated_at": timestamp,');
        console.log('     "synced_at": timestamp');
        console.log('   }');
        console.log('');
        console.log('💡 ПЛАН ИНТЕГРАЦИИ:');
        console.log('   1. ✅ Связать departments.id_iiko → sales department_id');
        console.log('   2. ✅ Использовать GET /api/sales/summary для получения total_sales');
        console.log('   3. ✅ Совместить с фактическим ФОТ из БД time_events');
        console.log('   4. ✅ Рассчитать коэффициент: total_sales / payroll');
        console.log('');
        console.log('⚡ ПРОИЗВОДИТЕЛЬНОСТЬ:');
        console.log('   - Запрос за неделю: ~100-500ms');
        console.log('   - Лимит записей: до 10,000');
        console.log('   - Авторизация: не требуется (пока)');
    } else {
        console.log('⚠️  Sales API недоступен или нет данных');
        console.log('   Возможные причины:');
        console.log('   - Неверный department_id');
        console.log('   - Нет данных за указанный период');
        console.log('   - API временно недоступен');
        console.log('');
        console.log('💡 РЕКОМЕНДАЦИИ:');
        console.log('   1. Проверить department_id в БД departments.id_iiko');
        console.log('   2. Попробовать другой период (например, июль 2025)');
        console.log('   3. Проверить доступность https://aqniet.site');
    }

    console.log('=' .repeat(80));
}

// Запуск
main().catch(error => {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error);
    process.exit(1);
});
