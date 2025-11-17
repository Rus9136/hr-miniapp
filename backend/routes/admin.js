const express = require('express');
const router = express.Router();
const db = require('../database_pg');
const apiSync = require('../utils/apiSync_pg');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Create special parser for large 1C imports
const largeJsonParser = bodyParser.json({ limit: '100mb' });

// Debug logger for import operations
const debugLog = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}\n`;

    // Log to console
    console.log(message, data || '');

    // Log to file
    try {
        fs.appendFileSync('/tmp/import_debug.log', logMessage);
    } catch (err) {
        console.error('Failed to write to debug log:', err);
    }
};

// Get all employees with department and position info
router.get('/admin/employees', (req, res) => {
    const query = `
        SELECT 
            e.*,
            d.object_name as department_name,
            p.staff_position_name as position_name,
            e.object_bin,
            e.iin,
            ws.schedule_name as current_schedule
        FROM employees e
        LEFT JOIN departments d ON e.object_code = d.object_code
        LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
        LEFT JOIN (
            SELECT DISTINCT ON (esa.employee_number) 
                esa.employee_number,
                ws1c.schedule_name
            FROM employee_schedule_assignments esa
            LEFT JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
            WHERE esa.end_date IS NULL
            ORDER BY esa.employee_number, esa.created_at DESC
        ) ws ON e.table_number = ws.employee_number
        ORDER BY e.full_name
    `;

    db.queryRows(query).then(rows => {
        res.json(rows);
    }).catch(err => {
        console.error('Error fetching employees:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

// Get all departments (with optional organization filter)
router.get('/admin/departments', async (req, res) => {
    try {
        const { organization } = req.query;
        
        let query = 'SELECT *, id_iiko::text as id_iiko, hall_area, kitchen_area, seats_count, trade_point FROM departments';
        let params = [];
        
        if (organization) {
            query += ' WHERE object_bin = $1';
            params.push(organization);
        }
        
        query += ' ORDER BY object_name';
        
        console.log('Departments query:', query, 'params:', params);
        const rows = await db.queryRows(query, params);
        console.log(`Found ${rows.length} departments for organization: ${organization || 'all'}`);
        
        res.json(rows);
    } catch (err) {
        console.error('Error fetching departments:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all positions
router.get('/admin/positions', async (req, res) => {
    try {
        const rows = await db.queryRows('SELECT * FROM positions ORDER BY staff_position_name');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching positions:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin login check (for now, just check if it's admin12qw)
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

// Sync employees from external API
router.post('/admin/sync/employees', async (req, res) => {
    try {
        console.log('Starting employee sync...');
        const count = await apiSync.syncEmployees();
        res.json({ 
            success: true, 
            message: `Синхронизировано ${count} сотрудников`,
            count: count
        });
    } catch (error) {
        console.error('Employee sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации сотрудников: ' + error.message 
        });
    }
});

// Sync departments from external API
router.post('/admin/sync/departments', async (req, res) => {
    try {
        console.log('Starting department sync...');
        const count = await apiSync.syncDepartments();
        res.json({ 
            success: true, 
            message: `Синхронизировано ${count} подразделений`,
            count: count
        });
    } catch (error) {
        console.error('Department sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации подразделений: ' + error.message 
        });
    }
});

// Sync positions from external API
router.post('/admin/sync/positions', async (req, res) => {
    try {
        console.log('Starting position sync...');
        const count = await apiSync.syncPositions();
        res.json({ 
            success: true, 
            message: `Синхронизировано ${count} должностей`,
            count: count
        });
    } catch (error) {
        console.error('Position sync error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка синхронизации должностей: ' + error.message 
        });
    }
});

// Load time events from external API with progress tracking
router.post('/admin/load/timesheet', async (req, res) => {
    try {
        const { tableNumber, dateFrom, dateTo, objectBin } = req.body;
        
        if (!dateFrom || !dateTo) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо указать даты начала и конца периода' 
            });
        }

        console.log('Loading timesheet data:', { tableNumber, dateFrom, dateTo, objectBin });
        
        // Start the loading process in the background and return immediately
        const loadingId = Date.now().toString();
        
        // Store progress state with automatic cleanup
        if (!global.loadingProgress) {
            global.loadingProgress = {};
        }
        
        // Clean up old progress entries (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        Object.keys(global.loadingProgress).forEach(key => {
            const progress = global.loadingProgress[key];
            if (progress.startTime && new Date(progress.startTime).getTime() < oneHourAgo) {
                delete global.loadingProgress[key];
            }
        });
        
        global.loadingProgress[loadingId] = {
            status: 'starting',
            message: 'Инициализация загрузки...',
            currentDepartment: '',
            eventsLoaded: 0,
            totalEmployees: 0,
            processedEmployees: 0,
            startTime: new Date()
        };
        
        // Start loading in background
        loadTimesheetWithProgress(loadingId, { tableNumber, dateFrom, dateTo, objectBin });
        
        res.json({ 
            success: true, 
            loadingId: loadingId,
            message: 'Загрузка начата. Используйте GET /admin/load/progress/:id для получения статуса'
        });
    } catch (error) {
        console.error('Timesheet load error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка загрузки табельных данных: ' + error.message 
        });
    }
});

// Get loading progress
router.get('/admin/load/progress/:id', (req, res) => {
    const { id } = req.params;
    const progress = global.loadingProgress?.[id];
    
    if (!progress) {
        return res.status(404).json({ 
            success: false, 
            error: 'Процесс загрузки не найден' 
        });
    }
    
    res.json({
        success: true,
        ...progress
    });
});

// Background loading function with progress updates
async function loadTimesheetWithProgress(loadingId, params) {
    try {
        const progress = global.loadingProgress[loadingId];
        
        // Update progress callback
        const updateProgress = (update) => {
            Object.assign(progress, update);
        };
        
        updateProgress({
            status: 'loading',
            message: 'Загрузка событий из внешнего API...'
        });
        
        // Загрузка событий из внешнего API с прогрессом
        const totalEvents = await apiSync.loadTimeEventsWithProgress(params, updateProgress);

        updateProgress({
            status: 'processing',
            message: 'Обработка и сохранение записей...'
        });

        // Обработка и сохранение событий
        const processed = await apiSync.processTimeRecords();
        
        updateProgress({
            status: 'completed',
            message: `Загрузка завершена! Загружено ${totalEvents} событий, обработано ${processed} записей`,
            eventsLoaded: totalEvents,
            recordsProcessed: processed,
            endTime: new Date()
        });
        
        // Clean up after 2 minutes (reduced from 5)
        setTimeout(() => {
            if (global.loadingProgress && global.loadingProgress[loadingId]) {
                delete global.loadingProgress[loadingId];
            }
        }, 2 * 60 * 1000);
        
    } catch (error) {
        console.error('Background loading error:', error);
        global.loadingProgress[loadingId] = {
            ...global.loadingProgress[loadingId],
            status: 'error',
            message: 'Ошибка загрузки: ' + error.message,
            error: error.message
        };
    }
}

// Get organizations for dropdown
router.get('/admin/organizations', async (req, res) => {
    try {
        const rows = await db.queryRows(
            'SELECT DISTINCT object_bin, object_company FROM departments WHERE object_company IS NOT NULL ORDER BY object_company'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching organizations:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get time events with filters
router.get('/admin/time-events', (req, res) => {
    const { organization, department, dateFrom, dateTo } = req.query;
    
    let query = `
        SELECT
            te.id,
            te.employee_number,
            te.event_type,
            TO_CHAR(te.event_datetime, 'YYYY-MM-DD HH24:MI:SS') as event_datetime,
            te.event_datetime as event_datetime_sort,
            te.object_code as te_object_code,
            te.created_at,
            e.full_name,
            e.table_number,
            e.object_bin,
            d.object_name as department_name,
            d.object_code as department_code
        FROM time_events te
        LEFT JOIN employees e ON te.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        WHERE 1=1
    `;
    
    const params = [];
    
    if (organization) {
        query += ` AND e.object_bin = $${params.length + 1}`;
        params.push(organization);
    }
    
    if (department) {
        query += ` AND d.object_code = $${params.length + 1}`;
        params.push(department);
    }
    
    if (dateFrom) {
        query += ` AND te.event_datetime::date >= $${params.length + 1}`;
        params.push(dateFrom);
    }
    
    if (dateTo) {
        query += ` AND te.event_datetime::date <= $${params.length + 1}`;
        params.push(dateTo);
    }
    
    query += ` ORDER BY event_datetime_sort DESC LIMIT 1000`;
    
    db.queryRows(query, params).then(rows => {
        res.json(rows);
    }).catch(err => {
        console.error('Error fetching time events:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

// Get time records with filters
router.get('/admin/time-records', (req, res) => {
    const { organization, department, month, status } = req.query;
    
    let query = `
        SELECT 
            tr.*,
            tr.off_schedule,
            e.full_name,
            e.table_number,
            e.object_bin,
            d.object_name as department_name,
            d.object_code as department_code
        FROM time_records tr
        LEFT JOIN employees e ON tr.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        WHERE 1=1
    `;
    
    const params = [];
    
    if (organization) {
        query += ` AND e.object_bin = $${params.length + 1}`;
        params.push(organization);
    }
    
    if (department) {
        query += ` AND d.object_code = $${params.length + 1}`;
        params.push(department);
    }
    
    if (month) {
        query += ` AND to_char(tr.date, 'YYYY-MM') = $${params.length + 1}`;
        params.push(month);
    }
    
    if (status) {
        query += ` AND tr.status = $${params.length + 1}`;
        params.push(status);
    }
    
    query += ` ORDER BY tr.date DESC, e.full_name ASC LIMIT 1000`;
    
    db.queryRows(query, params).then(rows => {
        res.json(rows);
    }).catch(err => {
        console.error('Error fetching time records:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

// Recalculate time records from time_events
// Proxy endpoint for AI webhook to bypass CSP
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

router.post('/admin/recalculate-time-records', async (req, res) => {
    try {
        const { organization, department, month } = req.body;
        
        console.log('Starting filtered time records recalculation with filters:', { organization, department, month });
        
        // Month is required
        if (!month) {
            return res.status(400).json({
                success: false,
                error: 'Месяц обязателен для пересчета табеля'
            });
        }
        
        // Build filter conditions for time_events query
        let whereConditions = ['te.employee_number IS NOT NULL'];
        let deleteWhereConditions = ['1=1'];
        const params = [];
        const deleteParams = [];
        
        // Month filter (required)
        whereConditions.push(`to_char(te.event_datetime, 'YYYY-MM') = $${params.length + 1}`);
        params.push(month);
        
        deleteWhereConditions.push(`to_char(date, 'YYYY-MM') = $${deleteParams.length + 1}`);
        deleteParams.push(month);
        
        // Organization filter (optional)
        if (organization) {
            whereConditions.push(`e.object_bin = $${params.length + 1}`);
            params.push(organization);
            
            deleteWhereConditions.push(`employee_number IN (SELECT table_number FROM employees WHERE object_bin = $${deleteParams.length + 1})`);
            deleteParams.push(organization);
        }
        
        // Department filter (optional)
        if (department) {
            whereConditions.push(`e.object_code = $${params.length + 1}`);
            params.push(department);
            
            deleteWhereConditions.push(`employee_number IN (SELECT table_number FROM employees WHERE object_code = $${deleteParams.length + 1})`);
            deleteParams.push(department);
        }
        
        // Delete existing filtered time_records (not all records)
        const deleteQuery = `DELETE FROM time_records WHERE ${deleteWhereConditions.join(' AND ')}`;
        const deleteResult = await db.query(deleteQuery, deleteParams);
        console.log(`Deleted ${deleteResult.rowCount} existing time records for the filtered period`);
        
        // Get filtered time events with employee work schedules
        const timeEventsQuery = `
            SELECT 
                te.employee_number,
                to_char(te.event_datetime::date, 'YYYY-MM-DD') as date,
                te.event_datetime,
                te.event_type,
                e.id as employee_id,
                ws1c.work_start_time,
                ws1c.work_end_time,
                ws1c.work_hours,
                ws1c.schedule_name
            FROM time_events te
            LEFT JOIN employees e ON te.employee_number = e.table_number
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN (
                SELECT DISTINCT ON (esa.employee_number) 
                    esa.employee_number,
                    esa.schedule_code,
                    ws1c.work_start_time,
                    ws1c.work_end_time,
                    ws1c.work_hours,
                    ws1c.schedule_name
                FROM employee_schedule_assignments esa
                LEFT JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
                WHERE esa.end_date IS NULL
                ORDER BY esa.employee_number, esa.created_at DESC
            ) ws1c ON e.table_number = ws1c.employee_number
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY te.employee_number, te.event_datetime
        `;
        
        const timeEvents = await db.queryRows(timeEventsQuery, params);
        
        console.log(`Found ${timeEvents.length} time events to process`);
        
        // Group events by employee and date
        const groupedEvents = {};
        timeEvents.forEach(event => {
            const key = `${event.employee_number}_${event.date}`;
            if (!groupedEvents[key]) {
                groupedEvents[key] = {
                    employee_number: event.employee_number,
                    employee_id: event.employee_id,
                    date: event.date,
                    work_start_time: event.work_start_time,
                    work_end_time: event.work_end_time,
                    work_hours: event.work_hours,
                    schedule_name: event.schedule_name,
                    events: []
                };
            }
            groupedEvents[key].events.push(event);
        });
        
        console.log(`Processing ${Object.keys(groupedEvents).length} employee-day combinations`);
        
        let processedCount = 0;
        
        for (const key in groupedEvents) {
            const dayData = groupedEvents[key];
            const events = dayData.events.sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
            
            // IMPROVED LOGIC: Find first entry and last exit
            let checkIn = null;
            let checkOut = null;
            
            // Get all entry events (type 1) and exit events (type 2)
            const entryEvents = events.filter(e => e.event_type === '1').sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
            const exitEvents = events.filter(e => e.event_type === '2').sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
            
            if (entryEvents.length > 0) {
                checkIn = entryEvents[0].event_datetime; // FIRST entry of the day
            }
            
            if (exitEvents.length > 0) {
                checkOut = exitEvents[exitEvents.length - 1].event_datetime; // LAST exit of the day
            }
            
            // Fallback for type 0 events if no typed events exist
            if (!checkIn && !checkOut && events.length > 0) {
                if (events.length === 1) {
                    const hour = new Date(events[0].event_datetime).getHours();
                    if (hour < 12) {
                        checkIn = events[0].event_datetime;
                    } else {
                        checkOut = events[0].event_datetime;
                    }
                } else {
                    checkIn = events[0].event_datetime;
                    checkOut = events[events.length - 1].event_datetime;
                }
            }
            
            // ENHANCED: Check if this is a scheduled workday with specific date check
            const scheduledWorkday = await isScheduledWorkday(dayData.employee_number, dayData.date);
            
            // Use actual schedule data if found, otherwise use general schedule info
            const scheduleForCalculation = scheduledWorkday || dayData;
            
            // IMPROVED: Calculate hours using advanced logic with schedule verification
            const hoursCalculation = calculateAdvancedHours(
                checkIn, 
                checkOut, 
                scheduleForCalculation, 
                dayData.date
            );
            
            // IMPROVED: Use enhanced status determination with night shift support
            const status = determineShiftStatus(checkIn, checkOut, scheduleForCalculation);
            
            // Legacy hours_worked field uses final_hours for backward compatibility
            const hoursWorked = hoursCalculation.final_hours;
            
            console.log(`📊 Hours breakdown for ${dayData.employee_number} on ${dayData.date}:`);
            console.log(`   Actual: ${hoursCalculation.actual_hours?.toFixed(2)}h`);
            console.log(`   Planned: ${hoursCalculation.planned_hours?.toFixed(2)}h`);
            console.log(`   Final: ${hoursCalculation.final_hours?.toFixed(2)}h`);
            console.log(`   Overtime: ${hoursCalculation.overtime_hours?.toFixed(2)}h`);
            console.log(`   Scheduled: ${hoursCalculation.is_scheduled_workday ? 'Yes' : 'No'}`);
            console.log(`   Lunch break: ${hoursCalculation.has_lunch_break ? 'Yes' : 'No'}`);
            
            await db.query(`
                INSERT INTO time_records 
                (employee_id, employee_number, date, check_in, check_out, 
                 hours_worked, planned_hours, actual_hours, overtime_hours,
                 status, off_schedule, is_scheduled_workday, has_lunch_break,
                 created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
                ON CONFLICT (employee_number, date) DO UPDATE SET
                    check_in = EXCLUDED.check_in,
                    check_out = EXCLUDED.check_out,
                    hours_worked = EXCLUDED.hours_worked,
                    planned_hours = EXCLUDED.planned_hours,
                    actual_hours = EXCLUDED.actual_hours,
                    overtime_hours = EXCLUDED.overtime_hours,
                    status = EXCLUDED.status,
                    off_schedule = EXCLUDED.off_schedule,
                    is_scheduled_workday = EXCLUDED.is_scheduled_workday,
                    has_lunch_break = EXCLUDED.has_lunch_break,
                    updated_at = NOW()
            `, [
                dayData.employee_id,
                dayData.employee_number,
                dayData.date,
                checkIn,
                checkOut,
                hoursWorked,                          // $6 - legacy hours_worked
                hoursCalculation.planned_hours,       // $7 - planned_hours
                hoursCalculation.actual_hours,        // $8 - actual_hours  
                hoursCalculation.overtime_hours,      // $9 - overtime_hours
                status,                               // $10 - status
                !hoursCalculation.is_scheduled_workday, // $11 - off_schedule
                hoursCalculation.is_scheduled_workday,  // $12 - is_scheduled_workday
                hoursCalculation.has_lunch_break      // $13 - has_lunch_break
            ]);
            
            processedCount++;
        }
        
        console.log(`Filtered recalculation completed. Processed ${processedCount} records for filters:`, { organization, department, month });
        
        // Build descriptive message about what was processed
        let filterDescription = `месяц: ${month}`;
        if (organization) filterDescription += `, организация: ${organization}`;
        if (department) filterDescription += `, подразделение: ${department}`;
        
        res.json({
            success: true,
            message: `Пересчет завершен успешно с учетом фильтров (${filterDescription})`,
            processedRecords: processedCount,
            totalEvents: timeEvents.length,
            deletedRecords: deleteResult.rowCount,
            filters: { organization, department, month }
        });
        
    } catch (error) {
        console.error('Time records recalculation error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка пересчета рабочего времени: ' + error.message
        });
    }
});

// ==================== WORK SCHEDULES ENDPOINTS ====================

// Get all schedule templates
router.get('/admin/schedules/templates', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.*,
                COUNT(DISTINCT esh.employee_id) as employee_count,
                STRING_AGG(DISTINCT d.object_company, ', ') as organizations,
                COUNT(DISTINCT wsd.work_date) as work_days_count
            FROM work_schedule_templates t
            LEFT JOIN employee_schedule_history esh ON t.id = esh.template_id AND esh.end_date IS NULL
            LEFT JOIN employees e ON esh.employee_id = e.id
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN work_schedule_dates wsd ON t.id = wsd.template_id
            WHERE t.is_active = true
            GROUP BY t.id
            ORDER BY t.name
        `;
        
        const templates = await db.queryRows(query);
        res.json(templates);
    } catch (error) {
        console.error('Error fetching schedule templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single schedule template with dates
router.get('/admin/schedules/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get template
        const template = await db.queryRow(
            'SELECT * FROM work_schedule_templates WHERE id = $1',
            [id]
        );
        
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Get work dates
        const dates = await db.queryRows(
            'SELECT * FROM work_schedule_dates WHERE template_id = $1 ORDER BY work_date',
            [id]
        );
        
        // Get assigned employees with departments
        const employees = await db.queryRows(`
            SELECT 
                e.id,
                e.full_name,
                e.table_number,
                d.object_name as department_name,
                d.object_company as organization,
                esh.start_date
            FROM employee_schedule_history esh
            JOIN employees e ON esh.employee_id = e.id
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE esh.template_id = $1 AND esh.end_date IS NULL
            ORDER BY d.object_company, d.object_name, e.full_name
        `, [id]);
        
        res.json({ template, dates, employees });
    } catch (error) {
        console.error('Error fetching schedule template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new schedule template
router.post('/admin/schedules/templates', async (req, res) => {
    try {
        const { name, description, check_in_time, check_out_time, dates } = req.body;
        
        // Start transaction
        await db.query('BEGIN');
        
        // Create template
        const templateResult = await db.queryRow(`
            INSERT INTO work_schedule_templates 
            (name, description, check_in_time, check_out_time, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *
        `, [name, description, check_in_time || '09:00', check_out_time || '18:00']);
        
        // Create dates
        if (dates && dates.length > 0) {
            for (const date of dates) {
                await db.query(`
                    INSERT INTO work_schedule_dates
                    (template_id, work_date)
                    VALUES ($1, $2)
                `, [templateResult.id, date]);
            }
        }
        
        await db.query('COMMIT');
        res.json({ success: true, template: templateResult });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error creating schedule template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update schedule template
router.put('/admin/schedules/templates/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, check_in_time, check_out_time, dates } = req.body;
        
        await db.query('BEGIN');
        
        // Update template
        const templateResult = await db.queryRow(`
            UPDATE work_schedule_templates 
            SET name = $1, description = $2, check_in_time = $3, check_out_time = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `, [name, description, check_in_time, check_out_time, id]);
        
        if (!templateResult) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Update dates if provided
        if (dates !== undefined) {
            // Delete existing dates
            await db.query('DELETE FROM work_schedule_dates WHERE template_id = $1', [id]);
            
            // Insert new dates
            if (dates.length > 0) {
                for (const date of dates) {
                    await db.query(`
                        INSERT INTO work_schedule_dates
                        (template_id, work_date)
                        VALUES ($1, $2)
                    `, [id, date]);
                }
            }
        }
        
        await db.query('COMMIT');
        res.json({ success: true, template: templateResult });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error updating schedule template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Assign schedule to employees
router.post('/admin/schedules/assign', async (req, res) => {
    try {
        const { template_id, employee_ids, start_date, assigned_by } = req.body;
        
        // Improved validation
        if (!template_id || !employee_ids || !start_date) {
            return res.status(400).json({ 
                success: false,
                error: 'Необходимо указать шаблон графика, сотрудников и дату начала' 
            });
        }
        
        // Validate employee_ids is an array
        if (!Array.isArray(employee_ids) || employee_ids.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Необходимо выбрать хотя бы одного сотрудника' 
            });
        }
        
        // Check if template exists
        const template = await db.queryRow(
            'SELECT id, name FROM work_schedule_templates WHERE id = $1 AND is_active = true',
            [template_id]
        );
        
        if (!template) {
            return res.status(400).json({ 
                success: false,
                error: 'Указанный шаблон графика не найден или неактивен' 
            });
        }
        
        console.log(`Assigning schedule "${template.name}" to ${employee_ids.length} employees from ${start_date}`);
        
        await db.query('BEGIN');
        
        let assignedCount = 0;
        let skippedCount = 0;
        const errors = [];
        
        for (const employee_id of employee_ids) {
            try {
                // Get employee info
                const employee = await db.queryRow(
                    'SELECT id, table_number, full_name FROM employees WHERE id = $1',
                    [employee_id]
                );
                
                if (!employee) {
                    errors.push(`Сотрудник с ID ${employee_id} не найден`);
                    skippedCount++;
                    continue;
                }
                
                console.log(`Processing employee: ${employee.full_name} (${employee.table_number})`);
                
                // Check for overlapping schedules in the future
                const existingSchedule = await db.queryRow(`
                    SELECT 
                        esh.id,
                        esh.start_date,
                        esh.end_date,
                        wst.name as template_name
                    FROM employee_schedule_history esh
                    JOIN work_schedule_templates wst ON esh.template_id = wst.id
                    WHERE esh.employee_id = $1 
                    AND (
                        esh.end_date IS NULL 
                        OR esh.end_date >= $2::date
                    )
                    AND esh.start_date <= $2::date
                `, [employee_id, start_date]);
                
                if (existingSchedule) {
                    console.log(`Found existing schedule for ${employee.full_name}: ${existingSchedule.template_name} from ${existingSchedule.start_date}`);
                    
                    // Check if new start date is after existing start date
                    const newStartDate = new Date(start_date);
                    const existingStartDate = new Date(existingSchedule.start_date);
                    
                    if (newStartDate > existingStartDate) {
                        // End current schedule the day before the new one starts
                        const endDate = new Date(start_date);
                        endDate.setDate(endDate.getDate() - 1);
                        const endDateStr = endDate.toISOString().split('T')[0];
                        
                        await db.query(`
                            UPDATE employee_schedule_history 
                            SET end_date = $1::date
                            WHERE id = $2
                        `, [endDateStr, existingSchedule.id]);
                        
                        console.log(`Ended previous schedule for ${employee.full_name} on ${endDateStr}`);
                    } else {
                        // New schedule starts before or same as existing - remove existing schedule entirely
                        await db.query(`
                            DELETE FROM employee_schedule_history 
                            WHERE id = $1
                        `, [existingSchedule.id]);
                        
                        console.log(`Removed previous schedule for ${employee.full_name} (conflicting dates)`);
                    }
                }
                
                // Create new schedule assignment
                await db.query(`
                    INSERT INTO employee_schedule_history
                    (employee_id, employee_number, template_id, start_date, assigned_by)
                    VALUES ($1, $2, $3, $4, $5)
                `, [employee_id, employee.table_number, template_id, start_date, assigned_by || 'admin']);
                
                console.log(`Assigned new schedule to ${employee.full_name} from ${start_date}`);
                assignedCount++;
                
            } catch (empError) {
                console.error(`Error processing employee ${employee_id}:`, empError);
                errors.push(`Ошибка для сотрудника ${employee_id}: ${empError.message}`);
                skippedCount++;
            }
        }
        
        await db.query('COMMIT');
        
        let message = `График "${template.name}" назначен ${assignedCount} сотрудникам`;
        if (skippedCount > 0) {
            message += `, пропущено ${skippedCount} сотрудников`;
        }
        
        console.log(`Assignment completed: ${assignedCount} assigned, ${skippedCount} skipped`);
        
        res.json({ 
            success: true, 
            message: message,
            assignedCount,
            skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error assigning schedule:', error);
        res.status(500).json({ 
            success: false,
            error: 'Ошибка при назначении графика: ' + error.message 
        });
    }
});

// Get employees for schedule assignment (with filters)
router.get('/admin/schedules/available-employees', async (req, res) => {
    try {
        const { organization, department, position } = req.query;
        
        let query = `
            SELECT 
                e.id,
                e.full_name,
                e.table_number,
                d.object_name as department_name,
                p.staff_position_name as position_name,
                d.object_company as organization,
                wst.name as current_schedule
            FROM employees e
            LEFT JOIN departments d ON e.object_code = d.object_code
            LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
            LEFT JOIN employee_schedule_history esh ON e.id = esh.employee_id AND esh.end_date IS NULL
            LEFT JOIN work_schedule_templates wst ON esh.template_id = wst.id
            WHERE e.status = 1
        `;
        
        const params = [];
        
        if (organization) {
            query += ` AND e.object_bin = $${params.length + 1}`;
            params.push(organization);
        }
        
        if (department) {
            query += ` AND e.object_code = $${params.length + 1}`;
            params.push(department);
        }
        
        if (position) {
            query += ` AND e.staff_position_code = $${params.length + 1}`;
            params.push(position);
        }
        
        query += ` ORDER BY d.object_company, d.object_name, e.full_name`;
        
        const employees = await db.queryRows(query, params);
        res.json(employees);
    } catch (error) {
        console.error('Error fetching available employees:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get employee schedule history
router.get('/admin/schedules/employee/:employeeId/history', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        const history = await db.queryRows(`
            SELECT 
                esh.*,
                wst.name as template_name,
                wst.schedule_type
            FROM employee_schedule_history esh
            JOIN work_schedule_templates wst ON esh.template_id = wst.id
            WHERE esh.employee_id = $1
            ORDER BY esh.start_date DESC
        `, [employeeId]);
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching employee schedule history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== CLEAR TABLE ENDPOINTS ====================

// Clear all time_events
router.delete('/admin/time-events/clear-all', async (req, res) => {
    try {
        console.log('Clearing all time_events...');
        
        await db.query('BEGIN');
        
        // Удаляем все записи из time_events
        const result = await db.query('DELETE FROM time_events');
        const deletedCount = result.rowCount || 0;
        
        await db.query('COMMIT');
        
        console.log(`Deleted ${deletedCount} records from time_events`);
        
        res.json({
            success: true,
            message: `Удалено ${deletedCount} записей из таблицы событий`,
            deletedCount: deletedCount
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error clearing time_events:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при очистке таблицы событий: ' + error.message
        });
    }
});

// Clear all time_records
router.delete('/admin/time-records/clear-all', async (req, res) => {
    try {
        console.log('Clearing all time_records...');
        
        await db.query('BEGIN');
        
        // Удаляем все записи из time_records
        const result = await db.query('DELETE FROM time_records');
        const deletedCount = result.rowCount || 0;
        
        await db.query('COMMIT');
        
        console.log(`Deleted ${deletedCount} records from time_records`);
        
        res.json({
            success: true,
            message: `Удалено ${deletedCount} записей из таблицы табеля`,
            deletedCount: deletedCount
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error clearing time_records:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при очистке таблицы табеля: ' + error.message
        });
    }
});

// ==================== REPORTS ENDPOINTS ====================

// Late employees report
router.get('/admin/reports/late-employees', async (req, res) => {
    try {
        const { date, organization, department } = req.query;
        
        // Если дата не указана, используем сегодняшнюю
        const reportDate = date || new Date().toISOString().split('T')[0];
        
        console.log('Getting late employees report for:', reportDate, 'org:', organization, 'dept:', department);

        // Строим SQL запрос с фильтрами
        let query = `
            SELECT DISTINCT
                e.full_name as employee_name,
                e.table_number,
                e.object_code,
                d.object_name as department_name,
                d.object_bin as organization,
                ws.schedule_name,
                ws.work_start_time as schedule_start_time,
                ws.work_end_time as schedule_end_time,
                te.event_datetime as actual_entry_time,
                esa.start_date,
                esa.end_date
            FROM employees e
            LEFT JOIN departments d ON e.object_code = d.object_code
            JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
            JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code AND ws.work_date = $1
            LEFT JOIN (
                SELECT DISTINCT ON (employee_number, DATE(event_datetime))
                    employee_number,
                    event_datetime,
                    DATE(event_datetime) as event_date
                FROM time_events 
                WHERE event_type = 'вход' 
                    AND DATE(event_datetime) = $1
                ORDER BY employee_number, DATE(event_datetime), event_datetime ASC
            ) te ON e.table_number = te.employee_number
            WHERE (esa.start_date <= $1)
                AND (esa.end_date IS NULL OR esa.end_date >= $1)
                AND ws.work_start_time IS NOT NULL
                AND ws.work_hours > 0
        `;

        const queryParams = [reportDate];
        let paramIndex = 2;

        // Добавляем фильтр по организации
        if (organization && organization.trim() !== '') {
            query += ` AND d.object_bin = $${paramIndex}`;
            queryParams.push(organization);
            paramIndex++;
        }

        // Добавляем фильтр по подразделению
        if (department && department.trim() !== '') {
            query += ` AND e.object_code = $${paramIndex}`;
            queryParams.push(department);
            paramIndex++;
        }

        query += ` ORDER BY e.full_name`;

        const result = await db.query(query, queryParams);
        
        // Обрабатываем результат для определения опозданий
        const lateEmployees = result.rows.map(row => {
            let status = 'on_time';
            let lateMinutes = 0;
            let actualEntryFormatted = 'Отсутствие';

            if (row.actual_entry_time) {
                const actualTime = new Date(row.actual_entry_time);
                const actualTimeStr = actualTime.toTimeString().substring(0, 5); // HH:MM
                actualEntryFormatted = actualTimeStr;

                // Сравниваем с графиком
                if (row.schedule_start_time) {
                    const scheduleTime = new Date(`1970-01-01T${row.schedule_start_time}`);
                    const actualTimeForComparison = new Date(`1970-01-01T${actualTimeStr}:00`);
                    
                    const diffMs = actualTimeForComparison.getTime() - scheduleTime.getTime();
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));

                    if (diffMinutes > 0) {
                        status = 'late';
                        lateMinutes = diffMinutes;
                    }
                }
            } else {
                status = 'absent';
            }

            return {
                employee_name: row.employee_name,
                table_number: row.table_number,
                department_name: row.department_name,
                organization: row.organization,
                schedule_name: row.schedule_name,
                schedule_start_time: row.schedule_start_time,
                actual_entry_time: actualEntryFormatted,
                status: status,
                late_minutes: lateMinutes,
                late_time_formatted: lateMinutes > 0 ? `${lateMinutes} мин` : '-'
            };
        });

        // Фильтруем только опоздавших и отсутствующих
        const filteredEmployees = lateEmployees.filter(emp => emp.status === 'late' || emp.status === 'absent');

        console.log(`Found ${filteredEmployees.length} late/absent employees`);

        res.json({
            success: true,
            data: filteredEmployees,
            report_date: reportDate,
            total_count: filteredEmployees.length
        });

    } catch (error) {
        console.error('Error getting late employees report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении отчета по опоздавшим: ' + error.message
        });
    }
});

// Get organizations for reports filter
router.get('/admin/reports/organizations', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT DISTINCT 
                object_bin as organization,
                object_company as company_name
            FROM departments 
            WHERE object_bin IS NOT NULL AND object_bin != ''
            ORDER BY object_company
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error getting organizations for reports:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении списка организаций: ' + error.message
        });
    }
});

// Get departments for reports filter (by organization)
router.get('/admin/reports/departments', async (req, res) => {
    try {
        const { organization } = req.query;
        
        let query = `
            SELECT object_code as id, object_name as name, object_bin as organization
            FROM departments 
            WHERE 1=1
        `;
        const queryParams = [];
        
        if (organization && organization.trim() !== '') {
            query += ` AND object_bin = $1`;
            queryParams.push(organization);
        }
        
        query += ` ORDER BY object_name`;
        
        const result = await db.query(query, queryParams);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error getting departments for reports:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при получении списка подразделений: ' + error.message
        });
    }
});

// ==================== 1C WORK SCHEDULES IMPORT ENDPOINT ====================

// ADVANCED HOURS CALCULATOR WITH SCHEDULE-BASED LOGIC
function calculateAdvancedHours(checkIn, checkOut, scheduleData, workDate) {
    if (!checkIn || !checkOut) {
        return {
            actual_hours: 0,
            planned_hours: 0,
            overtime_hours: 0,
            is_scheduled_workday: false,
            has_lunch_break: false
        };
    }
    
    const inTime = new Date(checkIn);
    let outTime = new Date(checkOut);
    
    // Get schedule information
    const startTime = scheduleData.work_start_time;
    const endTime = scheduleData.work_end_time;
    const plannedHours = parseFloat(scheduleData.work_hours) || 8;
    const scheduleName = scheduleData.schedule_name || '';
    
    // Check if this is a scheduled workday
    const isScheduledWorkday = !!scheduleData.schedule_name;
    
    // Determine if night shift
    const isNightShift = startTime && endTime && (
        startTime > endTime ||
        plannedHours > 12 ||
        (startTime >= "22:00" || startTime >= "23:00") ||
        (endTime <= "08:00" || endTime <= "06:00") ||
        scheduleName.toLowerCase().includes('ночная') ||
        scheduleName.includes('00:00')
    );
    
    // Handle night shift time calculation
    if (isNightShift && outTime <= inTime) {
        outTime.setDate(outTime.getDate() + 1);
        console.log(`🌙 Night shift: adjusted checkout to next day`);
    }
    
    // Calculate raw actual hours
    let actualHours = (outTime - inTime) / (1000 * 60 * 60);
    
    // Handle edge cases
    if (actualHours < 0) {
        actualHours = actualHours + 24;
    }
    if (actualHours > 16) {
        console.warn(`⚠️ Unusually long shift: ${actualHours.toFixed(2)}h`);
        actualHours = Math.min(actualHours, 16); // Cap at 16 hours
    }
    
    // Determine if lunch break should be deducted
    const hasLunchBreak = actualHours > 4 && !isNightShift;
    
    // Calculate final hours based on schedule logic
    let finalHours, overtimeHours = 0;
    
    if (isScheduledWorkday) {
        console.log(`📅 Scheduled workday: ${scheduleName} (${plannedHours}h planned)`);
        
        // Deduct lunch break if applicable
        let workingHours = actualHours;
        if (hasLunchBreak) {
            workingHours = Math.max(0, actualHours - 1); // Deduct 1 hour lunch
            console.log(`🍽️ Lunch break deducted: ${actualHours.toFixed(2)}h → ${workingHours.toFixed(2)}h`);
        }
        
        if (workingHours > plannedHours) {
            // Overtime: cap at planned hours, calculate overtime separately
            finalHours = plannedHours;
            overtimeHours = workingHours - plannedHours;
            console.log(`⏰ Overtime detected: ${plannedHours}h + ${overtimeHours.toFixed(2)}h overtime → capped at ${finalHours}h`);
        } else {
            // Within scheduled hours or early departure
            finalHours = workingHours;
            console.log(`✅ Within schedule: ${finalHours.toFixed(2)}h of ${plannedHours}h planned`);
        }
    } else {
        // No schedule: count actual hours
        console.log(`🚫 No schedule: counting actual hours`);
        finalHours = hasLunchBreak ? Math.max(0, actualHours - 1) : actualHours;
    }
    
    return {
        actual_hours: Math.max(0, actualHours),
        planned_hours: isScheduledWorkday ? plannedHours : 0,
        overtime_hours: Math.max(0, overtimeHours),
        is_scheduled_workday: isScheduledWorkday,
        has_lunch_break: hasLunchBreak,
        final_hours: Math.max(0, finalHours)
    };
}

// CHECK IF DATE IS SCHEDULED WORKDAY
async function isScheduledWorkday(employeeNumber, workDate) {
    try {
        // Check if the specific date exists in employee's work schedule
        const scheduleEntry = await db.queryRow(`
            SELECT 
                ws1c.work_date,
                ws1c.work_hours,
                ws1c.time_type,
                ws1c.schedule_name,
                ws1c.work_start_time,
                ws1c.work_end_time
            FROM employee_schedule_assignments esa
            JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
            WHERE esa.employee_number = $1 
            AND esa.end_date IS NULL
            AND ws1c.work_date = $2
            LIMIT 1
        `, [employeeNumber, workDate]);
        
        return scheduleEntry || null;
    } catch (error) {
        console.error('Error checking scheduled workday:', error);
        return null;
    }
}

// LEGACY FUNCTION - DEPRECATED BUT KEPT FOR COMPATIBILITY
function calculateShiftHours(checkIn, checkOut, scheduleData) {
    const result = calculateAdvancedHours(checkIn, checkOut, scheduleData, null);
    return result.final_hours;
}

// Enhanced status determination for night shifts
function determineShiftStatus(checkIn, checkOut, scheduleData) {
    const actualHours = calculateShiftHours(checkIn, checkOut, scheduleData);
    const expectedHours = parseInt(scheduleData.work_hours) || 8;
    const startTime = scheduleData.work_start_time;
    const endTime = scheduleData.work_end_time;
    
    // Check if employee worked without assigned schedule
    const offSchedule = !scheduleData.schedule_name;
    
    if (!checkIn) return 'absent';
    
    const inTime = new Date(checkIn);
    
    // Parse expected start time for comparison
    let expectedStart = new Date(inTime);
    if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number);
        expectedStart.setHours(hours, minutes, 0, 0);
        
        // For night shifts starting late (22:00+), adjust date if needed
        if (hours >= 22 && inTime.getHours() < 12) {
            expectedStart.setDate(expectedStart.getDate() - 1);
        }
    }
    
    // Calculate lateness in minutes
    const lateness = (inTime - expectedStart) / (1000 * 60);
    
    // Determine status
    if (lateness <= 5) return 'on_time';           // Within 5 minutes
    if (lateness <= 30) return 'late';             // Up to 30 minutes late
    if (actualHours < expectedHours * 0.8) return 'early_leave'; // Left significantly early
    
    return 'late';
}

// Function to extract work times from schedule name
function extractWorkTimesFromScheduleName(scheduleName) {
    if (!scheduleName) return { work_start_time: null, work_end_time: null };
    
    // Regex pattern for time format: HH:MM-HH:MM at the beginning of the name
    const timePattern = /^(\d{2}:\d{2})-(\d{2}:\d{2})/;
    const match = scheduleName.match(timePattern);
    
    if (match) {
        console.log(`Extracted times from "${scheduleName}": ${match[1]} - ${match[2]}`);
        return {
            work_start_time: match[1],
            work_end_time: match[2]
        };
    }
    
    console.log(`Could not extract times from "${scheduleName}"`);
    return { work_start_time: null, work_end_time: null };
}

// Import work schedules data from 1C
router.post('/admin/schedules/import-1c', largeJsonParser, async (req, res) => {
    try {
        const { ДатаВыгрузки, КоличествоГрафиков, Графики } = req.body;
        
        console.log('Received 1C schedules import request:', {
            exportDate: ДатаВыгрузки,
            schedulesCount: КоличествоГрафиков,
            schedulesReceived: Графики?.length || 0
        });
        
        // Log first schedule's organizations if available (support both field names)
        if (Графики && Графики.length > 0) {
            const firstScheduleOrgs = Графики[0].Организации || Графики[0].БИНОрганизации;
            const fieldName = Графики[0].Организации ? 'Организации' : Графики[0].БИНОрганизации ? 'БИНОрганизации' : 'none';
            if (firstScheduleOrgs) {
                console.error(`[STDERR] First schedule has organizations (field: ${fieldName}):`, firstScheduleOrgs);
            } else {
                console.error(`[STDERR] First schedule has NO organizations field or it's empty`);
            }
        }
        
        // Basic validation
        if (!Графики || !Array.isArray(Графики) || Графики.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных для импорта. Массив "Графики" отсутствует или пуст.'
            });
        }
        
        let totalProcessed = 0;
        let totalInserted = 0;
        let totalUpdated = 0;
        let errors = [];
        
        // Process each schedule
        for (const график of Графики) {
            // Get a client from the pool for this transaction
            const client = await db.pool.connect();
            
            try {
                const { НаименованиеГрафика, КодГрафика, РабочиеДни, Организации, БИНОрганизации } = график;

                // Support both field names: "Организации" and "БИНОрганизации"
                const организации = Организации || БИНОрганизации;

                // Log received data
                console.error(`[STDERR] Received schedule data:`, {
                    НаименованиеГрафика,
                    КодГрафика,
                    РабочиеДни: РабочиеДни?.length,
                    Организации: организации,
                    fieldUsed: Организации ? 'Организации' : БИНОрганизации ? 'БИНОрганизации' : 'none'
                });
                
                // Validate schedule data
                if (!НаименованиеГрафика || !КодГрафика || !РабочиеДни || !Array.isArray(РабочиеДни)) {
                    errors.push(`Неполные данные для графика: ${НаименованиеГрафика || КодГрафика || 'UNKNOWN'}`);
                    client.release();
                    continue;
                }
                
                console.log(`Processing schedule: ${НаименованиеГрафика} (${КодГрафика}) with ${РабочиеДни.length} work days`);
                console.error(`[STDERR] Processing schedule: ${НаименованиеГрафика}, Organizations:`, организации);

                // Start transaction for this schedule using the same client
                await client.query('BEGIN');

                // Validate and prepare organizations if provided (inside transaction)
                let validOrgBins = [];
                if (организации && Array.isArray(организации) && организации.length > 0) {
                    try {
                        debugLog(`Validating ${организации.length} organizations for schedule ${КодГрафика}`, организации);
                        // Check if all organization BINs exist in departments (inside transaction)
                        const placeholders = организации.map((_, i) => `$${i + 1}`).join(',');
                        const orgCheckResult = await client.query(
                            `SELECT DISTINCT object_bin FROM departments WHERE object_bin IN (${placeholders})`,
                            организации
                        );
                        debugLog(`Found ${orgCheckResult.rows.length} organizations in departments`);
                        const existingBins = new Set(orgCheckResult.rows.map(row => row.object_bin));
                        const invalidBins = организации.filter(bin => !existingBins.has(bin));

                        if (invalidBins.length > 0) {
                            errors.push(`Несуществующие БИНы организаций для графика ${НаименованиеГрафика}: ${invalidBins.join(', ')}`);
                            debugLog(`Invalid BINs`, invalidBins);
                        }

                        // Store valid BINs for later use in transaction
                        validOrgBins = Array.from(existingBins);
                        debugLog(`Valid organization BINs for ${КодГрафика}`, validOrgBins);
                    } catch (orgError) {
                        debugLog(`ERROR validating organizations`, { error: orgError.message, stack: orgError.stack });
                        errors.push(`Ошибка проверки организаций для графика ${НаименованиеГрафика}: ${orgError.message}`);
                    }
                } else {
                    debugLog(`No organizations provided for schedule ${КодГрафика}`);
                }
                
                // Delete existing records for this schedule code (replace existing data)
                const deleteResult = await client.query(
                    'DELETE FROM work_schedules_1c WHERE schedule_code = $1',
                    [КодГрафика]
                );
                
                const deletedCount = deleteResult.rowCount || 0;
                if (deletedCount > 0) {
                    console.log(`Deleted ${deletedCount} existing records for schedule ${КодГрафика}`);
                }
                
                // Delete existing organization links for this schedule
                await client.query(
                    'DELETE FROM schedule_organizations WHERE schedule_code = $1',
                    [КодГрафика]
                );
                
                // Insert organization links if we have valid organizations
                debugLog(`About to insert organizations for ${КодГрафика}`, { count: validOrgBins.length, bins: validOrgBins });
                if (validOrgBins.length > 0) {
                    debugLog(`Inserting ${validOrgBins.length} organization links for schedule ${КодГрафика}`, validOrgBins);
                    for (const orgBin of validOrgBins) {
                        try {
                            const insertResult = await client.query(
                                'INSERT INTO schedule_organizations (schedule_code, organization_bin) VALUES ($1, $2) ON CONFLICT (schedule_code, organization_bin) DO NOTHING RETURNING id',
                                [КодГрафика, orgBin]
                            );
                            if (insertResult.rows.length === 0) {
                                debugLog(`Organization ${orgBin} already linked (conflict)`);
                            } else {
                                debugLog(`Linked organization ${orgBin}`, { id: insertResult.rows[0].id });
                            }
                        } catch (insertError) {
                            debugLog(`ERROR inserting organization ${orgBin}`, { error: insertError.message, stack: insertError.stack });
                            throw insertError;
                        }
                    }
                    debugLog(`Linked schedule ${КодГрафика} to ${validOrgBins.length} organizations`);
                } else {
                    debugLog(`No valid organizations to link for schedule ${КодГрафика}`, { validOrgBins });
                }
                
                let scheduleInsertCount = 0;
                
                // Extract work times from schedule name (fallback if not provided by 1C)
                const extractedTimes = extractWorkTimesFromScheduleName(НаименованиеГрафика);
                
                // Insert new records for this schedule
                for (const рабочийДень of РабочиеДни) {
                    const { 
                        Дата, 
                        Месяц, 
                        ВидУчетаВремени, 
                        ДополнительноеЗначение,
                        ВремяНачалоРаботы,
                        ВремяЗавершениеРаботы 
                    } = рабочийДень;
                    
                    // Validate work day data
                    if (!Дата || !Месяц || !ВидУчетаВремени || ДополнительноеЗначение === undefined) {
                        errors.push(`Неполные данные для рабочего дня в графике ${НаименованиеГрафика}: ${JSON.stringify(рабочийДень)}`);
                        continue;
                    }
                    
                    // Use times from 1C if provided, otherwise use extracted times from schedule name
                    const finalStartTime = ВремяНачалоРаботы || extractedTimes.work_start_time;
                    const finalEndTime = ВремяЗавершениеРаботы || extractedTimes.work_end_time;
                    
                    // Insert work day record
                    await client.query(`
                        INSERT INTO work_schedules_1c 
                        (schedule_name, schedule_code, work_date, work_month, time_type, work_hours, work_start_time, work_end_time)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    `, [
                        НаименованиеГрафика,
                        КодГрафика,
                        Дата,              // work_date
                        Месяц,             // work_month
                        ВидУчетаВремени,   // time_type
                        ДополнительноеЗначение,  // work_hours
                        finalStartTime,    // work_start_time (from 1C or extracted)
                        finalEndTime       // work_end_time (from 1C or extracted)
                    ]);
                    
                    scheduleInsertCount++;
                }
                
                // Verify organizations were inserted before commit
                if (validOrgBins.length > 0) {
                    const verifyOrgs = await client.query(
                        'SELECT COUNT(*) as count FROM schedule_organizations WHERE schedule_code = $1',
                        [КодГрафика]
                    );
                    debugLog(`Organizations in DB before commit for ${КодГрафика}`, { count: verifyOrgs.rows[0].count, expected: validOrgBins.length });
                }

                debugLog(`Committing transaction for schedule ${КодГрафика}`);
                await client.query('COMMIT');
                debugLog(`Transaction committed for schedule ${КодГрафика}`);

                // Verify organizations after commit using a new connection
                if (validOrgBins.length > 0) {
                    const verifyAfterCommit = await db.pool.query(
                        'SELECT COUNT(*) as count FROM schedule_organizations WHERE schedule_code = $1',
                        [КодГрафика]
                    );
                    debugLog(`Organizations in DB after commit for ${КодГрафика}`, { count: verifyAfterCommit.rows[0].count, expected: validOrgBins.length });
                    if (verifyAfterCommit.rows[0].count === 0) {
                        debugLog(`ERROR: Organizations were not saved for ${КодГрафика}!`, { expected: validOrgBins.length, actual: 0 });
                    }
                }
                
                console.log(`Successfully processed schedule ${НаименованиеГрафика}: inserted ${scheduleInsertCount} work days`);
                totalProcessed++;
                totalInserted += scheduleInsertCount;
                if (deletedCount > 0) {
                    totalUpdated++;
                }
                
            } catch (scheduleError) {
                await client.query('ROLLBACK').catch(() => {}); // Ignore rollback errors
                const errorMsg = `Ошибка обработки графика ${график.НаименованиеГрафика || график.КодГрафика || 'UNKNOWN'}: ${scheduleError.message}`;
                console.error(errorMsg, scheduleError);
                console.error(`[ERROR] Stack:`, scheduleError.stack);
                errors.push(errorMsg);
            } finally {
                // Always release the client back to the pool
                client.release();
            }
        }
        
        const response = {
            success: true,
            message: `Импорт завершен успешно`,
            statistics: {
                totalSchedulesReceived: Графики.length,
                totalSchedulesProcessed: totalProcessed,
                totalSchedulesUpdated: totalUpdated,
                totalWorkDaysInserted: totalInserted,
                errorsCount: errors.length
            },
            exportDate: ДатаВыгрузки,
            errors: errors.length > 0 ? errors : undefined
        };
        
        console.log('1C import completed:', response.statistics);
        res.json(response);
        
    } catch (error) {
        console.error('Error importing 1C schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка импорта данных из 1С: ' + error.message
        });
    }
});

