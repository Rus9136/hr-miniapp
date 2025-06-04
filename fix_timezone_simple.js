const db = require('./backend/database_pg');

async function fixTimezoneSimple() {
    try {
        console.log('🕐 Исправление временных зон в таблице time_events...\n');
        
        // Простой подход: сдвигаем время на 4 часа назад
        // Текущее время: GMT+2, нужное время: UTC+6
        // GMT+2 время на 4 часа больше чем нужное местное время
        // Например: 09:04 в БД (как GMT+2) должно быть 09:04 местное (UTC+6)
        // Для этого нужно сохранить в БД 09:04 - 2 часа = 07:04 UTC
        
        const result = await db.query(`
            UPDATE time_events 
            SET event_datetime = event_datetime - INTERVAL '4 hours'
            WHERE employee_number = 'АП00-00231'
        `);
        
        console.log(`✅ Обновлено ${result.rowCount} записей`);
        
        // Проверим результат
        const updatedEvents = await db.query(`
            SELECT event_datetime, event_type
            FROM time_events 
            WHERE employee_number = 'АП00-00231'
            ORDER BY event_datetime
            LIMIT 5
        `);
        
        console.log('\n=== ИСПРАВЛЕННЫЕ ДАННЫЕ (первые 5) ===');
        updatedEvents.rows.forEach((row, index) => {
            const localTime = new Date(row.event_datetime);
            console.log(`${index + 1}. ${localTime.toISOString().slice(0, 19).replace('T', ' ')} - Тип: ${row.event_type}`);
        });
        
        // Сравним с API данными
        console.log('\n=== СРАВНЕНИЕ С API ===');
        const apiData = [
            { "event_datetime": "2025-05-01 09:04:42", "event": "1" },
            { "event_datetime": "2025-05-01 19:16:13", "event": "2" },
            { "event_datetime": "2025-05-02 09:09:56", "event": "1" },
            { "event_datetime": "2025-05-02 09:39:53", "event": "1" },
            { "event_datetime": "2025-05-02 19:11:51", "event": "2" }
        ];
        
        apiData.forEach((item, index) => {
            const dbTime = new Date(updatedEvents.rows[index].event_datetime);
            const formattedDbTime = dbTime.toISOString().slice(0, 19).replace('T', ' ');
            
            console.log(`${index + 1}. API: ${item.event_datetime} | БД: ${formattedDbTime} | Совпадает: ${item.event_datetime === formattedDbTime ? '✅' : '❌'}`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

fixTimezoneSimple();