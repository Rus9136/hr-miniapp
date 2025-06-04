const db = require('./backend/database_pg');

async function fixTimezoneData() {
    try {
        console.log('🕐 Исправление временных зон в таблице time_events...\n');
        
        // Получаем все записи для проверки
        const allEvents = await db.query(`
            SELECT id, employee_number, event_datetime, event_type, object_code
            FROM time_events 
            WHERE employee_number = 'АП00-00231'
            ORDER BY event_datetime
        `);
        
        console.log(`Найдено ${allEvents.rows.length} записей для исправления`);
        
        let fixedCount = 0;
        
        for (const event of allEvents.rows) {
            try {
                // Текущее время в БД имеет GMT+2, но должно быть UTC+6
                // Значит нужно вычесть 2 часа и добавить 6 часов = +4 часа
                const currentTime = new Date(event.event_datetime);
                
                // Получаем время как строку в формате "YYYY-MM-DD HH:mm:ss"
                const timeString = currentTime.toISOString().slice(0, 19).replace('T', ' ');
                
                // Парсим как время в казахстанской зоне (UTC+6)
                const correctTime = new Date(timeString + '+06:00');
                
                // Обновляем запись
                await db.query(`
                    UPDATE time_events 
                    SET event_datetime = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [correctTime.toISOString(), event.id]);
                
                fixedCount++;
                
                if (fixedCount <= 5) {
                    console.log(`Исправлено ${fixedCount}: ${event.event_datetime} → ${correctTime.toISOString()}`);
                }
                
            } catch (error) {
                console.error(`Ошибка при обновлении записи ${event.id}:`, error.message);
            }
        }
        
        console.log(`\n✅ Исправлено ${fixedCount} записей`);
        
        // Показываем результат
        const updatedEvents = await db.query(`
            SELECT event_datetime, event_type
            FROM time_events 
            WHERE employee_number = 'АП00-00231'
            ORDER BY event_datetime
            LIMIT 5
        `);
        
        console.log('\n=== ИСПРАВЛЕННЫЕ ДАННЫЕ (первые 5) ===');
        updatedEvents.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.event_datetime} - Тип: ${row.event_type}`);
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
            // Конвертируем в казахстанское время для сравнения
            const dbLocalTime = new Date(dbTime.getTime() + (6 * 60 * 60 * 1000)); // UTC+6
            const formattedDbTime = dbLocalTime.toISOString().slice(0, 19).replace('T', ' ');
            
            console.log(`${index + 1}. API: ${item.event_datetime} | БД: ${formattedDbTime} | Совпадает: ${item.event_datetime === formattedDbTime ? '✅' : '❌'}`);
        });
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

fixTimezoneData();