/**
 * Главный роутер для админ-панели
 * Объединяет все модули: employees, departments, organizations, time-tracking, schedules, reports
 */

const express = require('express');
const router = express.Router();

// Импорт подроутеров
const employeesRouter = require('./employees');
const departmentsRouter = require('./departments');
const organizationsRouter = require('./organizations');
const timeTrackingRouter = require('./time-tracking');
const schedulesRouter = require('./schedules');
const reportsRouter = require('./reports');

/**
 * POST /admin/check
 * Проверка админ-доступа
 */
router.post('/admin/check', (req, res) => {
    const { tableNumber } = req.body;
    
    if (tableNumber === 'admin12qw') {
        res.json({
            isAdmin: true,
            message: 'Admin access granted'
        });
    } else {
        res.json({
            isAdmin: false,
            message: 'Not an admin'
        });
    }
});

/**
 * POST /admin/ai-webhook-proxy
 * Прокси для AI вебхука для обхода CSP
 */
router.post('/admin/ai-webhook-proxy', async (req, res) => {
    try {
        const { branch_id, hall_area, kitchen_area, seats_count, date_start, date_end, prev_period_start, prev_period_end } = req.body;
        
        console.log('AI webhook proxy request:', { 
            branch_id, 
            hall_area, 
            kitchen_area, 
            seats_count, 
            date_start, 
            date_end,
            prev_period_start,
            prev_period_end
        });
        
        // Validate required fields
        if (!branch_id || !date_start || !date_end) {
            return res.status(400).json({ 
                error: 'Missing required fields: branch_id, date_start, and date_end' 
            });
        }
        
        // Make request to external webhook
        const webhookUrl = 'https://n8n.sandyq.space/webhook/optimize-branch';
        const webhookData = { 
            branch_id, 
            hall_area, 
            kitchen_area, 
            seats_count, 
            date_start, 
            date_end,
            prev_period_start,
            prev_period_end
        };
        
        console.log('Sending request to webhook:', webhookUrl, webhookData);
        
        const fetch = require('node-fetch');
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookData)
        });
        
        if (!response.ok) {
            const errorMessage = `Webhook responded with status: ${response.status}`;
            console.warn(errorMessage);
            
            // Handle specific error codes
            if (response.status === 404) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook endpoint not found',
                    message: 'The AI recommendation service is currently unavailable'
                });
            }
            
            if (response.status >= 400 && response.status < 500) {
                return res.status(400).json({
                    success: false,
                    error: 'Bad request to webhook',
                    message: `The request was rejected by the AI service (status: ${response.status})`
                });
            }
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('Webhook response:', result);
        
        res.json({
            success: true,
            message: 'AI recommendation sent successfully',
            data: result
        });
        
    } catch (error) {
        console.error('AI webhook proxy error:', error);
        res.status(500).json({ 
            error: 'Failed to send AI recommendation',
            message: error.message 
        });
    }
});

// ==================== МОНТИРОВАНИЕ ПОДРОУТЕРОВ ====================

// Сотрудники: /admin/employees, /admin/sync/employees, /admin/employees/update-iin
router.use('/admin/employees', employeesRouter);
router.post('/admin/sync/employees', (req, res, next) => {
    req.url = '/sync';
    employeesRouter(req, res, next);
});

// Подразделения: /admin/departments, /admin/sync/departments
router.use('/admin/departments', departmentsRouter);
router.post('/admin/sync/departments', (req, res, next) => {
    req.url = '/sync';
    departmentsRouter(req, res, next);
});

// Должности: /admin/positions, /admin/sync/positions
router.get('/admin/positions', (req, res, next) => {
    req.url = '/positions/list';
    departmentsRouter(req, res, next);
});
router.post('/admin/sync/positions', (req, res, next) => {
    req.url = '/positions/sync';
    departmentsRouter(req, res, next);
});

// Организации: /admin/organizations
router.use('/admin/organizations', organizationsRouter);

// Учёт времени: /admin/time-events, /admin/time-records, /admin/load/timesheet
router.get('/admin/time-events', (req, res, next) => {
    req.url = '/events';
    timeTrackingRouter(req, res, next);
});
router.delete('/admin/time-events/clear-all', (req, res, next) => {
    req.url = '/events/clear-all';
    timeTrackingRouter(req, res, next);
});

router.get('/admin/time-records', (req, res, next) => {
    req.url = '/records';
    timeTrackingRouter(req, res, next);
});
router.delete('/admin/time-records/clear-all', (req, res, next) => {
    req.url = '/records/clear-all';
    timeTrackingRouter(req, res, next);
});

router.post('/admin/load/timesheet', (req, res, next) => {
    req.url = '/load/timesheet';
    timeTrackingRouter(req, res, next);
});
router.get('/admin/load/progress/:id', (req, res, next) => {
    req.url = `/load/progress/${req.params.id}`;
    timeTrackingRouter(req, res, next);
});

router.post('/admin/recalculate-time-records', (req, res, next) => {
    req.url = '/recalculate';
    timeTrackingRouter(req, res, next);
});

// Графики: /admin/schedules/*
router.use('/admin/schedules', schedulesRouter);

// Отчёты: /admin/reports/*, /admin/payroll/*
router.use('/admin/reports', reportsRouter);
router.get('/admin/payroll/attendance', (req, res, next) => {
    req.url = '/attendance';
    reportsRouter(req, res, next);
});

module.exports = router;



