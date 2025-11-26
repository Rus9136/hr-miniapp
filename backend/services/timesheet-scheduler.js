/**
 * Автоматическая загрузка табельных данных по расписанию CRON
 * Запускается каждые 12 часов (09:00 и 21:00) для всех организаций
 */

const cron = require('node-cron');
const db = require('../database_pg');
const apiSync = require('../utils/apiSync_pg');

// Конфигурация из переменных окружения
const CRON_ENABLED = process.env.CRON_TIMESHEET_ENABLED === 'true';
const CRON_SCHEDULE = process.env.CRON_TIMESHEET_SCHEDULE || '0 9,21 * * *'; // Каждые 12 часов: 09:00 и 21:00
const CRON_DAYS_BACK = parseInt(process.env.CRON_TIMESHEET_DAYS_BACK || '2', 10); // Загружать последние 2 дня

let cronTask = null;
let isRunning = false;
let lastRunTime = null;
let nextRunTime = null;

/**
 * Логирование в БД
 */
async function logCronRun(data) {
  try {
    const query = `
      INSERT INTO cron_timesheet_logs
      (date_from, date_to, organization_bin, organization_name, events_loaded,
       records_processed, status, error_message, duration_seconds, started_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `;

    const result = await db.queryRows(query, [
      data.dateFrom,
      data.dateTo,
      data.organizationBin,
      data.organizationName,
      data.eventsLoaded || 0,
      data.recordsProcessed || 0,
      data.status,
      data.errorMessage || null,
      data.durationSeconds || null,
      data.startedAt,
      data.completedAt || new Date()
    ]);

    return result[0]?.id;
  } catch (error) {
    console.error('Failed to log CRON run:', error);
  }
}

/**
 * Загрузка данных для одной организации
 */
async function loadTimesheetForOrganization(organization, dateFrom, dateTo) {
  const startTime = new Date();

  console.log(`[CRON] Loading timesheet for ${organization.object_company} (${organization.object_bin})...`);

  try {
    // Загружаем события из внешнего API
    const progressCallback = (update) => {
      console.log(`[CRON] ${organization.object_company}: ${update.message}`);
    };

    const eventsLoaded = await apiSync.loadTimeEventsWithProgress({
      tableNumber: null, // Загружаем для всех сотрудников
      dateFrom,
      dateTo,
      objectBin: organization.object_bin
    }, progressCallback);

    // Обрабатываем загруженные события
    const recordsProcessed = await apiSync.processTimeRecords();

    const endTime = new Date();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    // Логируем успешное выполнение
    await logCronRun({
      dateFrom,
      dateTo,
      organizationBin: organization.object_bin,
      organizationName: organization.object_company,
      eventsLoaded,
      recordsProcessed,
      status: 'success',
      durationSeconds,
      startedAt: startTime,
      completedAt: endTime
    });

    console.log(`[CRON] ✓ ${organization.object_company}: ${eventsLoaded} events, ${recordsProcessed} records (${durationSeconds}s)`);

    return { success: true, eventsLoaded, recordsProcessed };

  } catch (error) {
    const endTime = new Date();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    // Логируем ошибку
    await logCronRun({
      dateFrom,
      dateTo,
      organizationBin: organization.object_bin,
      organizationName: organization.object_company,
      eventsLoaded: 0,
      recordsProcessed: 0,
      status: 'error',
      errorMessage: error.message,
      durationSeconds,
      startedAt: startTime,
      completedAt: endTime
    });

    console.error(`[CRON] ✗ ${organization.object_company}: ${error.message}`);

    return { success: false, error: error.message };
  }
}

/**
 * Основная функция автоматической загрузки
 */