// Get work schedules from 1C with filters
router.get('/admin/schedules/1c', async (req, res) => {
    try {
        const { scheduleCode, scheduleName, dateFrom, dateTo, month } = req.query;
        
        // First, try a simple query without subqueries
        let query = `
            SELECT 
                ws.schedule_name,
                ws.schedule_code,
                ws.work_date,
                ws.work_month,
                ws.time_type,
                ws.work_hours,
                ws.work_start_time,
                ws.work_end_time,
                ws.created_at,
                ws.updated_at
            FROM work_schedules_1c ws
            WHERE 1=1
        `;
        
        const params = [];
        
        if (scheduleCode) {
            query += ` AND ws.schedule_code = $${params.length + 1}`;
            params.push(scheduleCode);
        }
        
        if (scheduleName) {
            query += ` AND ws.schedule_name ILIKE $${params.length + 1}`;
            params.push(`%${scheduleName}%`);
        }
        
        if (dateFrom) {
            query += ` AND ws.work_date >= $${params.length + 1}`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND ws.work_date <= $${params.length + 1}`;
            params.push(dateTo);
        }
        
        if (month) {
            query += ` AND ws.work_month = $${params.length + 1}`;
            params.push(month);
        }
        
        query += ` ORDER BY ws.schedule_name, ws.work_date LIMIT 1000`;
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const schedules = await db.queryRows(query, params);
        
        // Add organization info separately if we have schedules
        let organizations = [];
        if (schedules.length > 0 && scheduleCode) {
            try {
                // First, try to get organizations from schedule_organizations table
                organizations = await db.queryRows(`
                    SELECT DISTINCT
                        d.object_company as organization_name,
                        so.organization_bin
                    FROM schedule_organizations so
                    JOIN departments d ON so.organization_bin = d.object_bin
                    WHERE so.schedule_code = $1
                    ORDER BY d.object_company
                `, [scheduleCode]);
                
                // Fallback: if no organizations found in schedule_organizations, use old logic
                if (organizations.length === 0) {
                    organizations = await db.queryRows(`
                        SELECT DISTINCT
                            d.object_company as organization_name,
                            d.object_bin as organization_bin
                        FROM employee_schedule_assignments esa 
                        JOIN employees e ON esa.employee_id = e.id 
                        JOIN departments d ON e.object_code = d.object_code 
                        WHERE esa.schedule_code = $1 
                            AND d.object_bin IS NOT NULL
                            AND d.object_company IS NOT NULL
                        GROUP BY d.object_company, d.object_bin
                        ORDER BY COUNT(*) DESC, d.object_company
                    `, [scheduleCode]);
                }
                
                // Add organizations array to all schedule records (for backward compatibility, also add first org)
                schedules.forEach(schedule => {
                    schedule.organizations = organizations;
                    if (organizations.length > 0) {
                        schedule.organization_name = organizations[0].organization_name;
                        schedule.organization_bin = organizations[0].organization_bin;
                    } else {
                        schedule.organization_name = null;
                        schedule.organization_bin = null;
                    }
                });
            } catch (orgError) {
                console.error('Error getting organization info:', orgError);
                // Continue without organization info
                schedules.forEach(schedule => {
                    schedule.organizations = [];
                    schedule.organization_name = null;
                    schedule.organization_bin = null;
                });
            }
        } else {
            // If no scheduleCode, set empty organizations array
            schedules.forEach(schedule => {
                schedule.organizations = [];
                schedule.organization_name = null;
                schedule.organization_bin = null;
            });
        }
        
        // Get summary statistics - build a simplified stats query
        let statsQuery = `
            SELECT 
                COUNT(DISTINCT schedule_code) as total_schedules,
                COUNT(*) as total_work_days,
                MIN(work_date) as earliest_date,
                MAX(work_date) as latest_date,
                SUM(work_hours) as total_hours
            FROM work_schedules_1c
        `;
        
        // Build WHERE conditions for stats query (without subqueries)
        const statsParams = [];
        let whereConditions = [];
        
        if (scheduleCode) {
            whereConditions.push(`schedule_code = $${statsParams.length + 1}`);
            statsParams.push(scheduleCode);
        }
        
        if (scheduleName) {
            whereConditions.push(`schedule_name ILIKE $${statsParams.length + 1}`);
            statsParams.push(`%${scheduleName}%`);
        }
        
        if (dateFrom) {
            whereConditions.push(`work_date >= $${statsParams.length + 1}`);
            statsParams.push(dateFrom);
        }
        
        if (dateTo) {
            whereConditions.push(`work_date <= $${statsParams.length + 1}`);
            statsParams.push(dateTo);
        }
        
        if (month) {
            whereConditions.push(`work_month = $${statsParams.length + 1}`);
            statsParams.push(month);
        }
        
        if (whereConditions.length > 0) {
            statsQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        const stats = await db.queryRow(statsQuery, statsParams);
        
        res.json({
            schedules,
            statistics: stats,
            filters: { scheduleCode, scheduleName, dateFrom, dateTo, month }
        });
        
    } catch (error) {
        console.error('Error fetching 1C schedules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get unique schedule names and codes from 1C data
router.get('/admin/schedules/1c/list', async (req, res) => {
    try {
        const schedules = await db.queryRows(`
            SELECT
                ws.schedule_name,
                ws.schedule_code,
                COUNT(*) as work_days_count,
                MIN(ws.work_date) as start_date,
                MAX(ws.work_date) as end_date,
                AVG(ws.work_hours) as avg_hours,
                MAX(ws.created_at) as last_updated
            FROM work_schedules_1c ws
            GROUP BY ws.schedule_name, ws.schedule_code
            ORDER BY ws.schedule_name
        `);
        
        // Get organizations for each schedule
        const schedulesWithOrgs = await Promise.all(schedules.map(async (schedule) => {
            // First, try to get organizations from schedule_organizations table
            let organizations = await db.queryRows(`
                SELECT DISTINCT
                    d.object_company as organization_name,
                    so.organization_bin
                FROM schedule_organizations so
                JOIN departments d ON so.organization_bin = d.object_bin
                WHERE so.schedule_code = $1
                ORDER BY organization_name, organization_bin
            `, [schedule.schedule_code]);

            // Fallback: if no organizations found in schedule_organizations, use old logic
            if (organizations.length === 0) {
                organizations = await db.queryRows(`
                    SELECT
                        d.object_company as organization_name,
                        d.object_bin as organization_bin,
                        COUNT(*) as employee_count
                    FROM employee_schedule_assignments esa
                    JOIN employees e ON esa.employee_id = e.id
                    JOIN departments d ON e.object_code = d.object_code
                    WHERE esa.schedule_code = $1
                        AND d.object_bin IS NOT NULL
                        AND d.object_company IS NOT NULL
                    GROUP BY d.object_company, d.object_bin
                    ORDER BY employee_count DESC, organization_name
                `, [schedule.schedule_code]);
            }
            
            return {
                ...schedule,
                organizations: organizations
            };
        }));
        
        res.json(schedulesWithOrgs);
    } catch (error) {
        console.error('Error fetching 1C schedules list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ==================== EMPLOYEE SCHEDULE ASSIGNMENTS ====================

// Assign schedule to single employee
router.post('/admin/schedules/assign-employee', async (req, res) => {
    try {
        const { employee_number, schedule_code, start_date } = req.body;
        
        // Validate input
        if (!employee_number || !schedule_code || !start_date) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать табельный номер, код графика и дату начала'
            });
        }
        
        await db.query('BEGIN');
        
        try {
            // Check if employee exists
            const employee = await db.queryRow(
                'SELECT id, full_name FROM employees WHERE table_number = $1',
                [employee_number]
            );
            
            if (!employee) {
                await db.query('ROLLBACK');
                return res.json({
                    success: false,
                    error: 'Сотрудник не найден',
                    skipped: true
                });
            }
            
            // Check if schedule exists
            const schedule = await db.queryRow(
                'SELECT DISTINCT schedule_code, schedule_name FROM work_schedules_1c WHERE schedule_code = $1',
                [schedule_code]
            );
            
            if (!schedule) {
                await db.query('ROLLBACK');
                return res.json({
                    success: false,
                    error: 'График не найден',
                    skipped: true
                });
            }
            
            // Close any existing active schedule
            const existingSchedule = await db.queryRow(`
                SELECT id, schedule_code, start_date 
                FROM employee_schedule_assignments 
                WHERE employee_number = $1 AND end_date IS NULL
            `, [employee_number]);
            
            if (existingSchedule) {
                // Set end_date to day before new schedule starts
                const endDate = new Date(start_date);
                endDate.setDate(endDate.getDate() - 1);
                
                await db.query(`
                    UPDATE employee_schedule_assignments 
                    SET end_date = $1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `, [endDate.toISOString().split('T')[0], existingSchedule.id]);
            }
            
            // Create new assignment
            const newAssignment = await db.queryRow(`
                INSERT INTO employee_schedule_assignments 
                (employee_id, employee_number, schedule_code, start_date, assigned_by)
                VALUES ($1, $2, $3, $4, '1C')
                RETURNING *
            `, [employee.id, employee_number, schedule_code, start_date]);
            
            await db.query('COMMIT');
            
            res.json({
                success: true,
                message: 'График успешно назначен',
                assignment: {
                    id: newAssignment.id,
                    employee_number: employee_number,
                    employee_name: employee.full_name,
                    schedule_code: schedule_code,
                    schedule_name: schedule.schedule_name,
                    start_date: start_date,
                    previous_schedule_ended: !!existingSchedule
                }
            });
            
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error assigning schedule to employee:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка назначения графика: ' + error.message
        });
    }
});

// Batch assign schedules to multiple employees
router.post('/admin/schedules/assign-employees-batch', async (req, res) => {
    try {
        const { assignments } = req.body;
        
        if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо передать массив назначений'
            });
        }
        
        const results = {
            success: true,
            totalReceived: assignments.length,
            assigned: 0,
            skipped: 0,
            errors: [],
            assignments: []
        };
        
        for (const assignment of assignments) {
            const { employee_number, schedule_code, start_date } = assignment;
            
            if (!employee_number || !schedule_code || !start_date) {
                results.errors.push(`Неполные данные: ${JSON.stringify(assignment)}`);
                results.skipped++;
                continue;
            }
            
            try {
                await db.query('BEGIN');
                
                // Check employee
                const employee = await db.queryRow(
                    'SELECT id, full_name FROM employees WHERE table_number = $1',
                    [employee_number]
                );
                
                if (!employee) {
                    results.errors.push(`Сотрудник ${employee_number} не найден`);
                    results.skipped++;
                    await db.query('ROLLBACK');
                    continue;
                }
                
                // Check schedule
                const schedule = await db.queryRow(
                    'SELECT DISTINCT schedule_code, schedule_name FROM work_schedules_1c WHERE schedule_code = $1',
                    [schedule_code]
                );
                
                if (!schedule) {
                    results.errors.push(`График ${schedule_code} не найден`);
                    results.skipped++;
                    await db.query('ROLLBACK');
                    continue;
                }
                
                // Close existing active schedule
                const existingSchedule = await db.queryRow(`
                    SELECT id FROM employee_schedule_assignments 
                    WHERE employee_number = $1 AND end_date IS NULL
                `, [employee_number]);
                
                if (existingSchedule) {
                    const endDate = new Date(start_date);
                    endDate.setDate(endDate.getDate() - 1);
                    
                    await db.query(`
                        UPDATE employee_schedule_assignments 
                        SET end_date = $1, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2
                    `, [endDate.toISOString().split('T')[0], existingSchedule.id]);
                }
                
                // Create new assignment
                const newAssignment = await db.queryRow(`
                    INSERT INTO employee_schedule_assignments 
                    (employee_id, employee_number, schedule_code, start_date, assigned_by)
                    VALUES ($1, $2, $3, $4, '1C')
                    RETURNING id
                `, [employee.id, employee_number, schedule_code, start_date]);
                
                await db.query('COMMIT');
                
                results.assigned++;
                results.assignments.push({
                    employee_number,
                    employee_name: employee.full_name,
                    schedule_code,
                    schedule_name: schedule.schedule_name,
                    start_date
                });
                
            } catch (error) {
                await db.query('ROLLBACK');
                results.errors.push(`Ошибка для ${employee_number}: ${error.message}`);
                results.skipped++;
            }
        }
        
        res.json(results);
        
    } catch (error) {
        console.error('Error in batch schedule assignment:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка массового назначения графиков: ' + error.message
        });
    }
});

// Get current schedule for employee
router.get('/admin/employees/:employee_number/current-schedule', async (req, res) => {
    try {
        const { employee_number } = req.params;
        
        const currentSchedule = await db.queryRow(`
            SELECT 
                esa.id,
                esa.employee_number,
                e.full_name as employee_name,
                esa.schedule_code,
                ws.schedule_name,
                esa.start_date,
                esa.assigned_by,
                esa.created_at
            FROM employee_schedule_assignments esa
            LEFT JOIN employees e ON esa.employee_id = e.id
            LEFT JOIN (
                SELECT DISTINCT schedule_code, schedule_name 
                FROM work_schedules_1c
            ) ws ON esa.schedule_code = ws.schedule_code
            WHERE esa.employee_number = $1 AND esa.end_date IS NULL
        `, [employee_number]);
        
        if (!currentSchedule) {
            return res.json({
                success: false,
                message: 'У сотрудника нет активного графика'
            });
        }
        
        res.json({
            success: true,
            schedule: currentSchedule
        });
        
    } catch (error) {
        console.error('Error fetching current schedule:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get schedule history for employee
router.get('/admin/employees/:employee_number/schedule-history', async (req, res) => {
    try {
        const { employee_number } = req.params;
        
        const history = await db.queryRows(`
            SELECT 
                esa.id,
                esa.schedule_code,
                ws.schedule_name,
                esa.start_date,
                esa.end_date,
                esa.assigned_by,
                esa.created_at,
                CASE 
                    WHEN esa.end_date IS NULL THEN 'active'
                    ELSE 'ended'
                END as status
            FROM employee_schedule_assignments esa
            LEFT JOIN (
                SELECT DISTINCT schedule_code, schedule_name 
                FROM work_schedules_1c
            ) ws ON esa.schedule_code = ws.schedule_code
            WHERE esa.employee_number = $1
            ORDER BY esa.start_date DESC
        `, [employee_number]);
        
        res.json({
            success: true,
            employee_number,
            history
        });
        
    } catch (error) {
        console.error('Error fetching schedule history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update work times for all days in a schedule
router.put('/admin/schedules/1c/update-times', async (req, res) => {
    try {
        const { scheduleCode, startTime, endTime } = req.body;
        
        // Валидация входных данных
        if (!scheduleCode || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: 'Все поля обязательны: scheduleCode, startTime, endTime'
            });
        }
        
        // Проверяем существование графика
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM work_schedules_1c 
            WHERE schedule_code = $1
        `;
        const checkResult = await db.queryRows(checkQuery, [scheduleCode]);
        
        if (checkResult[0].count == 0) {
            return res.status(404).json({
                success: false,
                message: 'График с указанным кодом не найден'
            });
        }
        
        // Обновляем время только для записей, где поля времени пустые (NULL)
        const updateQuery = `
            UPDATE work_schedules_1c 
            SET 
                work_start_time = $2,
                work_end_time = $3
            WHERE schedule_code = $1 
            AND (work_start_time IS NULL OR work_end_time IS NULL)
        `;
        
        const result = await db.queryRows(updateQuery, [scheduleCode, startTime, endTime]);
        
        // Получаем количество обновленных записей
        const countQuery = `
            SELECT COUNT(*) as total_count,
                   COUNT(CASE WHEN work_start_time = $2 AND work_end_time = $3 THEN 1 END) as updated_count
            FROM work_schedules_1c 
            WHERE schedule_code = $1
        `;
        const countResult = await db.queryRows(countQuery, [scheduleCode, startTime, endTime]);
        
        res.json({
            success: true,
            message: 'Время успешно применено',
            updatedCount: countResult[0].updated_count,
            totalCount: countResult[0].total_count,
            scheduleCode: scheduleCode,
            appliedStartTime: startTime,
            appliedEndTime: endTime
        });
        
    } catch (error) {
        console.error('Error updating schedule times:', error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при обновлении времени',
            error: error.message
        });
    }
});

