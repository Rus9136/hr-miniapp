const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'hr-postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hr_tracker',
    user: process.env.DB_USER || 'hr_user',
    password: process.env.DB_PASSWORD || 'hr_secure_password'
});

async function runMigration() {
    try {
        console.log('Начинаем миграцию для добавления employee_iin в таблицу users...');
        
        // Добавляем колонку employee_iin
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS employee_iin VARCHAR(12)
        `);
        console.log('✅ Колонка employee_iin добавлена');
        
        // Создаем индекс
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_employee_iin ON users(employee_iin)
        `);
        console.log('✅ Индекс для employee_iin создан');
        
        // Обновляем существующие записи
        const updateResult = await pool.query(`
            UPDATE users 
            SET employee_iin = e.iin
            FROM employees e 
            WHERE users.employee_number = e.table_number 
            AND users.employee_iin IS NULL
        `);
        console.log(`✅ Обновлено ${updateResult.rowCount} записей с employee_iin`);
        
        // Проверяем структуру таблицы
        const tableInfo = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            ORDER BY ordinal_position
        `);
        
        console.log('\n📋 Текущая структура таблицы users:');
        tableInfo.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        // Показываем текущие данные
        const userData = await pool.query('SELECT * FROM users ORDER BY id');
        console.log('\n👥 Текущие записи в таблице users:');
        userData.rows.forEach(user => {
            console.log(`  - ID: ${user.id}, Telegram: ${user.telegram_user_id}, Employee Number: ${user.employee_number}, Employee IIN: ${user.employee_iin}, Role: ${user.role}`);
        });
        
        console.log('\n🎉 Миграция успешно выполнена!');
        
    } catch (error) {
        console.error('❌ Ошибка при выполнении миграции:', error);
    } finally {
        await pool.end();
    }
}

runMigration();