/**
 * Скрипт загрузки событий ЗА СЕГОДНЯ для организаций Tary
 * PRODUCTION БАЗА: hr-postgres контейнер (порт 5437)
 * Период: Только ТЕКУЩИЙ ДЕНЬ
 * Организации: Только ТОО Tary* (17 организаций)
 *
 * Использование: Для ежедневной синхронизации событий
 * Запуск: node load_today_events_tary_production.js
 */

// ВАЖНО: Устанавливаем порт production базы ПЕРЕД импортом database_pg
process.env.DB_PORT = '5437';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'hr_tracker';
process.env.DB_USER = 'hr_user';
process.env.DB_PASSWORD = 'hr_secure_password';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./backend/database_pg');
const apiSync = require('./backend/utils/apiSync_pg');

// Текущая дата в формате YYYY-MM-DD (таймзона Asia/Almaty)
const today = new Date();
const almatyOffset = 5 * 60; // UTC+5 в минутах
const almatyTime = new Date(today.getTime() + (almatyOffset - today.getTimezoneOffset()) * 60000);
const DATE_TODAY = almatyTime.toISOString().split('T')[0];

// Список организаций Tary (хардкод)
const TARY_ORGANIZATIONS = [
  { bin: '230440043321', name: 'ТОО TARY ALMATY' },
  { bin: '230440013558', name: 'ТОО Tary Altyn Emel' },
  { bin: '250440002239', name: 'ТОО Tary Aqtau' },
  { bin: '221040029729', name: 'ТОО Tary Astana' },
  { bin: '221240039416', name: 'ТОО Tary Ayusai' },
  { bin: '230840023361', name: 'ТОО TARY BATAN' },
  { bin: '210640037797', name: 'ТОО Tary Brew' },
  { bin: '231040008689', name: 'ТОО Tary Burabay' },
  { bin: '230540000699', name: 'ТОО TARY Catering' },
  { bin: '230240026780', name: 'ТОО Tary Charyn' },
  { bin: '230940025311', name: 'ТОО Tary Europe city' },
  { bin: '241040021013', name: 'ТОО Tary Kainar' },
  { bin: '230740034402', name: 'ТОО Tary Kolsay' },
  { bin: '240140014557', name: 'ТОО Tary Kutarys' },
  { bin: '240140007792', name: 'ТОО TARY Sever' },
  { bin: '250140030015', name: 'ТОО Tary Taraz' },
  { bin: '230440013578', name: 'ТОО Tary Turgen' }
];

// Файл для сохранения отчета
const REPORT_FILE = path.join(__dirname, `load_today_tary_${DATE_TODAY}.txt`);

// Статистика выполнения
const executionStats = {
  startTime: new Date(),
  endTime: null,
  organizations: [],
  totalEventsLoaded: 0,
  totalRecordsProcessed: 0,
  totalEmployees: 0,
  successOrganizations: 0,
  failedOrganizations: 0,
  databaseInfo: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME
  },
  dateLoaded: DATE_TODAY
};

/**
 * Форматирование времени выполнения
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}ч ${minutes}м ${secs}с`;
  } else if (minutes > 0) {
    return `${minutes}м ${secs}с`;
  } else {
    return `${secs}с`;
  }
}

/**
 * Генерация текстового отчета
 */
