const express = require('express');
const router = express.Router();
const db = require('../database_pg');
const apiSync = require('../utils/apiSync');

// Get all employees with department and position info
router.get('/admin/employees', (req, res) => {
    const query = `
        SELECT 
            e.*,
            d.object_name as department_name,
            p.staff_position_name as position_name
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
router.get('/admin/departments', (req, res) => {
    db.all(
        'SELECT * FROM departments ORDER BY object_name',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching departments:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
});

// Get all positions
router.get('/admin/positions', (req, res) => {
    db.all(
        'SELECT * FROM positions ORDER BY staff_position_name',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching positions:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
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
router.get('/admin/organizations', (req, res) => {
    db.all(
        'SELECT DISTINCT object_bin, object_company FROM departments WHERE object_company IS NOT NULL ORDER BY object_company',
        [],
        (err, rows) => {
            if (err) {
                console.error('Error fetching organizations:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
            res.json(rows);
        }
    );
});

// Get time events with filters
router.get('/admin/time-events', (req, res) => {
    const { employee, dateFrom, dateTo } = req.query;
    
    let query = `
        SELECT 
            te.*,
            e.full_name,
            e.table_number,
            d.object_name as department_name
        FROM time_events te
        LEFT JOIN employees e ON te.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        WHERE 1=1
    `;
    
    const params = [];
    
    if (employee) {
        query += ` AND (e.table_number LIKE ? OR e.full_name LIKE ?)`;
        params.push(`%${employee}%`, `%${employee}%`);
    }
    
    if (dateFrom) {
        query += ` AND date(te.event_datetime) >= ?`;
        params.push(dateFrom);
    }
    
    if (dateTo) {
        query += ` AND date(te.event_datetime) <= ?`;
        params.push(dateTo);
    }
    
    query += ` ORDER BY te.event_datetime DESC LIMIT 1000`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching time events:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(rows);
    });
});

// Get time records with filters
router.get('/admin/time-records', (req, res) => {
    const { employee, month, status } = req.query;
    
    let query = `
        SELECT 
            tr.*,
            e.full_name,
            e.table_number,
            d.object_name as department_name
        FROM time_records tr
        LEFT JOIN employees e ON tr.employee_number = e.table_number
        LEFT JOIN departments d ON e.object_code = d.object_code
        WHERE 1=1
    `;
    
    const params = [];
    
    if (employee) {
        query += ` AND (e.table_number LIKE ? OR e.full_name LIKE ?)`;
        params.push(`%${employee}%`, `%${employee}%`);
    }
    
    if (month) {
        query += ` AND strftime('%Y-%m', tr.date) = ?`;
        params.push(month);
    }
    
    if (status) {
        query += ` AND tr.status = ?`;
        params.push(status);
    }
    
    query += ` ORDER BY tr.date DESC, e.full_name ASC LIMIT 1000`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching time records:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(rows);
    });
});

// Recalculate time records from time_events
router.post('/admin/recalculate-time-records', async (req, res) => {
    try {
        console.log('Starting time records recalculation...');
        
        // Clear existing time_records
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM time_records', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        // Get all time events grouped by employee and date
        const timeEvents = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    te.employee_number,
                    date(te.event_datetime) as date,
                    te.event_datetime,
                    te.event_type,
                    e.id as employee_id
                FROM time_events te
                LEFT JOIN employees e ON te.employee_number = e.table_number
                WHERE te.employee_number IS NOT NULL
                ORDER BY te.employee_number, te.event_datetime
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
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
        
        // Process each employee-day combination
        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO time_records 
            (employee_id, employee_number, date, check_in, check_out, hours_worked, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        
        let processedCount = 0;
        
        for (const key in groupedEvents) {
            const dayData = groupedEvents[key];
            const events = dayData.events.sort((a, b) => new Date(a.event_datetime) - new Date(b.event_datetime));
            
            // Find first entry (type 1) and last exit (type 2)
            const entryEvents = events.filter(e => e.event_type === '1');
            const exitEvents = events.filter(e => e.event_type === '2');
            
            const checkIn = entryEvents.length > 0 ? entryEvents[0].event_datetime : null;
            const checkOut = exitEvents.length > 0 ? exitEvents[exitEvents.length - 1].event_datetime : null;
            
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
            
            insertStmt.run(
                dayData.employee_id,
                dayData.employee_number,
                dayData.date,
                checkIn,
                checkOut,
                hoursWorked,
                status
            );
            
            processedCount++;
        }
        
        insertStmt.finalize();
        
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

module.exports = router;