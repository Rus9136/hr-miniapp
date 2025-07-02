const db = require('./backend/database_pg');

async function checkTimeData() {
    try {
        console.log('Проверка данных времени для сотрудника АП00-00231');
        
        // Проверим данные в time_events
        const timeEvents = await db.query(`
            SELECT 
                employee_number,
                event_datetime,
                event_type,
                object_code,
                created_at
            FROM time_events 
            WHERE employee_number = 'АП00-00231' 
            ORDER BY event_datetime
            LIMIT 10
        `);
        
        console.log('\n=== ДАННЫЕ В ТАБЛИЦЕ time_events ===');
        timeEvents.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.event_datetime} - Тип: ${row.event_type} (${row.object_code})`);
        });
        
        // Проверим первые записи более детально
        console.log('\n=== ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ===');
        timeEvents.rows.slice(0, 5).forEach((row, index) => {
            console.log(`Запись ${index + 1}:`);
            console.log(`  Табельный номер: ${row.employee_number}`);
            console.log(`  Время события: ${row.event_datetime}`);
            console.log(`  Тип события: ${row.event_type}`);
            console.log(`  Код объекта: ${row.object_code}`);
            console.log(`  Создано: ${row.created_at}`);
            console.log('---');
        });
        
        // Сравним с данными API (первые несколько записей)
        console.log('\n=== СРАВНЕНИЕ С API ДАННЫМИ ===');
        const apiData = [
            { "event_datetime": "2025-05-01 09:04:42", "event": "1" },
            { "event_datetime": "2025-05-01 19:16:13", "event": "2" },
            { "event_datetime": "2025-05-02 09:09:56", "event": "1" },
            { "event_datetime": "2025-05-02 09:39:53", "event": "1" },
            { "event_datetime": "2025-05-02 19:11:51", "event": "2" }
        ];
        
        console.log('API данные:');
        apiData.forEach((item, index) => {
            console.log(`${index + 1}. ${item.event_datetime} - Тип: ${item.event}`);
        });
        
        console.log('\nБД данные:');
        timeEvents.rows.slice(0, 5).forEach((row, index) => {
            console.log(`${index + 1}. ${row.event_datetime} - Тип: ${row.event_type}`);
        });
        
        // Проверим временную зону базы данных
        const timezoneInfo = await db.query('SHOW timezone');
        console.log(`\nВременная зона БД: ${timezoneInfo.rows[0].TimeZone}`);
        
        // Проверим системное время
        const systemTime = await db.query('SELECT NOW() as current_time');
        console.log(`Текущее время БД: ${systemTime.rows[0].current_time}`);
        
    } catch (error) {
        console.error('Ошибка при проверке данных:', error);
    } finally {
        process.exit(0);
    }
}

checkTimeData();