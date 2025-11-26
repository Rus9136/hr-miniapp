// Финальный тест с подробным логированием
const fetch = require('node-fetch');
const { pool } = require('./backend/database_pg');

const API_BASE_URL = 'http://localhost:3030/api';
const TEST_CODE = `FINAL-TEST-${Date.now()}`;

const testData = {
    ДатаВыгрузки: new Date().toISOString().split('T')[0],
    КоличествоГрафиков: 1,
    Графики: [{
        НаименованиеГрафика: "Финальный тест",
        КодГрафика: TEST_CODE,
        Организации: ["230540000699", "221040029729"],
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
    console.log('Отправка запроса на импорт...');
    const res = await fetch(`${API_BASE_URL}/admin/schedules/import-1c`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
    });
    
    const result = await res.json();
    console.log('Результат импорта:', JSON.stringify(result, null, 2));
    
    console.log('\nПроверка БД...');
    const dbResult = await pool.query(
        'SELECT * FROM schedule_organizations WHERE schedule_code = $1',
        [TEST_CODE]
    );
    
    console.log(`Найдено связей: ${dbResult.rows.length}`);
    dbResult.rows.forEach(r => console.log(`  - ${r.organization_bin}`));
    
    // Очистка
    await pool.query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [TEST_CODE]);
    await pool.query('DELETE FROM work_schedules_1c WHERE schedule_code = $1', [TEST_CODE]);
    await pool.end();
}

main().catch(console.error);