function generateReport() {
  const duration = (executionStats.endTime - executionStats.startTime) / 1000;

  let report = '';
  report += '='.repeat(80) + '\n';
  report += '     ОТЧЕТ О ЗАГРУЗКЕ СОБЫТИЙ ЗА СЕГОДНЯ (ОРГАНИЗАЦИИ TARY)\n';
  report += '                    PRODUCTION DATABASE\n';
  report += '='.repeat(80) + '\n\n';

  report += `База данных:     ${executionStats.databaseInfo.host}:${executionStats.databaseInfo.port}/${executionStats.databaseInfo.database}\n`;
  report += `Дата загрузки:   ${executionStats.dateLoaded}\n`;
  report += `Время начала:    ${executionStats.startTime.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}\n`;
  report += `Время окончания: ${executionStats.endTime.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}\n`;
  report += `Длительность:    ${formatDuration(duration)}\n\n`;

  report += '─'.repeat(80) + '\n';
  report += 'ОБЩАЯ СТАТИСТИКА\n';
  report += '─'.repeat(80) + '\n';
  report += `Всего организаций Tary:         ${TARY_ORGANIZATIONS.length}\n`;
  report += `  ✓ Успешно обработано:         ${executionStats.successOrganizations}\n`;
  report += `  ✗ Ошибки при обработке:       ${executionStats.failedOrganizations}\n`;
  report += `Всего сотрудников обработано:   ${executionStats.totalEmployees}\n`;
  report += `Всего событий загружено:        ${executionStats.totalEventsLoaded}\n`;
  report += `Всего записей обработано:       ${executionStats.totalRecordsProcessed}\n\n`;

  report += '─'.repeat(80) + '\n';
  report += 'ДЕТАЛИЗАЦИЯ ПО ОРГАНИЗАЦИЯМ TARY\n';
  report += '─'.repeat(80) + '\n\n';

  // Сначала успешные организации
  const successOrgs = executionStats.organizations.filter(o => o.status === 'success');
  if (successOrgs.length > 0) {
    report += '✓ УСПЕШНО ОБРАБОТАННЫЕ ОРГАНИЗАЦИИ:\n\n';
    successOrgs.forEach((org, index) => {
      report += `${index + 1}. ${org.name} (${org.bin})\n`;
      report += `   Сотрудников:      ${org.employeesCount}\n`;
      report += `   События:          ${org.eventsLoaded}\n`;
      report += `   Записи:           ${org.recordsProcessed}\n`;
      if (org.eventsLoaded > 0) {
        report += `   ⏰ Первое событие: ${org.firstEvent || 'N/A'}\n`;
        report += `   ⏰ Последнее:      ${org.lastEvent || 'N/A'}\n`;
      }
      report += `   Время обработки:  ${formatDuration(org.duration)}\n\n`;
    });
  }

  // Затем организации с ошибками
  const failedOrgs = executionStats.organizations.filter(o => o.status === 'error');
  if (failedOrgs.length > 0) {
    report += '✗ ОРГАНИЗАЦИИ С ОШИБКАМИ:\n\n';
    failedOrgs.forEach((org, index) => {
      report += `${index + 1}. ${org.name} (${org.bin})\n`;
      report += `   Ошибка: ${org.errorMessage}\n\n`;
    });
  }

  report += '='.repeat(80) + '\n';
  report += 'ИТОГОВЫЙ РЕЗУЛЬТАТ\n';
  report += '='.repeat(80) + '\n';

  if (executionStats.failedOrganizations === 0) {
    report += `✓ ВСЕ ОРГАНИЗАЦИИ TARY УСПЕШНО ОБРАБОТАНЫ ЗА ${executionStats.dateLoaded}!\n`;
  } else if (executionStats.successOrganizations > 0) {
    report += `⚠ ЧАСТИЧНЫЙ УСПЕХ: ${executionStats.successOrganizations} из ${TARY_ORGANIZATIONS.length} организаций обработаны\n`;
  } else {
    report += '✗ ВСЕ ОРГАНИЗАЦИИ ЗАВЕРШИЛИСЬ С ОШИБКАМИ\n';
  }

  report += '\n' + '='.repeat(80) + '\n';

  return report;
}

/**
 * Сохранение отчета в файл
 */
function saveReport(report) {
  try {
    fs.writeFileSync(REPORT_FILE, report, 'utf8');
    console.log(`\n📄 Отчет сохранен в файл: ${REPORT_FILE}`);
  } catch (error) {
    console.error('Ошибка при сохранении отчета:', error.message);
  }
}

/**
 * Загрузка данных для одной организации
 */