// Update employees IIN and payroll data from 1C
router.post('/admin/employees/update-iin', async (req, res) => {
    try {
        const employees = req.body;
        
        console.log('Received employee data update request for', employees?.length || 0, 'employees');
        
        // Validation
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Нет данных для обновления. Ожидается массив сотрудников.'
            });
        }
        
        let totalProcessed = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let errors = [];
        
        // Process each employee
        for (const employee of employees) {
            try {
                const { iin, table_number, payroll, full_name } = employee;
                
                // Validate employee data - require at least table_number and one of iin/payroll/full_name
                if (!table_number || (!iin && payroll === undefined && !full_name)) {
                    errors.push(`Неполные данные: табельный номер=${table_number}, ИИН=${iin}, ФОТ=${payroll}, ФИО=${full_name}`);
                    totalSkipped++;
                    continue;
                }
                
                // Validate IIN format if provided (12 digits)
                if (iin && !/^\d{12}$/.test(iin)) {
                    errors.push(`Неверный формат ИИН ${iin} для табельного номера ${table_number}. Ожидается 12 цифр.`);
                    totalSkipped++;
                    continue;
                }
                
                // Process and validate payroll format if provided
                let processedPayroll = payroll;
                if (payroll !== undefined) {
                    try {
                        // Handle payroll as string with spaces (from 1C)
                        if (typeof payroll === 'string') {
                            // Remove all types of spaces: regular space, non-breaking space, etc.
                            processedPayroll = payroll.replace(/\s/g, '').replace(/\u00A0/g, '');
                            
                            // If empty string after cleaning, treat as undefined
                            if (processedPayroll === '') {
                                processedPayroll = undefined;
                            }
                        }
                        
                        // Convert to number and validate
                        if (processedPayroll !== undefined) {
                            processedPayroll = parseFloat(processedPayroll);
                            
                            if (isNaN(processedPayroll) || processedPayroll < 0) {
                                errors.push(`Неверный формат ФОТ "${payroll}" для табельного номера ${table_number}. Ожидается положительное число.`);
                                totalSkipped++;
                                continue;
                            }
                        }
                    } catch (error) {
                        errors.push(`Ошибка обработки ФОТ "${payroll}" для табельного номера ${table_number}: ${error.message}`);
                        totalSkipped++;
                        continue;
                    }
                }
                
                console.log(`Processing employee: ${table_number}${iin ? ` with IIN: ${iin}` : ''}${processedPayroll !== undefined ? ` with payroll: ${processedPayroll} (original: "${payroll}")` : ''}${full_name ? ` with full_name: ${full_name}` : ''}`);
                
                // Check if employee exists
                const checkResult = await db.query(
                    'SELECT id, iin, payroll, full_name FROM employees WHERE table_number = $1',
                    [table_number]
                );
                
                if (checkResult.rows.length === 0) {
                    console.log(`Employee not found: ${table_number}`);
                    totalSkipped++;
                    continue;
                }
                
                const existingEmployee = checkResult.rows[0];
                
                // Prepare update fields and values
                let updateFields = [];
                let updateValues = [];
                let paramIndex = 1;
                let hasUpdates = false;
                
                // Handle IIN update
                if (iin) {
                    if (existingEmployee.iin === null || existingEmployee.iin === '') {
                        updateFields.push(`iin = $${paramIndex++}`);
                        updateValues.push(iin);
                        hasUpdates = true;
                        console.log(`  - Will update IIN: ${iin}`);
                    } else {
                        console.log(`  - Employee ${table_number} already has IIN: ${existingEmployee.iin}, skipping IIN update`);
                    }
                }
                
                // Handle payroll update (always update if provided)
                if (processedPayroll !== undefined) {
                    updateFields.push(`payroll = $${paramIndex++}`);
                    updateValues.push(processedPayroll);
                    hasUpdates = true;
                    console.log(`  - Will update payroll: ${processedPayroll} (original: "${payroll}", previous: ${existingEmployee.payroll})`);
                }
                
                // Handle full_name update (always update if provided)
                if (full_name) {
                    updateFields.push(`full_name = $${paramIndex++}`);
                    updateValues.push(full_name);
                    hasUpdates = true;
                    console.log(`  - Will update full_name: ${full_name} (previous: ${existingEmployee.full_name})`);
                }
                
                // Skip if no updates needed
                if (!hasUpdates) {
                    console.log(`  - No updates needed for employee ${table_number}`);
                    totalSkipped++;
                    continue;
                }
                
                // Add updated_at field
                updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
                updateValues.push(table_number); // WHERE clause parameter
                
                // Build and execute update query
                const updateQuery = `
                    UPDATE employees 
                    SET ${updateFields.join(', ')}
                    WHERE table_number = $${paramIndex}
                `;
                
                const updateResult = await db.query(updateQuery, updateValues);
                
                if (updateResult.rowCount > 0) {
                    console.log(`  ✅ Successfully updated employee: ${table_number}`);
                    totalUpdated++;
                } else {
                    console.log(`  ❌ No rows updated for employee: ${table_number}`);
                    totalSkipped++;
                }
                
                totalProcessed++;
                
            } catch (employeeError) {
                const errorMsg = `Ошибка обработки сотрудника ${employee.table_number || 'UNKNOWN'}: ${employeeError.message}`;
                console.error(errorMsg, employeeError);
                errors.push(errorMsg);
                totalSkipped++;
            }
        }
        
        const response = {
            success: true,
            message: `Статус ОК, обновлено ${totalUpdated} записей`,
            statistics: {
                totalReceived: employees.length,
                totalProcessed: totalProcessed,
                totalUpdated: totalUpdated,
                totalSkipped: totalSkipped,
                errorsCount: errors.length
            },
            errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit errors to first 10
        };
        
        console.log('Employee data update completed:', response.statistics);
        res.json(response);
        
    } catch (error) {
        console.error('Error updating employee data:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления данных сотрудников: ' + error.message
        });
    }
});

