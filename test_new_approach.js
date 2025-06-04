const db = require('./backend/database_pg');

async function testNewApproach() {
    try {
        console.log('🕐 Тестирование нового подхода...\n');
        
        const apiTime = "2025-05-01 09:04:42";
        console.log(`Исходное время из API: ${apiTime}`);
        
        // Удаляем тестовые записи
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-NEW\'');
        
        // Тестируем новый подход из apiSync_pg.js
        await db.query(`
            INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
            VALUES ($1, $2, ($3 || ' Asia/Almaty')::timestamptz, $4)
        `, ['TEST-NEW', '5045', apiTime, '1']);
        
        console.log('✅ Данные вставлены');
        
        // Читаем обратно и конвертируем в локальное время Алматы
        const result = await db.query(`
            SELECT 
                event_datetime,
                event_datetime AT TIME ZONE 'Asia/Almaty' as almaty_local
            FROM time_events 
            WHERE employee_number = 'TEST-NEW'
        `);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log(`Время в БД (UTC): ${row.event_datetime}`);
            console.log(`Локальное время Алматы: ${row.almaty_local}`);
            
            // Форматируем как строку
            const almatyStr = row.almaty_local.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`Форматированное: ${almatyStr}`);
            
            console.log(`\n🔍 Сравнение:`);
            console.log(`API время:        "${apiTime}"`);
            console.log(`Восстановленное:  "${almatyStr}"`);
            console.log(`Совпадает: ${apiTime === almatyStr ? '✅ ДА!' : '❌ НЕТ'}`);
            
            if (apiTime === almatyStr) {
                console.log('\n🎉 ОТЛИЧНО! Время сохраняется и читается корректно!');
            } else {
                console.log('\n❌ Нужно дополнительно настроить...');
            }
        }
        
        // Очищаем
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-NEW\'');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

testNewApproach();