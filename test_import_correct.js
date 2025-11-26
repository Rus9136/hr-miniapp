// Правильный тест импорта с подключением к Docker БД
const fetch = require('node-fetch');
const { Pool } = require('pg');

const API_BASE_URL = 'http://localhost:3030/api';
const TEST_CODE = `TEST-${Date.now()}`;

// Подключение к Docker БД (порт 5433 на хосте)
const pool = new Pool({
    host: 'localhost',
    port: 5433,  // Docker маппинг
    database: 'hr_tracker',
    user: 'hr_user',
    password: 'hr_secure_password'
});

const testData = {
    ДатаВыгрузки: new Date().toISOString().split('T')[0],
    КоличествоГрафиков: 1,
    Графики: [{
        НаименованиеГрафика: "Тестовый график с организациями",
        КодГрафика: TEST_CODE,
        Организации: ["230540000699", "221040029729"], // Два БИНа
        РабочиеДни: [{
            Дата: "2025-01-20",
            Месяц: "2025-01-01",
            ВидУчетаВремени: "Рабочий день",
            ДополнительноеЗначение: 8,
            ВремяНачалоРаботы: "09:00:00",
            ВремяЗавершениеРаботы: "18:00:00"
        }]
    }]
};

async function main() {
    try {
        console.log('='.repeat(60));
        console.log('ТЕСТ ИМПОРТА ГРАФИКОВ С ОРГАНИЗАЦИЯМИ');
        console.log('='.repeat(60));
        console.log(`Код графика: ${TEST_CODE}`);
        console.log(`Организации: ${testData.Графики[0].Организации.join(', ')}`);
        console.log('');

        // Импорт через API
        console.log('1. Отправка запроса на импорт...');
        const res = await fetch(`${API_BASE_URL}/admin/schedules/import-1c`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testData)
        });

        const result = await res.json();
        console.log('   Статус:', res.status);
        console.log('   Результат:', result.success ? '✅ SUCCESS' : '❌ FAILED');
        if (result.errors) {
            console.log('   Ошибки:', result.errors);
        }
        console.log('');

        // Проверка БД
        console.log('2. Проверка данных в БД (Docker)...');
        const dbResult = await pool.query(
            'SELECT * FROM schedule_organizations WHERE schedule_code = $1 ORDER BY organization_bin',
            [TEST_CODE]
        );

        console.log(`   Найдено связей: ${dbResult.rows.length}`);
        if (dbResult.rows.length > 0) {
            console.log('   Организации в БД:');
            dbResult.rows.forEach(r => console.log(`     - ${r.organization_bin} (id: ${r.id})`));
        }
        console.log('');

        // Проверка графика
        const scheduleResult = await pool.query(
            'SELECT COUNT(*) as count FROM work_schedules_1c WHERE schedule_code = $1',
            [TEST_CODE]
        );
        console.log(`   Рабочих дней в графике: ${scheduleResult.rows[0].count}`);
        console.log('');

        // Итоговая проверка
        console.log('3. Итоговая проверка:');
        const expectedOrgs = testData.Графики[0].Организации.length;
        const actualOrgs = dbResult.rows.length;

        if (actualOrgs === expectedOrgs) {
            console.log(`   ✅ ТЕСТ ПРОЙДЕН! Организации сохранены: ${actualOrgs}/${expectedOrgs}`);
        } else {
            console.log(`   ❌ ТЕСТ НЕ ПРОЙДЕН! Организации: ${actualOrgs}/${expectedOrgs}`);
        }
        console.log('');

        // Очистка тестовых данных
        console.log('4. Очистка тестовых данных...');
        await pool.query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [TEST_CODE]);
        await pool.query('DELETE FROM work_schedules_1c WHERE schedule_code = $1', [TEST_CODE]);
        console.log('   ✅ Данные удалены');
        console.log('');

        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ ОШИБКА:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

main();
