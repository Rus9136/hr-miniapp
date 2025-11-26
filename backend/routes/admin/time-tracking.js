/**
 * Модуль учёта рабочего времени
 * Эндпоинты: /admin/time-events, /admin/time-records, /admin/load/timesheet
 */

const express = require('express');
const router = express.Router();
const db = require('../../database_pg');
const apiSync = require('../../utils/apiSync_pg');
const { 
    isScheduledWorkday, 
    calculateAdvancedHours, 
    determineShiftStatus 
} = require('./helpers');

/**
 * Фоновая загрузка табеля с обновлением прогресса
 * @param {string} loadingId - ID процесса загрузки
 * @param {Object} params - Параметры загрузки
 */
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

/**
 * GET /admin/time-events
 * Получение событий времени с фильтрами
 */
router.get('/events', (req, res) => {
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
            d.object_code as department_code,
            p.staff_position_name as position_name
        FROM time_events te
        LEFT JOIN employees e ON te.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
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

    if (req.query.eventType) {
        query += ` AND te.event_type = $${params.length + 1}`;
        params.push(req.query.eventType);
    }

    query += ` ORDER BY event_datetime_sort DESC LIMIT 1000`;
    
    db.queryRows(query, params).then(rows => {
        res.json(rows);
    }).catch(err => {
        console.error('Error fetching time events:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

/**
 * DELETE /admin/time-events/clear-all
 * Очистка всех событий времени
 */
router.delete('/events/clear-all', async (req, res) => {
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

/**
 * GET /admin/time-records
 * Получение записей времени с фильтрами
 */
router.get('/records', (req, res) => {
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

/**
 * DELETE /admin/time-records/clear-all
 * Очистка всех записей времени
 */
router.delete('/records/clear-all', async (req, res) => {
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

/**
 * POST /admin/load/timesheet
 * Загрузка событий времени из внешнего API с отслеживанием прогресса
 */
router.post('/load/timesheet', async (req, res) => {
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

/**
 * GET /admin/load/progress/:id
 * Получение прогресса загрузки
 */
router.get('/load/progress/:id', (req, res) => {
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

/**
 * POST /admin/recalculate-time-records
 * Пересчёт записей времени из событий
 */
router.post('/recalculate', async (req, res) => {
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

module.exports = router;



