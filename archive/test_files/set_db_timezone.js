const db = require('./backend/database_pg');

async function setDatabaseTimezone() {
    try {
        console.log('🕐 Настройка временной зоны базы данных...\n');
        
        // Показываем текущую временную зону
        const currentTz = await db.query('SHOW timezone');
        console.log(`Текущая временная зона: ${currentTz.rows[0].timezone || currentTz.rows[0].TimeZone}`);
        
        // Устанавливаем временную зону на Asia/Almaty (GMT+5)
        await db.query("SET TIME ZONE 'Asia/Almaty'");
        console.log('Устанавливаем временную зону на Asia/Almaty...');
        
        // Проверяем изменение
        const newTz = await db.query('SHOW timezone');
        console.log(`Новая временная зона: ${newTz.rows[0].timezone || newTz.rows[0].TimeZone}`);
        
        // Показываем текущее время
        const currentTime = await db.query('SELECT NOW() as current_time');
        console.log(`Текущее время в новой зоне: ${currentTime.rows[0].current_time}`);
        
        // Устанавливаем по умолчанию для будущих подключений
        await db.query("ALTER DATABASE hr_tracker SET timezone = 'Asia/Almaty'");
        console.log('Установили Asia/Almaty как временную зону по умолчанию для базы данных');
        
        console.log('\n✅ Временная зона базы данных настроена успешно');
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
    } finally {
        process.exit(0);
    }
}

setDatabaseTimezone();