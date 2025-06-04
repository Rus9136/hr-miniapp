const express = require('express');
const router = express.Router();
const db = require('../database_pg');
const apiSync = require('../utils/apiSync_pg');

// Get all employees with department and position info
router.get('/admin/employees', (req, res) => {
    const query = `
        SELECT 
            e.*,
            d.object_name as department_name,
            p.staff_position_name as position_name,
            e.object_bin
        FROM employees e
        LEFT JOIN departments d ON e.object_code = d.object_code
        LEFT JOIN positions p ON e.staff_position_code = p.staff_position_code
        ORDER BY e.full_name
    `;

    db.queryRows(query).then(rows => {
        res.json(rows);
    }).catch(err => {
        console.error('Error fetching employees:', err);
        res.status(500).json({ error: 'Internal server error' });
    });
});

// Get all departments
router.get('/admin/departments', async (req, res) => {
    try {
        const rows = await db.queryRows('SELECT * FROM departments ORDER BY object_name');
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
        
        // Store progress state
        if (!global.loadingProgress) {
            global.loadingProgress = {};
        }
        
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
        const events = await apiSync.loadTimeEventsWithProgress(params, updateProgress);

        updateProgress({
            status: 'processing',
            message: 'Обработка и сохранение записей...'
        });

        // Обработка и сохранение событий
        const processed = await apiSync.processTimeRecords(events);
        
        updateProgress({
            status: 'completed',
            message: `Загрузка завершена! Загружено ${events.length} событий, обработано ${processed} записей`,
            eventsLoaded: events.length,
            recordsProcessed: processed,
            endTime: new Date()
        });
        
        // Clean up after 5 minutes
        setTimeout(() => {
            delete global.loadingProgress[loadingId];
        }, 5 * 60 * 1000);
        
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
            te.*,
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
    
    query += ` ORDER BY te.event_datetime DESC LIMIT 1000`;
    
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
router.post('/admin/recalculate-time-records', async (req, res) => {
    try {
        console.log('Starting time records recalculation...');
        
        // Clear existing time_records
        await db.query('DELETE FROM time_records');
        
        // Get all time events grouped by employee and date
        const timeEvents = await db.queryRows(`
            SELECT 
                te.employee_number,
                to_char(te.event_datetime::date, 'YYYY-MM-DD') as date,
                te.event_datetime,
                te.event_type,
                e.id as employee_id
            FROM time_events te
            LEFT JOIN employees e ON te.employee_number = e.table_number
            WHERE te.employee_number IS NOT NULL
            ORDER BY te.employee_number, te.event_datetime
        `);
        
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
            
            // Определяем вход и выход по времени события
            // Если есть события с типами 1 и 2, используем их
            // Иначе используем первое событие как вход, последнее как выход (для типа 0)
            let checkIn = null;
            let checkOut = null;
            
            const entryEvents = events.filter(e => e.event_type === '1');
            const exitEvents = events.filter(e => e.event_type === '2');
            
            if (entryEvents.length > 0 || exitEvents.length > 0) {
                // Используем типы 1 и 2 если они есть
                checkIn = entryEvents.length > 0 ? entryEvents[0].event_datetime : null;
                checkOut = exitEvents.length > 0 ? exitEvents[exitEvents.length - 1].event_datetime : null;
            } else if (events.length > 0) {
                // Для событий типа 0 определяем по времени
                // Первое событие дня - вход, последнее - выход
                if (events.length === 1) {
                    // Если только одно событие, проверяем время
                    const hour = new Date(events[0].event_datetime).getHours();
                    if (hour < 12) {
                        checkIn = events[0].event_datetime;
                    } else {
                        checkOut = events[0].event_datetime;
                    }
                } else {
                    // Если несколько событий, первое - вход, последнее - выход
                    checkIn = events[0].event_datetime;
                    checkOut = events[events.length - 1].event_datetime;
                }
            }
            
            // Calculate hours worked
            let hoursWorked = null;
            if (checkIn && checkOut) {
                const inTime = new Date(checkIn);
                const outTime = new Date(checkOut);
                hoursWorked = (outTime - inTime) / (1000 * 60 * 60); // Convert to hours
            }
            
            // Determine status
            let status = 'absent';
            if (checkIn) {
                const inTime = new Date(checkIn);
                const inHour = inTime.getHours();
                const inMinute = inTime.getMinutes();
                
                if (inHour < 9 || (inHour === 9 && inMinute === 0)) {
                    status = 'on_time';
                } else {
                    status = 'late';
                }
                
                // Check for early departure
                if (checkOut) {
                    const outTime = new Date(checkOut);
                    const outHour = outTime.getHours();
                    if (outHour < 18) {
                        status = 'early_leave';
                    }
                }
            }
            
            await db.query(`
                INSERT INTO time_records 
                (employee_id, employee_number, date, check_in, check_out, hours_worked, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                ON CONFLICT (employee_number, date) DO UPDATE SET
                    check_in = EXCLUDED.check_in,
                    check_out = EXCLUDED.check_out,
                    hours_worked = EXCLUDED.hours_worked,
                    status = EXCLUDED.status,
                    updated_at = NOW()
            `, [
                dayData.employee_id,
                dayData.employee_number,
                dayData.date,
                checkIn,
                checkOut,
                hoursWorked,
                status
            ]);
            
            processedCount++;
        }
        
        console.log(`Recalculation completed. Processed ${processedCount} records`);
        
        res.json({
            success: true,
            message: `Пересчет завершен успешно`,
            processedRecords: processedCount,
            totalEvents: timeEvents.length
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

// ==================== 1C WORK SCHEDULES IMPORT ENDPOINT ====================

// Import work schedules data from 1C
router.post('/admin/schedules/import-1c', async (req, res) => {
    try {
        const { ДатаВыгрузки, КоличествоГрафиков, Графики } = req.body;
        
        console.log('Received 1C schedules import request:', {
            exportDate: ДатаВыгрузки,
            schedulesCount: КоличествоГрафиков,
            schedulesReceived: Графики?.length || 0
        });
        
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
            try {
                const { НаименованиеГрафика, КодГрафика, РабочиеДни } = график;
                
                // Validate schedule data
                if (!НаименованиеГрафика || !КодГрафика || !РабочиеДни || !Array.isArray(РабочиеДни)) {
                    errors.push(`Неполные данные для графика: ${НаименованиеГрафика || КодГрафика || 'UNKNOWN'}`);
                    continue;
                }
                
                console.log(`Processing schedule: ${НаименованиеГрафика} (${КодГрафика}) with ${РабочиеДни.length} work days`);
                
                // Start transaction for this schedule
                await db.query('BEGIN');
                
                // Delete existing records for this schedule code (replace existing data)
                const deleteResult = await db.query(
                    'DELETE FROM work_schedules_1c WHERE schedule_code = $1',
                    [КодГрафика]
                );
                
                const deletedCount = deleteResult.rowCount || 0;
                if (deletedCount > 0) {
                    console.log(`Deleted ${deletedCount} existing records for schedule ${КодГрафика}`);
                }
                
                let scheduleInsertCount = 0;
                
                // Insert new records for this schedule
                for (const рабочийДень of РабочиеДни) {
                    const { Дата, Месяц, ВидУчетаВремени, ДополнительноеЗначение } = рабочийДень;
                    
                    // Validate work day data
                    if (!Дата || !Месяц || !ВидУчетаВремени || ДополнительноеЗначение === undefined) {
                        errors.push(`Неполные данные для рабочего дня в графике ${НаименованиеГрафика}: ${JSON.stringify(рабочийДень)}`);
                        continue;
                    }
                    
                    // Insert work day record
                    await db.query(`
                        INSERT INTO work_schedules_1c 
                        (schedule_name, schedule_code, work_date, work_month, time_type, work_hours)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        НаименованиеГрафика,
                        КодГрафика,
                        Дата,              // work_date
                        Месяц,             // work_month
                        ВидУчетаВремени,   // time_type
                        ДополнительноеЗначение  // work_hours
                    ]);
                    
                    scheduleInsertCount++;
                }
                
                await db.query('COMMIT');
                
                console.log(`Successfully processed schedule ${НаименованиеГрафика}: inserted ${scheduleInsertCount} work days`);
                totalProcessed++;
                totalInserted += scheduleInsertCount;
                if (deletedCount > 0) {
                    totalUpdated++;
                }
                
            } catch (scheduleError) {
                await db.query('ROLLBACK');
                const errorMsg = `Ошибка обработки графика ${график.НаименованиеГрафика || график.КодГрафика || 'UNKNOWN'}: ${scheduleError.message}`;
                console.error(errorMsg, scheduleError);
                errors.push(errorMsg);
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
        
        let query = `
            SELECT 
                schedule_name,
                schedule_code,
                work_date,
                work_month,
                time_type,
                work_hours,
                created_at,
                updated_at
            FROM work_schedules_1c
            WHERE 1=1
        `;
        
        const params = [];
        
        if (scheduleCode) {
            query += ` AND schedule_code = $${params.length + 1}`;
            params.push(scheduleCode);
        }
        
        if (scheduleName) {
            query += ` AND schedule_name ILIKE $${params.length + 1}`;
            params.push(`%${scheduleName}%`);
        }
        
        if (dateFrom) {
            query += ` AND work_date >= $${params.length + 1}`;
            params.push(dateFrom);
        }
        
        if (dateTo) {
            query += ` AND work_date <= $${params.length + 1}`;
            params.push(dateTo);
        }
        
        if (month) {
            query += ` AND work_month = $${params.length + 1}`;
            params.push(month);
        }
        
        query += ` ORDER BY schedule_name, work_date LIMIT 1000`;
        
        const schedules = await db.queryRows(query, params);
        
        // Get summary statistics
        const statsQuery = `
            SELECT 
                COUNT(DISTINCT schedule_code) as total_schedules,
                COUNT(*) as total_work_days,
                MIN(work_date) as earliest_date,
                MAX(work_date) as latest_date,
                SUM(work_hours) as total_hours
            FROM work_schedules_1c
            ${params.length > 0 ? 'WHERE ' + query.split('WHERE ')[1].split(' ORDER BY')[0] : ''}
        `;
        
        const stats = await db.queryRow(statsQuery, params);
        
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
            SELECT DISTINCT 
                schedule_name,
                schedule_code,
                COUNT(*) as work_days_count,
                MIN(work_date) as start_date,
                MAX(work_date) as end_date,
                AVG(work_hours) as avg_hours,
                MAX(created_at) as last_updated
            FROM work_schedules_1c
            GROUP BY schedule_name, schedule_code
            ORDER BY schedule_name
        `);
        
        res.json(schedules);
    } catch (error) {
        console.error('Error fetching 1C schedules list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;