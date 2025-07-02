const db = require('./backend/database_pg');

async function addTestNews() {
    try {
        const testNews = [
            {
                title: 'Запуск новой системы учета рабочего времени',
                description: `Уважаемые сотрудники!

Мы рады сообщить о запуске обновленной системы учета рабочего времени. Новая система предлагает улучшенный интерфейс, более точный учет времени и удобный доступ через Telegram Mini App.

Основные преимущества:
- Мобильный доступ через Telegram
- Автоматическая синхронизация данных
- Детальная статистика по подразделениям
- Интеграция с системой 1С

Для начала работы просто откройте Telegram бота и следуйте инструкциям. При возникновении вопросов обращайтесь в HR отдел.`,
                author: 'HR отдел',
                image_url: null
            },
            {
                title: 'График работы в июньские праздники',
                description: `Информируем вас о графике работы компании в предстоящие праздничные дни июня 2025 года:

- 6 июня (пятница) - сокращенный рабочий день до 17:00
- 7-9 июня - выходные дни
- 10 июня (понедельник) - рабочий день по обычному графику

Просим учесть данную информацию при планировании рабочих задач.`,
                author: 'Администрация',
                image_url: null
            },
            {
                title: 'Корпоративное обучение: Excel для профессионалов',
                description: `Приглашаем всех желающих на корпоративное обучение "Excel для профессионалов", которое состоится 15 июня 2025 года.

В программе обучения:
- Продвинутые формулы и функции
- Сводные таблицы и анализ данных
- Макросы и автоматизация
- Визуализация данных

Обучение проводится бесплатно для всех сотрудников компании. Для записи обратитесь в HR отдел до 12 июня.

Место проведения: Конференц-зал, 3 этаж
Время: 10:00 - 17:00 (с перерывом на обед)`,
                author: 'Отдел обучения',
                image_url: null
            }
        ];

        for (const news of testNews) {
            await db.query(
                `INSERT INTO news (title, description, author, image_url) 
                 VALUES ($1, $2, $3, $4)`,
                [news.title, news.description, news.author, news.image_url]
            );
        }

        console.log('✅ Test news added successfully');
        
        // Show current news count
        const result = await db.query('SELECT COUNT(*) FROM news');
        console.log(`Total news in database: ${result.rows[0].count}`);
        
    } catch (error) {
        console.error('Error adding test news:', error);
    } finally {
        await db.close();
    }
}

addTestNews();