async function loadOrganizationData(organization) {
  const startTime = new Date();
  const orgStats = {
    bin: organization.bin,
    name: organization.name,
    status: 'error',
    employeesCount: 0,
    eventsLoaded: 0,
    recordsProcessed: 0,
    duration: 0,
    errorMessage: null,
    firstEvent: null,
    lastEvent: null
  };

  console.log('\n' + '─'.repeat(80));
  console.log(`📦 Загрузка: ${organization.name} (${organization.bin})`);
  console.log('─'.repeat(80));

  try {
    // Получаем количество сотрудников в организации
    const employees = await db.queryRows(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE object_bin = $1 AND status = 1
    `, [organization.bin]);

    orgStats.employeesCount = employees[0]?.count || 0;
    console.log(`   Найдено сотрудников: ${orgStats.employeesCount}`);

    if (orgStats.employeesCount === 0) {
      console.log('   ⚠ Пропускаем - нет активных сотрудников');
      orgStats.status = 'success';
      orgStats.errorMessage = 'Нет активных сотрудников';
      return orgStats;
    }

    // Callback для отслеживания прогресса
    const progressCallback = (update) => {
      if (update.eventsLoaded !== undefined) {
        process.stdout.write(`\r   Прогресс: ${update.processedEmployees || 0}/${orgStats.employeesCount} сотрудников | События: ${update.eventsLoaded}`);
      }
    };

    // Загружаем события из внешнего API только за сегодня
    const eventsLoaded = await apiSync.loadTimeEventsWithProgress({
      tableNumber: null, // Загружаем для всех сотрудников
      dateFrom: DATE_TODAY,
      dateTo: DATE_TODAY,
      objectBin: organization.bin
    }, progressCallback);

    console.log(); // Новая строка после прогресса

    orgStats.eventsLoaded = eventsLoaded;
    console.log(`   ✓ Загружено событий: ${eventsLoaded}`);

    // Получаем информацию о загруженных событиях
    if (eventsLoaded > 0) {
      const eventInfo = await db.queryRows(`
        SELECT
          MIN(event_datetime AT TIME ZONE 'Asia/Almaty') as first_event,
          MAX(event_datetime AT TIME ZONE 'Asia/Almaty') as last_event
        FROM time_events
        WHERE object_bin = $1
          AND event_datetime::date = $2::date
      `, [organization.bin, DATE_TODAY]);

      if (eventInfo.length > 0) {
        orgStats.firstEvent = eventInfo[0].first_event ?
          new Date(eventInfo[0].first_event).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty' }) : null;
        orgStats.lastEvent = eventInfo[0].last_event ?
          new Date(eventInfo[0].last_event).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Almaty' }) : null;
      }
    }

    // Обрабатываем загруженные события
    const recordsProcessed = await apiSync.processTimeRecords();
    orgStats.recordsProcessed = recordsProcessed;
    console.log(`   ✓ Обработано записей: ${recordsProcessed}`);

    // Успешно завершено
    orgStats.status = 'success';

    const endTime = new Date();
    orgStats.duration = (endTime - startTime) / 1000;

    console.log(`   ⏱ Время обработки: ${formatDuration(orgStats.duration)}`);
    console.log(`   ✓ УСПЕШНО`);

  } catch (error) {
    const endTime = new Date();
    orgStats.duration = (endTime - startTime) / 1000;
    orgStats.status = 'error';
    orgStats.errorMessage = error.message;

    console.log(`   ✗ ОШИБКА: ${error.message}`);
  }

  return orgStats;
}

/**
 * Основная функция
 */
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ЗАГРУЗКА СОБЫТИЙ ЗА СЕГОДНЯ (ОРГАНИЗАЦИИ TARY)');
  console.log('                    PRODUCTION DATABASE');
  console.log('='.repeat(80));
  console.log(`База данных: ${executionStats.databaseInfo.host}:${executionStats.databaseInfo.port}/${executionStats.databaseInfo.database}`);
  console.log(`Дата: ${DATE_TODAY} (сегодня)`);
  console.log(`Организаций Tary: ${TARY_ORGANIZATIONS.length}`);
  console.log(`Старт: ${executionStats.startTime.toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`);
  console.log('='.repeat(80));

  try {
    // Подключаемся к БД
    await db.initializeDatabase();
    console.log('✓ Подключение к PRODUCTION базе данных установлено');

    // Проверяем подключение к правильной базе
    const versionCheck = await db.queryRows('SELECT version(), current_database(), inet_server_port()');
    console.log(`✓ База: ${versionCheck[0].current_database}, Порт: ${versionCheck[0].inet_server_port}`);

    // Проверяем текущее время
    const timeCheck = await db.queryRows("SELECT NOW() AT TIME ZONE 'Asia/Almaty' as current_time");
    console.log(`✓ Текущее время (Almaty): ${new Date(timeCheck[0].current_time).toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`);

    // Обрабатываем каждую организацию Tary
    for (let i = 0; i < TARY_ORGANIZATIONS.length; i++) {
      const org = TARY_ORGANIZATIONS[i];
      console.log(`\n[${i + 1}/${TARY_ORGANIZATIONS.length}] Обработка организации Tary...`);

      // Загружаем данные для организации (с обработкой ошибок)
      const orgStats = await loadOrganizationData(org);

      // Сохраняем статистику
      executionStats.organizations.push(orgStats);

      if (orgStats.status === 'success') {
        executionStats.successOrganizations++;
        executionStats.totalEventsLoaded += orgStats.eventsLoaded;
        executionStats.totalRecordsProcessed += orgStats.recordsProcessed;
        executionStats.totalEmployees += orgStats.employeesCount;
      } else {
        executionStats.failedOrganizations++;
      }

      // Небольшая пауза между организациями
      if (i < TARY_ORGANIZATIONS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

  } catch (error) {
    console.error('\n✗ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    console.error(error.stack);
  } finally {
    // Закрываем соединение с БД
    await db.close();

    // Фиксируем время окончания
    executionStats.endTime = new Date();

    // Генерируем и выводим отчет
    console.log('\n\n');
    const report = generateReport();
    console.log(report);

    // Сохраняем отчет в файл
    saveReport(report);

    // Выводим итоговую статистику
    const totalDuration = (executionStats.endTime - executionStats.startTime) / 1000;
    console.log('\n' + '='.repeat(80));
    console.log(`📅 Дата загрузки: ${DATE_TODAY}`);
    console.log(`⏱ Общее время выполнения: ${formatDuration(totalDuration)}`);
    console.log(`📊 Успешных организаций: ${executionStats.successOrganizations}/${TARY_ORGANIZATIONS.length}`);
    console.log(`📈 Всего событий загружено: ${executionStats.totalEventsLoaded}`);
    console.log('='.repeat(80) + '\n');
  }
}

// Запуск скрипта
main().catch(error => {
  console.error('Неожиданная ошибка:', error);
  process.exit(1);
});
