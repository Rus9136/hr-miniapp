/**
 * Тест отчета "Вне графика" с фильтром по организации
 * Проверяет работу обновленного API с параметром organization
 */

const BASE_URL = 'http://localhost:3030/api';

async function testOffScheduleWithOrganization() {
    console.log('🧪 Тестирование отчета "Вне графика" с фильтром по организации\n');

    // Тест 1: Проверка endpoint для получения организаций
    console.log('📋 Тест 1: Получение списка организаций');
    try {
        const response = await fetch(`${BASE_URL}/admin/organizations`);
        const organizations = await response.json();

        if (organizations && organizations.length > 0) {
            console.log(`✅ PASS: Получено ${organizations.length} организаций`);
            console.log(`   Примеры: ${organizations.slice(0, 3).map(o => o.object_company).join(', ')}\n`);
        } else {
            console.log('❌ FAIL: Организации не найдены\n');
        }
    } catch (error) {
        console.log(`❌ FAIL: Ошибка при получении организаций: ${error.message}\n`);
    }

    // Тест 2: Отчет без фильтра (все организации)
    console.log('📋 Тест 2: Отчет без фильтра по организации (все организации)');
    try {
        const response = await fetch(`${BASE_URL}/admin/reports/off-schedule-attendance?date=2025-11-16`);
        const result = await response.json();

        if (result.success) {
            console.log(`✅ PASS: Найдено ${result.totalCount} сотрудников (все организации)`);
            if (result.records && result.records.length > 0) {
                const uniqueOrgs = [...new Set(result.records.map(r => r.organizationName))];
                console.log(`   Организации в результатах: ${uniqueOrgs.join(', ')}\n`);
            }
        } else {
            console.log(`❌ FAIL: ${result.error}\n`);
        }
    } catch (error) {
        console.log(`❌ FAIL: Ошибка: ${error.message}\n`);
    }

    // Тест 3: Фильтр по конкретной организации
    console.log('📋 Тест 3: Отчет с фильтром по организации "ТОО Tary Astana"');
    try {
        const organization = 'ТОО Tary Astana';
        const response = await fetch(
            `${BASE_URL}/admin/reports/off-schedule-attendance?date=2025-11-16&organization=${encodeURIComponent(organization)}`
        );
        const result = await response.json();

        if (result.success) {
            console.log(`✅ PASS: Найдено ${result.totalCount} сотрудников из "${organization}"`);

            if (result.records && result.records.length > 0) {
                // Проверка что все записи действительно из этой организации
                const allFromOrg = result.records.every(r => r.organizationName === organization);
                if (allFromOrg) {
                    console.log('   ✅ Все записи относятся к выбранной организации');
                } else {
                    console.log('   ❌ Найдены записи из других организаций!');
                }

                // Показать примеры
                console.log(`\n   Примеры сотрудников:`);
                result.records.slice(0, 3).forEach(r => {
                    console.log(`   - ${r.employeeName} (${r.employeeNumber}) - ${r.departmentName} - вход в ${r.entryTime}`);
                });
            }
            console.log('');
        } else {
            console.log(`❌ FAIL: ${result.error}\n`);
        }
    } catch (error) {
        console.log(`❌ FAIL: Ошибка: ${error.message}\n`);
    }

    // Тест 4: Фильтр по другой организации
    console.log('📋 Тест 4: Отчет с фильтром по организации "ТОО Tary Taraz"');
    try {
        const organization = 'ТОО Tary Taraz';
        const response = await fetch(
            `${BASE_URL}/admin/reports/off-schedule-attendance?date=2025-11-16&organization=${encodeURIComponent(organization)}`
        );
        const result = await response.json();

        if (result.success) {
            console.log(`✅ PASS: Найдено ${result.totalCount} сотрудников из "${organization}"`);

            if (result.records && result.records.length > 0) {
                const allFromOrg = result.records.every(r => r.organizationName === organization);
                if (allFromOrg) {
                    console.log('   ✅ Все записи относятся к выбранной организации\n');
                } else {
                    console.log('   ❌ Найдены записи из других организаций!\n');
                }
            } else {
                console.log('   ℹ️ Нет сотрудников из этой организации в выбранную дату\n');
            }
        } else {
            console.log(`❌ FAIL: ${result.error}\n`);
        }
    } catch (error) {
        console.log(`❌ FAIL: Ошибка: ${error.message}\n`);
    }

    // Тест 5: Несуществующая организация
    console.log('📋 Тест 5: Отчет с фильтром по несуществующей организации');
    try {
        const organization = 'Несуществующая организация';
        const response = await fetch(
            `${BASE_URL}/admin/reports/off-schedule-attendance?date=2025-11-16&organization=${encodeURIComponent(organization)}`
        );
        const result = await response.json();

        if (result.success && result.totalCount === 0) {
            console.log(`✅ PASS: Корректно обработан фильтр по несуществующей организации (0 результатов)\n`);
        } else {
            console.log(`❌ FAIL: Ожидалось 0 результатов, получено ${result.totalCount}\n`);
        }
    } catch (error) {
        console.log(`❌ FAIL: Ошибка: ${error.message}\n`);
    }

    console.log('✅ Тестирование завершено!');
}

// Запуск тестов
testOffScheduleWithOrganization().catch(console.error);
