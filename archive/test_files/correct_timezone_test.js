const db = require('./backend/database_pg');

async function correctTimezoneTest() {
    try {
        console.log('🕐 Правильное тестирование временной зоны...\n');
        
        const apiTime = "2025-05-01 09:04:42";
        console.log(`Исходное время из API: ${apiTime}`);
        
        // Правильный способ: сохраняем время как местное время в Алматы
        // PostgreSQL интерпретирует это как время в текущей timezone (Asia/Almaty)
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-CORRECT\'');
        
        // Вставляем время как timestamp без timezone, PostgreSQL применит Asia/Almaty
        await db.query(`
            INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
            VALUES ($1, $2, $3::timestamp AT TIME ZONE 'Asia/Almaty', $4)
        `, ['TEST-CORRECT', '5045', apiTime, '1']);
        
        // Читаем обратно
        const result = await db.query(`
            SELECT 
                event_datetime,
                event_datetime AT TIME ZONE 'Asia/Almaty' as local_time
            FROM time_events 
            WHERE employee_number = 'TEST-CORRECT'
        `);
        
        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log(`Время в БД: ${row.event_datetime}`);
            console.log(`Локальное время: ${row.local_time}`);
            
            // Форматируем локальное время обратно в строку
            const localStr = row.local_time.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`Форматированное: ${localStr}`);
            
            console.log(`\nСравнение:`);
            console.log(`API время:        ${apiTime}`);
            console.log(`Восстановленное:  ${localStr}`);
            console.log(`Совпадает: ${apiTime === localStr ? '✅ ДА' : '❌ НЕТ'}`);
        }
        
        // Очищаем
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-CORRECT\'');
        
        console.log('\n--- ТЕСТИРУЕМ ДРУГОЙ ПОДХОД ---');
        
        // Альтернативный подход: создаем TIMESTAMPTZ напрямую
        await db.query(`
            INSERT INTO time_events (employee_number, object_code, event_datetime, event_type)
            VALUES ($1, $2, ($3 || ' Asia/Almaty')::timestamptz, $4)
        `, ['TEST-CORRECT2', '5045', apiTime, '1']);
        
        const result2 = await db.query(`
            SELECT 
                event_datetime,
                event_datetime AT TIME ZONE 'Asia/Almaty' as local_time
            FROM time_events 
            WHERE employee_number = 'TEST-CORRECT2'
        `);
        
        if (result2.rows.length > 0) {
            const row = result2.rows[0];
            const localStr = row.local_time.toISOString().slice(0, 19).replace('T', ' ');
            console.log(`Подход 2 - восстановленное: ${localStr}`);
            console.log(`Совпадает: ${apiTime === localStr ? '✅ ДА' : '❌ НЕТ'}`);
        }
        
        // Очищаем
        await db.query('DELETE FROM time_events WHERE employee_number = \'TEST-CORRECT2\'');
        
        console.log('\n✅ Тест завершен');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

correctTimezoneTest();