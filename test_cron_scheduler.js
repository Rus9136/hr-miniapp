/**
 * Тестовый скрипт для проверки CRON планировщика
 * Запуск: node test_cron_scheduler.js
 */

require('dotenv').config();
const db = require('./backend/database_pg');

async function testCronScheduler() {
    console.log('='.repeat(80));
    console.log('CRON Scheduler Test Script');
    console.log('='.repeat(80));

    try {
        // 1. Проверка подключения к БД
        console.log('\n1. Проверка подключения к базе данных...');
        await db.initializeDatabase();
        console.log('   ✓ База данных подключена');

        // 2. Проверка таблицы логов
        console.log('\n2. Проверка таблицы cron_timesheet_logs...');
        const tableExists = await db.queryRows(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'cron_timesheet_logs'
            ) as exists
        `);

        if (tableExists[0].exists) {
            console.log('   ✓ Таблица cron_timesheet_logs существует');
        } else {
            console.log('   ✗ Таблица cron_timesheet_logs не найдена');
            console.log('   → Запустите миграцию: psql -U hr_user -d hr_tracker -f migrations/009_cron_timesheet_logs.sql');
        }

        // 3. Проверка организаций
        console.log('\n3. Проверка доступных организаций...');
        const organizations = await db.queryRows(`
            SELECT DISTINCT object_bin, object_company
            FROM departments
            WHERE object_company IS NOT NULL
              AND object_bin IS NOT NULL
            ORDER BY object_company
        `);

        console.log(`   ✓ Найдено ${organizations.length} организаций:`);
        organizations.forEach((org, index) => {
            console.log(`      ${index + 1}. ${org.object_company} (${org.object_bin})`);
        });

        if (organizations.length === 0) {
            console.log('   ⚠ Внимание: организации не найдены в базе данных');
            console.log('   → Запустите синхронизацию подразделений через админ-панель');
        }

        // 4. Проверка переменных окружения
        console.log('\n4. Проверка переменных окружения...');
        const requiredVars = [
            'CRON_TIMESHEET_ENABLED',
            'CRON_TIMESHEET_SCHEDULE',
            'CRON_TIMESHEET_DAYS_BACK'
        ];

        let allVarsPresent = true;
        requiredVars.forEach(varName => {
            const value = process.env[varName];
            if (value) {
                console.log(`   ✓ ${varName}=${value}`);
            } else {
                console.log(`   ✗ ${varName} не установлена`);
                allVarsPresent = false;
            }
        });

        if (!allVarsPresent) {
            console.log('   → Добавьте недостающие переменные в .env файл');
        }

        // 5. Проверка node-cron
        console.log('\n5. Проверка установки node-cron...');
        try {
            const cron = require('node-cron');
            console.log('   ✓ node-cron установлен');

            const schedule = process.env.CRON_TIMESHEET_SCHEDULE || '0 9,21 * * *';
            const isValid = cron.validate(schedule);
            if (isValid) {
                console.log(`   ✓ CRON расписание валидно: ${schedule}`);
            } else {
                console.log(`   ✗ Невалидное CRON расписание: ${schedule}`);
            }
        } catch (error) {
            console.log('   ✗ node-cron не установлен');
            console.log('   → Запустите: npm install node-cron');
        }

        // 6. Тест записи в лог
        console.log('\n6. Тест записи в таблицу логов...');
        if (tableExists[0].exists) {
            const testLog = await db.queryRows(`
                INSERT INTO cron_timesheet_logs
                (date_from, date_to, organization_bin, organization_name, events_loaded,
                 records_processed, status, duration_seconds, started_at, completed_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                '2025-11-14',
                '2025-11-16',
                'TEST123',
                'Test Organization',
                100,
                50,
                'success',
                45,
                new Date(),
                new Date()
            ]);

            if (testLog && testLog.length > 0) {
                console.log(`   ✓ Тестовая запись создана (ID: ${testLog[0].id})`);

                // Удаляем тестовую запись
                await db.queryRows('DELETE FROM cron_timesheet_logs WHERE id = $1', [testLog[0].id]);
                console.log('   ✓ Тестовая запись удалена');
            }
        }

        // 7. Проверка API endpoints
        console.log('\n7. Проверка API endpoints...');
        const requiredFiles = [
            './backend/services/timesheet-scheduler.js',
            './backend/routes/cron.js'
        ];

        requiredFiles.forEach(filePath => {
            try {
                require(filePath);
                console.log(`   ✓ ${filePath}`);
            } catch (error) {
                console.log(`   ✗ ${filePath} не найден`);
            }
        });

        // Итоговый результат
        console.log('\n' + '='.repeat(80));
        console.log('РЕЗУЛЬТАТ ПРОВЕРКИ');
        console.log('='.repeat(80));

        if (tableExists[0].exists && allVarsPresent && organizations.length > 0) {
            console.log('✓ Все проверки пройдены успешно!');
            console.log('\nСледующие шаги:');
            console.log('1. Запустите сервер: npm run server:prod');
            console.log('2. Откройте админ-панель: https://madlen.space/HR/');
            console.log('3. Перейдите в раздел "Автозагрузка табеля"');
            console.log('4. Проверьте статус планировщика');
            console.log('\nPlanировщик запустится автоматически в 09:00 и 21:00 каждый день');
        } else {
            console.log('⚠ Некоторые проверки не прошли. Исправьте ошибки выше.');
        }

    } catch (error) {
        console.error('\n✗ Ошибка:', error.message);
        console.error(error.stack);
    } finally {
        await db.close();
        console.log('\n' + '='.repeat(80));
    }
}

// Запуск тестов
testCronScheduler();