// Get payroll report
router.get('/admin/reports/payroll', async (req, res) => {
    try {
        const { organization, department, dateFrom, dateTo } = req.query;
        
        if (!dateFrom || !dateTo) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать даты начала и конца периода'
            });
        }
        
        console.log('Payroll report request:', { organization, department, dateFrom, dateTo });
        
        // Правильный запрос: получаем сотрудников с количеством смен в выбранном периоде
        let query = `
            WITH employee_shifts AS (
                SELECT 
                    e.table_number,
                    e.full_name,
                    e.payroll,
                    d.object_name as department_name,
                    d.object_company as organization_name,
                    ws1c.work_date,
                    ws1c.work_hours,
                    ws1c.schedule_name,
                    COUNT(*) OVER (PARTITION BY e.table_number) as shifts_count_in_period
                FROM employees e
                INNER JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
                INNER JOIN work_schedules_1c ws1c ON esa.schedule_code = ws1c.schedule_code
                LEFT JOIN departments d ON e.object_code = d.object_code
                WHERE e.status = 1 
                AND e.payroll IS NOT NULL
                AND ws1c.work_date >= $1::date
                AND ws1c.work_date <= $2::date
                AND esa.start_date <= ws1c.work_date
                AND (esa.end_date IS NULL OR esa.end_date >= ws1c.work_date)
        `;
        
        const params = [dateFrom, dateTo];
        
        // Add organization filter
        if (organization) {
            query += ` AND e.object_bin = $${params.length + 1}`;
            params.push(organization);
        }
        
        // Add department filter
        if (department) {
            query += ` AND e.object_code = $${params.length + 1}`;
            params.push(department);
        }
        
        query += `
            )
            SELECT 
                work_date,
                table_number,
                full_name,
                department_name,
                organization_name,
                payroll,
                shifts_count_in_period,
                schedule_name,
                work_hours,
                ROUND(payroll::decimal / shifts_count_in_period, 2) as daily_payroll
            FROM employee_shifts
            ORDER BY full_name, work_date
            LIMIT 10000
        `;
        
        const result = await db.query(query, params);
        console.log(`Payroll report: found ${result.rows.length} records`);
        
        // Calculate total
        const total = result.rows.reduce((sum, row) => sum + parseFloat(row.daily_payroll), 0);
        
        res.json({
            success: true,
            data: result.rows.map(row => ({
                work_date: row.work_date.toISOString().split('T')[0],
                full_name: row.full_name,
                table_number: row.table_number,
                department_name: row.department_name,
                organization_name: row.organization_name,
                payroll: parseFloat(row.payroll),
                shifts_count: parseInt(row.shifts_count_in_period),
                daily_payroll: parseFloat(row.daily_payroll),
                schedule_name: row.schedule_name,
                work_hours: parseInt(row.work_hours)
            })),
            summary: {
                total: total.toFixed(2),
                recordsCount: result.rows.length,
                dateFrom,
                dateTo,
                filters: {
                    organization: organization || 'Все',
                    department: department || 'Все'
                }
            }
        });
        
    } catch (error) {
        console.error('Error generating payroll report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

// Off-schedule attendance report (employees who came on their day off)
router.get('/admin/reports/off-schedule-attendance', async (req, res) => {
    try {
        const { date, organization } = req.query;

        // Default to today if no date provided
        const reportDate = date || new Date().toISOString().split('T')[0];

        console.log(`Off-schedule attendance report for date: ${reportDate}, organization: ${organization || 'all'}`);

        // SQL query to find employees who came to work on their day off
        // Logic: If work_date is NOT in work_schedules_1c = weekend (day off)
        let query = `
            SELECT
                to_char(te.event_datetime, 'YYYY-MM-DD') as date,
                e.full_name as employee_name,
                e.table_number as employee_number,
                d.object_company as organization_name,
                d.object_name as department_name,
                (SELECT DISTINCT schedule_name FROM work_schedules_1c WHERE schedule_code = esa.schedule_code LIMIT 1) as schedule_name,
                'Выходной' as schedule_type,
                TO_CHAR(MIN(te.event_datetime), 'HH24:MI:SS') as entry_time
            FROM time_events te
            JOIN employees e ON te.employee_number = e.table_number
            JOIN employee_schedule_assignments esa ON e.table_number = esa.employee_number
                AND $1::date BETWEEN esa.start_date AND COALESCE(esa.end_date, '9999-12-31'::date)
            LEFT JOIN departments d ON e.object_code = d.object_code
            WHERE
                te.event_type = '1'
                AND te.event_datetime::date = $1::date
                AND NOT EXISTS (
                    SELECT 1 FROM work_schedules_1c ws
                    WHERE ws.schedule_code = esa.schedule_code
                      AND ws.work_date = $1::date
                )
        `;

        const params = [reportDate];

        // Add organization filter if provided
        if (organization) {
            query += ` AND d.object_company = $${params.length + 1}`;
            params.push(organization);
        }

        query += `
            GROUP BY
                to_char(te.event_datetime, 'YYYY-MM-DD'),
                e.full_name,
                e.table_number,
                d.object_company,
                d.object_name,
                esa.schedule_code
            ORDER BY entry_time, e.full_name
        `;

        console.log('DEBUG SQL:', query);
        console.log('DEBUG PARAMS:', params);

        const result = await db.query(query, params);

        console.log(`Off-schedule attendance report: found ${result.rows.length} records`);
        if (result.rows.length > 0) {
            console.log('DEBUG FIRST ROW:', result.rows[0]);
        }

        res.json({
            success: true,
            date: reportDate,
            totalCount: result.rows.length,
            records: result.rows.map(row => ({
                date: row.date, // Already formatted as YYYY-MM-DD by to_char
                employeeName: row.employee_name,
                employeeNumber: row.employee_number,
                organizationName: row.organization_name || 'Не указана',
                departmentName: row.department_name || 'Не указано',
                scheduleName: row.schedule_name || 'Не указан',
                scheduleType: row.schedule_type,
                entryTime: row.entry_time
            }))
        });

    } catch (error) {
        console.error('Error generating off-schedule attendance report:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

// Get department by ID or id_iiko
router.get('/admin/departments/:id', async (req, res) => {
    try {
        const identifier = req.params.id;
        
        console.log(`Getting department with identifier: ${identifier}`);
        
        // Check if the identifier is a UUID (id_iiko format)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
        
        let query;
        let queryParam;
        
        if (isUUID) {
            // Search by id_iiko
            console.log('Searching by id_iiko (UUID format)');
            query = `
                SELECT 
                    id,
                    id_iiko::text as id_iiko,
                    object_name,
                    object_code,
                    object_parent,
                    object_company,
                    object_bin,
                    hall_area,
                    kitchen_area,
                    seats_count,
                    trade_point
                FROM departments 
                WHERE id_iiko = $1
            `;
            queryParam = identifier;
        } else {
            // Search by numeric ID
            console.log('Searching by numeric ID');
            query = `
                SELECT 
                    id,
                    id_iiko::text as id_iiko,
                    object_name,
                    object_code,
                    object_parent,
                    object_company,
                    object_bin,
                    hall_area,
                    kitchen_area,
                    seats_count,
                    trade_point
                FROM departments 
                WHERE id = $1
            `;
            queryParam = identifier;
        }
        
        const rows = await db.queryRows(query, [queryParam]);
        
        if (rows.length === 0) {
            const identifierType = isUUID ? 'id_iiko' : 'ID';
            return res.status(404).json({ 
                error: 'Department not found',
                message: `Подразделение с ${identifierType} ${identifier} не найдено`
            });
        }
        
        console.log('Department found:', rows[0]);
        
        // Return the department data
        res.json(rows[0]);
        
    } catch (err) {
        console.error('Error fetching department:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            message: 'Ошибка при получении данных подразделения'
        });
    }
});

// Update department
router.put('/admin/departments/:id', async (req, res) => {
    try {
        const departmentId = req.params.id;
        const { id_iiko, hall_area, kitchen_area, seats_count, trade_point } = req.body;
        
        console.log(`Updating department ${departmentId} with data:`, { id_iiko, hall_area, kitchen_area, seats_count, trade_point });
        
        // Validate input
        if (!departmentId || isNaN(departmentId)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный ID подразделения'
            });
        }
        
        // Check if department exists
        const existingDept = await db.queryRow(
            'SELECT * FROM departments WHERE id = $1',
            [departmentId]
        );
        
        if (!existingDept) {
            return res.status(404).json({
                success: false,
                error: 'Подразделение не найдено'
            });
        }
        
        // Validate UUID format if id_iiko is provided
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (id_iiko && id_iiko.trim() !== '' && !uuidRegex.test(id_iiko)) {
            return res.status(400).json({
                success: false,
                error: 'Некорректный формат UUID для ID IIKO. Ожидается формат: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
            });
        }
        
        // Validate area fields (must be positive numbers if provided)
        if (hall_area !== undefined && hall_area !== null && hall_area !== '') {
            const hallAreaNum = parseFloat(hall_area);
            if (isNaN(hallAreaNum) || hallAreaNum <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Площадь зала должна быть положительным числом'
                });
            }
        }
        
        if (kitchen_area !== undefined && kitchen_area !== null && kitchen_area !== '') {
            const kitchenAreaNum = parseFloat(kitchen_area);
            if (isNaN(kitchenAreaNum) || kitchenAreaNum <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Площадь кухни должна быть положительным числом'
                });
            }
        }
        
        // Validate seats_count (must be non-negative integer if provided)
        if (seats_count !== undefined && seats_count !== null && seats_count !== '') {
            const seatsNum = parseInt(seats_count);
            if (isNaN(seatsNum) || seatsNum < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Количество посадочных мест должно быть неотрицательным целым числом'
                });
            }
        }
        
        // Prepare update data
        const updateIdIiko = id_iiko && id_iiko.trim() !== '' ? id_iiko.trim() : null;
        const updateHallArea = hall_area && hall_area !== '' ? parseFloat(hall_area) : null;
        const updateKitchenArea = kitchen_area && kitchen_area !== '' ? parseFloat(kitchen_area) : null;
        const updateSeatsCount = seats_count && seats_count !== '' ? parseInt(seats_count) : null;
        const updateTradePoint = trade_point !== undefined ? trade_point : null;
        
        // Update department
        const updateResult = await db.query(
            'UPDATE departments SET id_iiko = $1, hall_area = $2, kitchen_area = $3, seats_count = $4, trade_point = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
            [updateIdIiko, updateHallArea, updateKitchenArea, updateSeatsCount, updateTradePoint, departmentId]
        );
        
        if (updateResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: 'Не удалось обновить подразделение'
            });
        }
        
        // Get updated department data
        const updatedDept = await db.queryRow(
            'SELECT *, id_iiko::text as id_iiko FROM departments WHERE id = $1',
            [departmentId]
        );
        
        console.log(`✅ Successfully updated department ${departmentId}`);
        
        res.json({
            success: true,
            message: 'Подразделение успешно обновлено',
            data: updatedDept
        });
        
    } catch (error) {
        console.error('Error updating department:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера при обновлении подразделения'
        });
    }
});

