const db = require('./backend/database_pg');

async function testTimezoneFix() {
    try {
        console.log('🕐 Тестирование корректности временной зоны...\n');
        
        // Проверим временную зону базы данных
        const timezoneInfo = await db.query('SHOW timezone');
        console.log(`Временная зона БД: ${timezoneInfo.rows[0].TimeZone || timezoneInfo.rows[0].timezone}`);
        
        // Проверим текущее время в БД
        const currentTime = await db.query('SELECT NOW() as current_time');
        console.log(`Текущее время БД: ${currentTime.rows[0].current_time}`);
        
        // Тестируем обработку времени из API
        const testApiDateTime = "2025-05-01 09:04:42";
        console.log(`\nТестируем время из API: ${testApiDateTime}`);
        
        // Так как время в API соответствует часовому поясу Астаны (GMT+5)
        const localDateTime = new Date(testApiDateTime + '+05:00');
        console.log(`Обработанное время для БД: ${localDateTime.toISOString()}`);
        console.log(`Время в местной зоне БД: ${localDateTime}`);
        
        // Проверим как это будет отображаться в Алматы
        const almaty = new Date(localDateTime);
        console.log(`Время в Алматы (GMT+5): ${almaty.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`);
        
        // Создадим тестовую вставку
        console.log('\nТестируем вставку в БД...');
        
        await db.query(`
            INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
            VALUES ($1, $2, $3, $4)
        `, ['TEST-TIMEZONE', '5045', localDateTime.toISOString(), '1']);
        
        // Читаем обратно
        const result = await db.query(`
            SELECT event_datetime FROM time_events 
            WHERE employee_number = 'TEST-TIMEZONE'
        `);
        
        if (result.rows.length > 0) {
            const dbTime = result.rows[0].event_datetime;
            console.log(`Время в БД: ${dbTime}`);
            
            // Конвертируем обратно в Алматы
            const backToAlmaty = new Date(dbTime).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
            console.log(`Время в Алматы после чтения: ${backToAlmaty}`);
            
            // Проверяем соответствие
            const originalParts = testApiDateTime.split(' ');
            const [date, time] = originalParts;
            const almtyFormatted = backToAlmaty.replace(/(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2}):(\d{2})/, '$3-$2-$1 $4:$5:$6');
            
            console.log(`Исходное API время: ${testApiDateTime}`);
            console.log(`Восстановленное время: ${almtyFormatted}`);
            console.log(`Соответствие: ${testApiDateTime === almtyFormatted ? '✅' : '❌'}`);
        }
        
        // Очищаем тестовую запись
        await db.query(`DELETE FROM time_events WHERE employee_number = 'TEST-TIMEZONE'`);
        
        console.log('\n✅ Тест временной зоны завершен');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

testTimezoneFix();