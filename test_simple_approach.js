const db = require('./backend/database_pg');

async function testSimpleApproach() {
    try {
        console.log('🕐 Тестирование простого подхода...\n');
        
        const apiTime = "2025-05-01 09:04:42";
        console.log(`Исходное время из API: ${apiTime}`);
        
        // Удаляем тестовые записи
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-SIMPLE\'');
        
        // Тестируем простой подход - сохраняем как timestamp без timezone
        await db.query(`
            INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
            VALUES ($1, $2, $3::timestamp, $4)
        `, ['TEST-SIMPLE', '5045', apiTime, '1']);
        
        console.log('✅ Данные вставлены как timestamp');
        
        // Читаем обратно
        const result = await db.query(`
            SELECT 
                event_datetime
            FROM time_events 
            WHERE employee_number = 'TEST-SIMPLE'
        `);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log(`Время в БД: ${row.event_datetime}`);
            
            // Конвертируем обратно в строку того же формата
            const date = new Date(row.event_datetime);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            
            const formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
            console.log(`Форматированное время: ${formattedTime}`);
            
            console.log(`\n🔍 Сравнение:`);
            console.log(`API время:        "${apiTime}"`);
            console.log(`Восстановленное:  "${formattedTime}"`);
            console.log(`Совпадает: ${apiTime === formattedTime ? '✅ ДА!' : '❌ НЕТ'}`);
            
            if (apiTime === formattedTime) {
                console.log('\n🎉 ОТЛИЧНО! Простой подход работает!');
                console.log('Время сохраняется и читается корректно как локальное время.');
            }
        }
        
        // Очищаем
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-SIMPLE\'');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

testSimpleApproach();