// Get payroll attendance report - detailed shifts with payroll calculation
router.get('/admin/payroll/attendance', async (req, res) => {
    try {
        const { department_id, from_date, to_date } = req.query;
        
        // Validate required parameters
        if (!department_id || !from_date || !to_date) {
            return res.status(400).json({
                success: false,
                error: 'Необходимо указать department_id, from_date и to_date'
            });
        }
        
        // Validate UUID format for department_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(department_id)) {
            return res.status(400).json({
                success: false,
                error: 'department_id должен быть в формате UUID'
            });
        }
        
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(from_date) || !dateRegex.test(to_date)) {
            return res.status(400).json({
                success: false,
                error: 'Даты должны быть в формате YYYY-MM-DD'
            });
        }
        
        // Validate date range
        const fromDate = new Date(from_date);
        const toDate = new Date(to_date);
        if (fromDate > toDate) {
            return res.status(400).json({
                success: false,
                error: 'from_date не может быть позже to_date'
            });
        }
        
        console.log('Payroll attendance request:', { department_id, from_date, to_date });
        
        // Get all employees for the department with their shifts
        const query = `
            WITH department_employees AS (
                -- Get employees for the department by id_iiko
                SELECT DISTINCT
                    e.id as employee_id,
                    e.table_number,
                    e.full_name,
                    e.payroll,
                    e.object_code
                FROM employees e
                INNER JOIN departments d ON e.object_code = d.object_code
                WHERE d.id_iiko = $1::uuid
                AND e.status = 1
                AND e.payroll IS NOT NULL
                AND e.payroll > 0
            ),
            employee_shifts AS (
                -- Get all shifts for these employees in the period
                SELECT 
                    de.employee_id,
                    de.table_number,
                    de.full_name,
                    de.payroll,
                    ws.work_date,
                    ws.schedule_name,
                    ws.work_hours
                FROM department_employees de
                INNER JOIN employee_schedule_assignments esa ON de.table_number = esa.employee_number
                INNER JOIN work_schedules_1c ws ON esa.schedule_code = ws.schedule_code
                WHERE ws.work_date >= $2::date
                AND ws.work_date <= $3::date
                AND esa.start_date <= ws.work_date
                AND (esa.end_date IS NULL OR esa.end_date >= ws.work_date)
                AND ws.time_type != 'В' -- Exclude weekends/holidays
                ORDER BY de.full_name, ws.work_date
            ),
            employee_shift_counts AS (
                -- Count shifts per employee
                SELECT 
                    employee_id,
                    COUNT(*) as shift_count
                FROM employee_shifts
                GROUP BY employee_id
            )
            SELECT 
                es.employee_id::text,
                es.table_number,
                es.full_name,
                es.payroll,
                es.work_date,
                es.schedule_name,
                es.work_hours,
                esc.shift_count
            FROM employee_shifts es
            INNER JOIN employee_shift_counts esc ON es.employee_id = esc.employee_id
            ORDER BY es.full_name, es.work_date
        `;
        
        const result = await db.query(query, [department_id, from_date, to_date]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: [],
                summary: {
                    department_id,
                    from_date,
                    to_date,
                    total_employees: 0,
                    total_shifts: 0,
                    total_payroll: 0
                }
            });
        }
        
        // Group results by employee
        const employeesMap = new Map();
        
        result.rows.forEach(row => {
            const employeeId = row.employee_id;
            const payrollTotal = parseFloat(row.payroll);
            const shiftCount = parseInt(row.shift_count);
            const payrollPerShift = Math.round(payrollTotal / shiftCount * 100) / 100;
            
            if (!employeesMap.has(employeeId)) {
                employeesMap.set(employeeId, {
                    employee_id: employeeId,
                    employee_name: row.full_name,
                    table_number: row.table_number,
                    payroll_total: payrollTotal,
                    shifts: []
                });
            }
            
            employeesMap.get(employeeId).shifts.push({
                date: row.work_date.toISOString().split('T')[0],
                payroll_for_shift: payrollPerShift,
                schedule_name: row.schedule_name,
                work_hours: parseInt(row.work_hours)
            });
        });
        
        // Convert map to array
        const employeesData = Array.from(employeesMap.values());
        
        // Calculate summary
        const totalShifts = result.rows.length;
        const totalPayroll = employeesData.reduce((sum, emp) => {
            return sum + emp.shifts.reduce((shiftSum, shift) => shiftSum + shift.payroll_for_shift, 0);
        }, 0);
        
        res.json({
            success: true,
            data: employeesData,
            summary: {
                department_id,
                from_date,
                to_date,
                total_employees: employeesData.length,
                total_shifts: totalShifts,
                total_payroll: Math.round(totalPayroll * 100) / 100
            }
        });
        
    } catch (error) {
        console.error('Error in payroll attendance endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при формировании отчета: ' + error.message
        });
    }
});

module.exports = router;