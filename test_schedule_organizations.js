const fetch = require('node-fetch');

// Конфигурация
const API_BASE_URL = process.env.API_URL || 'http://localhost:3030/api';
const TEST_SCHEDULE_CODE = `TEST-MULTI-ORG-${Date.now()}`;

// Тестовые данные графика с несколькими организациями
const testSchedule = {
    ДатаВыгрузки: new Date().toISOString().split('T')[0],
    КоличествоГрафиков: 1,
    Графики: [
        {
            НаименованиеГрафика: "Тестовый график с несколькими организациями",
            КодГрафика: TEST_SCHEDULE_CODE,
            Организации: [
                "230540000699",  // ТОО TARY Catering
                "221040029729",  // ТОО Tary Astana
                "240940023852"   // ТОО Pana Ayusai
            ],
            РабочиеДни: [
                {
                    Дата: "2025-01-15",
                    Месяц: "2025-01-01",
                    ВидУчетаВремени: "Рабочий день",
                    ДополнительноеЗначение: 8,
                    ВремяНачалоРаботы: "09:00:00",
                    ВремяЗавершениеРаботы: "18:00:00"
                },
                {
                    Дата: "2025-01-16",
                    Месяц: "2025-01-01",
                    ВидУчетаВремени: "Рабочий день",
                    ДополнительноеЗначение: 8,
                    ВремяНачалоРаботы: "09:00:00",
                    ВремяЗавершениеРаботы: "18:00:00"
                },
                {
                    Дата: "2025-01-17",
                    Месяц: "2025-01-01",
                    ВидУчетаВремени: "Выходной",
                    ДополнительноеЗначение: 0,
                    ВремяНачалоРаботы: null,
                    ВремяЗавершениеРаботы: null
                }
            ]
        }
    ]
};

async function testImportSchedule() {
    console.log('🧪 Тест 1: Импорт графика с несколькими организациями');
    console.log('='.repeat(60));
    console.log(`График: ${testSchedule.Графики[0].НаименованиеГрафика}`);
    console.log(`Код: ${TEST_SCHEDULE_CODE}`);
    console.log(`Организации: ${testSchedule.Графики[0].Организации.join(', ')}`);
    console.log(`Рабочих дней: ${testSchedule.Графики[0].РабочиеДни.length}`);
    console.log('');

    try {
        const response = await fetch(`${API_BASE_URL}/admin/schedules/import-1c`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testSchedule)
        });

        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(result)}`);
        }

        console.log('✅ Импорт успешен!');
        console.log('Статистика:', JSON.stringify(result.statistics, null, 2));
        if (result.errors && result.errors.length > 0) {
            console.log('⚠️  Ошибки:', result.errors);
        }
        console.log('');
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка импорта:', error.message);
        console.log('');
        return false;
    }
}

async function testGetScheduleList() {
    console.log('🧪 Тест 2: Получение списка графиков с организациями');
    console.log('='.repeat(60));

    try {
        const response = await fetch(`${API_BASE_URL}/admin/schedules/1c/list`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const schedules = await response.json();
        const testScheduleData = schedules.find(s => s.schedule_code === TEST_SCHEDULE_CODE);

        if (!testScheduleData) {
            console.log('⚠️  Тестовый график не найден в списке');
            console.log(`Всего графиков: ${schedules.length}`);
            return false;
        }

        console.log('✅ Тестовый график найден!');
        console.log(`Название: ${testScheduleData.schedule_name}`);
        console.log(`Код: ${testScheduleData.schedule_code}`);
        console.log(`Количество организаций: ${testScheduleData.organizations?.length || 0}`);
        
        if (testScheduleData.organizations && testScheduleData.organizations.length > 0) {
            console.log('Организации:');
            testScheduleData.organizations.forEach((org, index) => {
                console.log(`  ${index + 1}. ${org.organization_name} (БИН: ${org.organization_bin})`);
            });
        } else {
            console.log('⚠️  Организации не найдены!');
            return false;
        }

        // Проверка количества организаций
        if (testScheduleData.organizations.length !== 3) {
            console.log(`⚠️  Ожидалось 3 организации, получено: ${testScheduleData.organizations.length}`);
            return false;
        }

        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Ошибка получения списка:', error.message);
        console.log('');
        return false;
    }
}

async function testGetScheduleDetails() {
    console.log('🧪 Тест 3: Получение деталей графика с организациями');
    console.log('='.repeat(60));

    try {
        const response = await fetch(`${API_BASE_URL}/admin/schedules/1c?scheduleCode=${TEST_SCHEDULE_CODE}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const schedules = data.schedules || [];

        if (schedules.length === 0) {
            console.log('⚠️  График не найден');
            return false;
        }

        const firstSchedule = schedules[0];
        console.log('✅ Детали графика получены!');
        console.log(`Название: ${firstSchedule.schedule_name}`);
        console.log(`Код: ${firstSchedule.schedule_code}`);
        console.log(`Рабочих дней: ${schedules.length}`);
        console.log(`Количество организаций: ${firstSchedule.organizations?.length || 0}`);

        if (firstSchedule.organizations && firstSchedule.organizations.length > 0) {
            console.log('Организации:');
            firstSchedule.organizations.forEach((org, index) => {
                console.log(`  ${index + 1}. ${org.organization_name} (БИН: ${org.organization_bin})`);
            });
        } else {
            console.log('⚠️  Организации не найдены!');
            return false;
        }

        // Проверка количества организаций
        if (firstSchedule.organizations.length !== 3) {
            console.log(`⚠️  Ожидалось 3 организации, получено: ${firstSchedule.organizations.length}`);
            return false;
        }

        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Ошибка получения деталей:', error.message);
        console.log('');
        return false;
    }
}

