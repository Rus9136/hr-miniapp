/**
 * API endpoints для управления CRON планировщиком загрузки табелей
 */

const express = require('express');
const router = express.Router();
const db = require('../database_pg');
const scheduler = require('../services/timesheet-scheduler');

/**
 * GET /api/admin/cron/timesheet/status
 * Получить статус планировщика
 */
router.get('/admin/cron/timesheet/status', async (req, res) => {
  try {
    const status = scheduler.getSchedulerStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/cron/timesheet/run
 * Запустить загрузку вручную
 */
router.post('/admin/cron/timesheet/run', async (req, res) => {
  try {
    const status = scheduler.getSchedulerStatus();

    if (status.isRunning) {
      return res.status(409).json({
        success: false,
        error: 'Загрузка уже выполняется'
      });
    }

    // Запускаем в фоне
    scheduler.manualRun().catch(error => {
      console.error('Manual run error:', error);
    });

    res.json({
      success: true,
      message: 'Загрузка запущена в фоновом режиме'
    });

  } catch (error) {
    console.error('Error starting manual run:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/cron/timesheet/logs
 * Получить историю запусков
 */
router.get('/admin/cron/timesheet/logs', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status, organization } = req.query;

    let query = `
      SELECT
        id,
        run_date,
        date_from,
        date_to,
        organization_bin,
        organization_name,
        events_loaded,
        records_processed,
        status,
        error_message,
        duration_seconds,
        started_at,
        completed_at
      FROM cron_timesheet_logs
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (organization) {
      params.push(organization);
      query += ` AND organization_bin = $${params.length}`;
    }

    query += ` ORDER BY run_date DESC`;

    params.push(parseInt(limit, 10));
    query += ` LIMIT $${params.length}`;

    params.push(parseInt(offset, 10));
    query += ` OFFSET $${params.length}`;

    const logs = await db.queryRows(query, params);

    // Получаем общую статистику
    const statsQuery = `
      SELECT
        COUNT(*) as total_runs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
        SUM(events_loaded) as total_events,
        SUM(records_processed) as total_records,
        AVG(duration_seconds) as avg_duration
      FROM cron_timesheet_logs
      WHERE run_date >= NOW() - INTERVAL '30 days'
    `;

    const stats = await db.queryRows(statsQuery);

    res.json({
      logs,
      stats: stats[0] || {},
      pagination: {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });

  } catch (error) {
    console.error('Error fetching CRON logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/cron/timesheet/logs/summary
 * Получить сводку по организациям
 */
router.get('/admin/cron/timesheet/logs/summary', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const query = `
      SELECT
        organization_bin,
        organization_name,
        COUNT(*) as runs_count,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_count,
        SUM(events_loaded) as total_events,
        SUM(records_processed) as total_records,
        MAX(run_date) as last_run,
        AVG(duration_seconds) as avg_duration
      FROM cron_timesheet_logs
      WHERE run_date >= NOW() - INTERVAL '${parseInt(days, 10)} days'
      GROUP BY organization_bin, organization_name
      ORDER BY organization_name
    `;

    const summary = await db.queryRows(query);

    res.json({ summary, period_days: parseInt(days, 10) });

  } catch (error) {
    console.error('Error fetching CRON summary:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/cron/timesheet/logs
 * Очистить старые логи
 */
router.delete('/admin/cron/timesheet/logs', async (req, res) => {
  try {
    const { days = 90 } = req.query;

    const query = `
      DELETE FROM cron_timesheet_logs
      WHERE run_date < NOW() - INTERVAL '${parseInt(days, 10)} days'
      RETURNING id
    `;

    const deleted = await db.queryRows(query);

    res.json({
      success: true,
      deleted_count: deleted.length,
      message: `Удалено ${deleted.length} записей старше ${days} дней`
    });

  } catch (error) {
    console.error('Error deleting old logs:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
