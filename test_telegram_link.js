const db = require('./backend/database_pg');

async function testTelegramLink() {
    try {
        console.log('🧪 Тестируем процесс привязки Telegram аккаунта...');
        
        const testIIN = '951026301058';
        const testTelegramUserId = 123456789; // Mock Telegram user ID
        
        // 1. Проверяем что сотрудник существует
        const employee = await db.queryRow(
            'SELECT * FROM employees WHERE iin = $1',
            [testIIN]
        );
        
        if (!employee) {
            console.log('❌ Сотрудник с ИИН', testIIN, 'не найден');
            process.exit(1);
        }
        
        console.log('✅ Сотрудник найден:', employee.full_name);
        
        // 2. Проверяем нет ли уже привязки для этого Telegram ID
        const existingLink = await db.queryRow(
            'SELECT * FROM users WHERE telegram_user_id = $1',
            [testTelegramUserId]
        );
        
        if (existingLink) {
            console.log('⚠️  Уже есть привязка для Telegram ID', testTelegramUserId);
            // Удаляем для чистоты теста
            await db.query('DELETE FROM users WHERE telegram_user_id = $1', [testTelegramUserId]);
            console.log('🧹 Старая привязка удалена');
        }
        
        // 3. Создаем новую привязку
        await db.query(`
            INSERT INTO users (telegram_user_id, employee_number, employee_iin, role, created_at, updated_at)
            VALUES ($1, $2, $3, 'employee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [testTelegramUserId, employee.table_number, employee.iin]);
        
        console.log('✅ Привязка создана успешно');
        
        // 4. Проверяем привязку
        const newLink = await db.queryRow(
            'SELECT * FROM users WHERE telegram_user_id = $1',
            [testTelegramUserId]
        );
        
        if (newLink) {
            console.log('🔗 Новая привязка:');
            console.log('- Telegram ID:', newLink.telegram_user_id);
            console.log('- Employee number:', newLink.employee_number);
            console.log('- Employee IIN:', newLink.employee_iin);
            console.log('- Role:', newLink.role);
        }
        
        // 5. Тестируем поиск сотрудника через привязку (как в telegram.js)
        const linkedEmployee = await db.queryRow(`
            SELECT u.*, e.*, d.object_name as department_name, p.staff_position_name as position_name
            FROM users u
            JOIN employees e ON (u.employee_number = e.table_number OR u.employee_iin = e.iin)
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            WHERE u.telegram_user_id = $1
        `, [testTelegramUserId]);
        
        if (linkedEmployee) {
            console.log('✅ Связанный сотрудник найден через JOIN:');
            console.log('- ID:', linkedEmployee.id);
            console.log('- Табельный номер:', linkedEmployee.table_number);
            console.log('- ФИО:', linkedEmployee.full_name);
            console.log('- ИИН:', linkedEmployee.iin);
            console.log('- Подразделение:', linkedEmployee.department_name);
        } else {
            console.log('❌ Не удалось найти связанного сотрудника');
        }
        
        // Очистка после теста
        await db.query('DELETE FROM users WHERE telegram_user_id = $1', [testTelegramUserId]);
        console.log('🧹 Тестовая привязка удалена');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка теста:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

testTelegramLink();