async function testDatabaseDirectly() {
    console.log('🧪 Тест 4: Проверка базы данных напрямую');
    console.log('='.repeat(60));

    try {
        const { pool } = require('./backend/database_pg');
        
        // Проверка записей в schedule_organizations
        const orgLinks = await pool.query(
            'SELECT so.*, d.object_company FROM schedule_organizations so JOIN departments d ON so.organization_bin = d.object_bin WHERE so.schedule_code = $1 ORDER BY d.object_company',
            [TEST_SCHEDULE_CODE]
        );

        console.log(`✅ Найдено связей в БД: ${orgLinks.rows.length}`);
        
        if (orgLinks.rows.length === 0) {
            console.log('⚠️  Связи не найдены в таблице schedule_organizations!');
            await pool.end();
            return false;
        }

        console.log('Связи график-организация:');
        orgLinks.rows.forEach((link, index) => {
            console.log(`  ${index + 1}. ${link.object_company} (БИН: ${link.organization_bin})`);
        });

        // Проверка количества
        if (orgLinks.rows.length !== 3) {
            console.log(`⚠️  Ожидалось 3 связи, найдено: ${orgLinks.rows.length}`);
            await pool.end();
            return false;
        }

        // Проверка рабочих дней
        const workDays = await pool.query(
            'SELECT COUNT(*) as count FROM work_schedules_1c WHERE schedule_code = $1',
            [TEST_SCHEDULE_CODE]
        );

        console.log(`Рабочих дней в графике: ${workDays.rows[0].count}`);
        
        await pool.end();
        console.log('');
        return true;
    } catch (error) {
        console.error('❌ Ошибка проверки БД:', error.message);
        console.log('');
        return false;
    }
}

async function cleanup() {
    console.log('🧹 Очистка: Удаление тестового графика');
    console.log('='.repeat(60));

    try {
        const { pool } = require('./backend/database_pg');
        
        // Удаление связей организаций
        await pool.query('DELETE FROM schedule_organizations WHERE schedule_code = $1', [TEST_SCHEDULE_CODE]);
        
        // Удаление рабочих дней
        await pool.query('DELETE FROM work_schedules_1c WHERE schedule_code = $1', [TEST_SCHEDULE_CODE]);
        
        console.log('✅ Тестовые данные удалены');
        await pool.end();
    } catch (error) {
        console.error('⚠️  Ошибка очистки:', error.message);
    }
}

// Запуск тестов
async function runTests() {
    console.log('');
    console.log('🚀 Запуск тестов для связи графиков с несколькими организациями');
    console.log('='.repeat(60));
    console.log('');

    const results = {
        import: false,
        list: false,
        details: false,
        database: false
    };

    // Тест 1: Импорт
    results.import = await testImportSchedule();
    
    if (!results.import) {
        console.log('❌ Импорт не удался, остальные тесты пропущены');
        return;
    }

    // Небольшая задержка для обработки
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 2: Список графиков
    results.list = await testGetScheduleList();

    // Тест 3: Детали графика
    results.details = await testGetScheduleDetails();

    // Тест 4: Проверка БД
    results.database = await testDatabaseDirectly();

    // Итоги
    console.log('📊 Итоги тестирования');
    console.log('='.repeat(60));
    console.log(`Импорт графика:           ${results.import ? '✅' : '❌'}`);
    console.log(`Получение списка:          ${results.list ? '✅' : '❌'}`);
    console.log(`Получение деталей:         ${results.details ? '✅' : '❌'}`);
    console.log(`Проверка БД:               ${results.database ? '✅' : '❌'}`);
    console.log('');

    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
        console.log('🎉 Все тесты пройдены успешно!');
    } else {
        console.log('⚠️  Некоторые тесты не прошли');
    }

    // Очистка
    const cleanupChoice = process.argv[2];
    if (cleanupChoice !== '--keep') {
        await cleanup();
    } else {
        console.log('💾 Тестовые данные сохранены (используйте --keep для сохранения)');
    }

    console.log('');
    process.exit(allPassed ? 0 : 1);
}

// Запуск
runTests().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
});






