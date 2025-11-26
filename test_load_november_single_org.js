/**
 * Тестовый скрипт загрузки событий за ноябрь для ОДНОЙ организации
 * Используется для проверки работы перед полным запуском
 *
 * Запуск: node test_load_november_single_org.js
 */

require('dotenv').config();
const db = require('./backend/database_pg');
const apiSync = require('./backend/utils/apiSync_pg');

// Период загрузки
const DATE_FROM = '2025-11-01';
const DATE_TO = '2025-11-23';

/**
 * Тестовая загрузка для одной организации
 */
async function testSingleOrganization() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 ТЕСТОВАЯ ЗАГРУЗКА ДЛЯ ОДНОЙ ОРГАНИЗАЦИИ');
  console.log('='.repeat(80));
  console.log(`Период: ${DATE_FROM} - ${DATE_TO}\n`);

  try {
    // Подключаемся к БД
    await db.initializeDatabase();
    console.log('✓ Подключение к базе данных установлено\n');

    // Получаем список организаций
    const organizations = await db.queryRows(`
      SELECT DISTINCT object_bin, object_company
      FROM departments
      WHERE object_company IS NOT NULL
        AND object_bin IS NOT NULL
      ORDER BY object_company
      LIMIT 5
    `);

    if (!organizations || organizations.length === 0) {
      throw new Error('Не найдено ни одной организации');
    }

    console.log('Доступные организации для тестирования:\n');
    organizations.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.object_company} (${org.object_bin})`);
    });

    // Выбираем первую организацию
    const testOrg = organizations[0];
    console.log(`\n📦 Выбрана для теста: ${testOrg.object_company}\n`);
    console.log('─'.repeat(80));

    // Получаем количество сотрудников
    const employees = await db.queryRows(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE object_bin = $1 AND status = 1
    `, [testOrg.object_bin]);

    const employeeCount = employees[0]?.count || 0;
    console.log(`Активных сотрудников: ${employeeCount}\n`);

    if (employeeCount === 0) {
      console.log('⚠ В этой организации нет активных сотрудников');
      console.log('Выберите другую организацию из списка выше\n');
      return;
    }

    const startTime = new Date();

    // Callback для прогресса
    let lastProgress = 0;
    const progressCallback = (update) => {
      if (update.eventsLoaded !== undefined && update.eventsLoaded !== lastProgress) {
        lastProgress = update.eventsLoaded;
        process.stdout.write(`\r📊 Прогресс: ${update.processedEmployees || 0}/${employeeCount} сотрудников | События: ${update.eventsLoaded}`);
      }
    };

    // Загружаем события
    console.log('🚀 Загрузка событий из внешнего API...\n');
    const eventsLoaded = await apiSync.loadTimeEventsWithProgress({
      tableNumber: null,
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
      objectBin: testOrg.object_bin
    }, progressCallback);

    console.log('\n'); // Новая строка после прогресса

    // Обрабатываем события
    console.log('⚙️  Обработка загруженных событий...');
    const recordsProcessed = await apiSync.processTimeRecords();

    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    // Результаты
    console.log('\n' + '─'.repeat(80));
    console.log('📊 РЕЗУЛЬТАТЫ ТЕСТОВОЙ ЗАГРУЗКИ');
    console.log('─'.repeat(80));
    console.log(`Организация:       ${testOrg.object_company}`);
    console.log(`БИН:               ${testOrg.object_bin}`);
    console.log(`Сотрудников:       ${employeeCount}`);
    console.log(`Событий загружено: ${eventsLoaded}`);
    console.log(`Записей создано:   ${recordsProcessed}`);
    console.log(`Время выполнения:  ${duration} секунд`);
    console.log('─'.repeat(80));

    // Проверка результатов в БД
    console.log('\n🔍 Проверка данных в базе...\n');

    const verification = await db.queryRows(`
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT employee_number) as unique_employees,
        MIN(event_datetime) as first_event,
        MAX(event_datetime) as last_event
      FROM time_events
      WHERE event_datetime >= $1::timestamp
        AND event_datetime < $2::timestamp
    `, [DATE_FROM, DATE_TO + ' 23:59:59']);

    const verificationRecords = await db.queryRows(`
      SELECT COUNT(*) as total_records
      FROM time_records
      WHERE date >= $1::date
        AND date <= $2::date
    `, [DATE_FROM, DATE_TO]);

    console.log('Данные в time_events:');
    console.log(`  - Всего событий: ${verification[0].total_events}`);
    console.log(`  - Уникальных сотрудников: ${verification[0].unique_employees}`);
    if (verification[0].first_event) {
      console.log(`  - Первое событие: ${new Date(verification[0].first_event).toLocaleString('ru-RU')}`);
      console.log(`  - Последнее событие: ${new Date(verification[0].last_event).toLocaleString('ru-RU')}`);
    }

    console.log(`\nДанные в time_records:`);
    console.log(`  - Всего записей: ${verificationRecords[0].total_records}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ТЕСТОВАЯ ЗАГРУЗКА ЗАВЕРШЕНА УСПЕШНО');
    console.log('='.repeat(80));
    console.log('\n💡 Если результаты корректны, можно запустить полную загрузку:');
    console.log('   node load_november_events.js\n');

  } catch (error) {
    console.error('\n❌ ОШИБКА:', error.message);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

// Запуск
testSingleOrganization().catch(error => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});
