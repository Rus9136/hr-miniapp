const db = require('./backend/database_pg');

async function fixTimezoneDirect() {
    try {
        console.log('🕐 Прямое исправление времени в таблице time_events...\n');
        
        // Очищаем таблицу для этого сотрудника
        await db.query(`DELETE FROM time_events WHERE employee_number = 'АП00-00231'`);
        console.log('Очищены старые записи');
        
        // API данные с правильным временем
        const apiEvents = [
            { "object_code": "5045", "event_datetime": "2025-05-01 09:04:42", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-01 19:16:13", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-02 09:09:56", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-02 09:39:53", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-02 19:11:51", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-03 09:18:42", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-03 19:03:55", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-04 09:20:22", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-04 18:44:41", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-06 08:49:32", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-06 19:20:41", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-07 09:21:29", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-07 19:21:24", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-08 08:44:09", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-08 19:25:36", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-09 09:20:52", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-09 20:06:24", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-10 09:21:47", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-10 22:11:25", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-11 11:28:27", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-11 18:09:21", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-13 10:24:14", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-13 22:01:03", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-14 11:17:17", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-14 19:19:34", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-15 09:10:04", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-15 22:28:48", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-16 12:06:41", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-16 19:05:44", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-17 09:08:02", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-17 19:10:29", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-18 09:20:18", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-18 20:02:53", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-19 09:22:28", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-19 19:22:23", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-20 12:40:42", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-20 22:03:38", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-21 09:14:00", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-21 19:09:31", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-22 09:47:03", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-22 19:37:21", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-23 09:19:58", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-23 19:12:01", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-24 12:19:37", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-24 19:29:50", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-26 11:07:25", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-26 19:14:56", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-27 09:49:05", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-27 19:12:12", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-28 09:16:43", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-28 19:18:09", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-29 07:57:49", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-29 18:47:12", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-30 09:20:31", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-30 19:15:56", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-30 19:25:43", "event": "2" },
            { "object_code": "5045", "event_datetime": "2025-05-31 09:06:48", "event": "1" },
            { "object_code": "5045", "event_datetime": "2025-05-31 19:32:00", "event": "2" }
        ];
        
        let insertedCount = 0;
        
        for (const event of apiEvents) {
            // Вставляем время как есть, но указываем, что это время в казахстанской зоне
            const datetime = new Date(event.event_datetime + '+06:00'); // UTC+6 для Казахстана
            
            await db.query(`
                INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
                VALUES ($1, $2, $3, $4)
            `, ['АП00-00231', event.object_code, datetime, event.event]);
            
            insertedCount++;
        }
        
        console.log(`✅ Вставлено ${insertedCount} записей с правильным временем`);
        
        // Проверим результат
        const checkEvents = await db.query(`
            SELECT event_datetime, event_type
            FROM time_events 
            WHERE employee_number = 'АП00-00231'
            ORDER BY event_datetime
            LIMIT 5
        `);
        
        console.log('\n=== ПРОВЕРКА ИСПРАВЛЕННЫХ ДАННЫХ (первые 5) ===');
        checkEvents.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.event_datetime} - Тип: ${row.event_type}`);
        });
        
        // Проверим как это отображается в локальном времени Казахстана
        console.log('\n=== ВРЕМЯ В КАЗАХСТАНСКОЙ ЗОНЕ (UTC+6) ===');
        checkEvents.rows.forEach((row, index) => {
            const utcTime = new Date(row.event_datetime);
            const kazakhTime = new Date(utcTime.getTime() + 6 * 60 * 60 * 1000);
            const formattedTime = kazakhTime.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`${index + 1}. ${formattedTime} - Тип: ${row.event_type}`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

fixTimezoneDirect();