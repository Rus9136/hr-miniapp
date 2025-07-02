const db = require('./backend/database_pg');

async function finalTimezoneTest() {
    try {
        console.log('🕐 Финальное тестирование временной зоны...\n');
        
        // Проверим временную зону PostgreSQL
        const pgTz = await db.query('SHOW timezone');
        console.log(`PostgreSQL timezone: ${pgTz.rows[0].timezone || pgTz.rows[0].TimeZone}`);
        
        // Проверим время в PostgreSQL
        const pgTime = await db.query('SELECT NOW() as now, NOW() AT TIME ZONE \'Asia/Almaty\' as almaty_time');
        console.log(`PostgreSQL NOW(): ${pgTime.rows[0].now}`);
        console.log(`PostgreSQL в Алматы: ${pgTime.rows[0].almaty_time}`);
        
        // Тестируем обработку времени как будет в production
        const apiTime = "2025-05-01 09:04:42";
        console.log(`\nИсходное время из API: ${apiTime}`);
        
        // Добавляем часовой пояс Казахстана (+05:00)
        const withTimezone = apiTime + '+05:00';
        console.log(`Время с часовым поясом: ${withTimezone}`);
        
        // Создаем объект Date
        const dateObj = new Date(withTimezone);
        console.log(`Date объект: ${dateObj.toISOString()}`);
        console.log(`В UTC: ${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth()+1).padStart(2,'0')}-${String(dateObj.getUTCDate()).padStart(2,'0')} ${String(dateObj.getUTCHours()).padStart(2,'0')}:${String(dateObj.getUTCMinutes()).padStart(2,'0')}:${String(dateObj.getUTCSeconds()).padStart(2,'0')}`);
        
        // Вставляем в БД
        console.log('\n--- ТЕСТИРУЕМ ВСТАВКУ В БД ---');
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-FINAL\'');
        
        await db.query(`
            INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
            VALUES ($1, $2, $3, $4)
        `, ['TEST-FINAL', '5045', dateObj.toISOString(), '1']);
        
        // Читаем обратно
        const result = await db.query(`
            SELECT 
                event_datetime,
                event_datetime AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Almaty' as almaty_time
            FROM time_events 
            WHERE employee_number = 'TEST-FINAL'
        `);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log(`Время в БД (raw): ${row.event_datetime}`);
            console.log(`Время в Алматы: ${row.almaty_time}`);
            
            // Извлекаем только дату и время без временной зоны
            const almaty = row.almaty_time;
            const almatyStr = almaty.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`Форматированное время Алматы: ${almatyStr}`);
            
            console.log(`\nСравнение:`);
            console.log(`API время:        ${apiTime}`);
            console.log(`Восстановленное:  ${almatyStr}`);
            console.log(`Совпадает: ${apiTime === almatyStr ? '✅ ДА' : '❌ НЕТ'}`);
        }
        
        // Очищаем тестовую запись
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-FINAL\'');
        
        console.log('\n✅ Тест завершен');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

finalTimezoneTest();