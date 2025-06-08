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
        console.log('Начинаем миграцию для таблицы новостей...');
        
        const migrationSQL = `
            -- Создание таблицы новостей
            CREATE TABLE IF NOT EXISTS news (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                author VARCHAR(255) NOT NULL,
                image_url VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Индекс для сортировки по дате
            CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);

            -- Функция для обновления updated_at
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            -- Триггер для автоматического обновления updated_at
            DROP TRIGGER IF EXISTS update_news_updated_at ON news;
            CREATE TRIGGER update_news_updated_at
                BEFORE UPDATE ON news
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `;

        await pool.query(migrationSQL);
        console.log('Миграция успешно выполнена!');
        
        // Добавим тестовую новость
        const testNews = await pool.query(`
            INSERT INTO news (title, description, author, image_url)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [
            'Добро пожаловать в раздел новостей!',
            'Теперь вы можете публиковать новости компании через админ-панель. Здесь будут появляться важные объявления, события и другая полезная информация для сотрудников.',
            'Администратор',
            null
        ]);
        
        console.log('Добавлена тестовая новость:', testNews.rows[0]);
        
    } catch (error) {
        console.error('Ошибка при выполнении миграции:', error);
    } finally {
        await pool.end();
    }
}

runMigration();