async function autoLoadTimesheet() {
  if (isRunning) {
    console.log('[CRON] Previous run still in progress, skipping...');
    return;
  }

  isRunning = true;
  lastRunTime = new Date();

  console.log('='.repeat(80));
  console.log(`[CRON] 🚀 Starting automatic timesheet load at ${lastRunTime.toISOString()}`);
  console.log('='.repeat(80));

  try {
    // Получаем список всех организаций
    const organizations = await db.queryRows(`
      SELECT DISTINCT object_bin, object_company
      FROM departments
      WHERE object_company IS NOT NULL
        AND object_bin IS NOT NULL
      ORDER BY object_company
    `);

    if (!organizations || organizations.length === 0) {
      console.log('[CRON] No organizations found in database');
      isRunning = false;
      return;
    }

    console.log(`[CRON] Found ${organizations.length} organizations`);

    // Определяем период загрузки (последние N дней)
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - CRON_DAYS_BACK);

    const dateFromStr = dateFrom.toISOString().split('T')[0];
    const dateToStr = dateTo.toISOString().split('T')[0];

    console.log(`[CRON] Loading period: ${dateFromStr} to ${dateToStr} (${CRON_DAYS_BACK} days back)`);

    // Загружаем данные для каждой организации последовательно
    let totalEvents = 0;
    let totalRecords = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const org of organizations) {
      const result = await loadTimesheetForOrganization(org, dateFromStr, dateToStr);

      if (result.success) {
        successCount++;
        totalEvents += result.eventsLoaded || 0;
        totalRecords += result.recordsProcessed || 0;
      } else {
        errorCount++;
      }

      // Небольшая пауза между организациями
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('='.repeat(80));
    console.log(`[CRON] ✓ Completed automatic timesheet load`);
    console.log(`[CRON] Organizations: ${successCount} success, ${errorCount} errors`);
    console.log(`[CRON] Total events: ${totalEvents}, Total records: ${totalRecords}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('[CRON] Fatal error during automatic load:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Запуск планировщика
 */
function startScheduler() {
  if (!CRON_ENABLED) {
    console.log('[CRON] Timesheet scheduler is DISABLED (set CRON_TIMESHEET_ENABLED=true to enable)');
    return;
  }

  console.log(`[CRON] Starting timesheet scheduler with schedule: ${CRON_SCHEDULE}`);
  console.log(`[CRON] Loading last ${CRON_DAYS_BACK} days of data`);

  // Валидация CRON выражения
  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[CRON] Invalid CRON schedule: ${CRON_SCHEDULE}`);
    return;
  }

  // Создаем CRON задачу
  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    await autoLoadTimesheet();
  }, {
    timezone: "Asia/Almaty" // Часовой пояс Казахстана
  });

  // Вычисляем время следующего запуска
  updateNextRunTime();

  console.log(`[CRON] ✓ Scheduler started. Next run: ${nextRunTime?.toISOString()}`);
}

/**
 * Остановка планировщика
 */
function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    console.log('[CRON] Scheduler stopped');
  }
}

/**
 * Обновление времени следующего запуска
 */
function updateNextRunTime() {
  // Простой расчет для расписания "0 9,21 * * *"
  const now = new Date();
  const next = new Date(now);

  const currentHour = now.getHours();

  if (currentHour < 9) {
    next.setHours(9, 0, 0, 0);
  } else if (currentHour < 21) {
    next.setHours(21, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  }

  nextRunTime = next;
}

/**
 * Получение статуса планировщика
 */
function getSchedulerStatus() {
  updateNextRunTime();

  return {
    enabled: CRON_ENABLED,
    schedule: CRON_SCHEDULE,
    daysBack: CRON_DAYS_BACK,
    isRunning,
    lastRunTime,
    nextRunTime,
    cronTaskActive: cronTask !== null
  };
}

/**
 * Ручной запуск загрузки
 */
async function manualRun() {
  if (isRunning) {
    throw new Error('Загрузка уже выполняется');
  }

  console.log('[CRON] Manual run triggered');
  await autoLoadTimesheet();
}

module.exports = {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  manualRun,
  autoLoadTimesheet
};
